// =========================================================
// Planning reports (A5e) · pure functions, no React/Dexie.
// Input: PivotEntry[] from repo.entriesForPivot() (soft-deleted entries already excluded).
// Amounts are rounded to 2 dp at the edge; months are 'YYYY-MM'; dates are local 'YYYY-MM-DD'.
// =========================================================

import type { PivotEntry } from '../data/types';
import { getLastNMonths, shiftMonth } from './months';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface NamedId {
  id: string;
  nameAr: string | null;
  nameEn: string | null;
}

// ---------- 1. Bills tracker ----------

export interface BillRow extends NamedId {
  /** One value per month in `months`, same order. */
  values: number[];
  /** Indexes into `months` where the bill jumped above its own recent average. */
  jumps: number[];
}

/**
 * Utilities items (or any subcategory) month by month.
 * A month is a "jump" when it is more than `threshold` above the average of the up to 6 earlier non-zero months.
 */
export function billsTracker(
  entries: PivotEntry[],
  months: string[],
  opts: { subcategoryNameEn?: string; threshold?: number } = {},
): BillRow[] {
  const sub = (opts.subcategoryNameEn ?? 'Utilities').toLowerCase();
  const threshold = opts.threshold ?? 0.25;
  const idx = new Map(months.map((m, i) => [m, i]));
  const rows = new Map<string, BillRow>();
  for (const e of entries) {
    if (e.type !== 'expense' || !e.itemId) continue;
    if ((e.subcategoryNameEn ?? '').toLowerCase() !== sub) continue;
    const i = idx.get(e.month);
    if (i === undefined) continue;
    let row = rows.get(e.itemId);
    if (!row) {
      row = { id: e.itemId, nameAr: e.itemNameAr, nameEn: e.itemNameEn, values: months.map(() => 0), jumps: [] };
      rows.set(e.itemId, row);
    }
    row.values[i] = round2(row.values[i] + e.amount);
  }
  for (const row of rows.values()) {
    row.values.forEach((v, i) => {
      const prior = row.values.slice(Math.max(0, i - 6), i).filter((x) => x > 0);
      if (!v || prior.length === 0) return;
      const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
      if (v > avg * (1 + threshold)) row.jumps.push(i);
    });
  }
  return [...rows.values()].sort((a, b) => sum(b.values) - sum(a.values));
}

// ---------- 2. Monthly averages ----------

export interface CategoryAverage extends NamedId {
  average: number;
  min: number;
  max: number;
}

/** Average monthly spending per category over `months` (months with no spending count as 0). */
export function monthlyAverages(entries: PivotEntry[], months: string[]): CategoryAverage[] {
  const per = byCategoryAndMonth(entries, new Set(months));
  return [...per.values()]
    .map(({ meta, byMonth }) => {
      const vals = months.map((m) => byMonth.get(m) ?? 0);
      return { ...meta, average: round2(sum(vals) / months.length), min: round2(Math.min(...vals)), max: round2(Math.max(...vals)) };
    })
    .filter((c) => c.max > 0)
    .sort((a, b) => b.average - a.average);
}

// ---------- 3. Who spent what ----------

export interface PersonSpending {
  id: string;
  name: string | null;
  total: number;
  byCategory: (NamedId & { total: number })[];
}

/** Spending split by the family member who entered it, for the given months. */
export function whoSpentWhat(entries: PivotEntry[], months: string[]): PersonSpending[] {
  const inRange = new Set(months);
  const people = new Map<string, PersonSpending & { cats: Map<string, NamedId & { total: number }> }>();
  for (const e of entries) {
    if (e.type !== 'expense' || !inRange.has(e.month)) continue;
    const pid = e.createdById ?? 'unknown';
    let p = people.get(pid);
    if (!p) {
      p = { id: pid, name: e.createdByName, total: 0, byCategory: [], cats: new Map() };
      people.set(pid, p);
    }
    p.total = round2(p.total + e.amount);
    const cid = e.categoryId ?? 'none';
    const c = p.cats.get(cid) ?? { id: cid, nameAr: e.categoryNameAr, nameEn: e.categoryNameEn, total: 0 };
    c.total = round2(c.total + e.amount);
    p.cats.set(cid, c);
  }
  return [...people.values()]
    .map(({ cats, ...p }) => ({ ...p, byCategory: [...cats.values()].sort((a, b) => b.total - a.total) }))
    .sort((a, b) => b.total - a.total);
}

// ---------- 4. Search ----------

export interface SearchableEntry {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  occurredOn: string;
  note?: string | null;
  itemNameAr?: string | null;
  itemNameEn?: string | null;
  subcategoryNameAr?: string | null;
  subcategoryNameEn?: string | null;
  categoryNameAr?: string | null;
  categoryNameEn?: string | null;
  accountNameAr?: string | null;
  accountNameEn?: string | null;
}

export interface SearchQuery {
  text?: string;
  minAmount?: number;
  maxAmount?: number;
  from?: string; // 'YYYY-MM-DD' inclusive
  to?: string; // 'YYYY-MM-DD' inclusive
  type?: 'expense' | 'income' | 'transfer';
}

/**
 * Normalises text so Arabic and English searches are forgiving:
 * lower-case, Arabic-Indic digits → 0-9, no tashkeel/tatweel, أ/إ/آ → ا, ى → ي, ة → ه.
 */
export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchEntries<T extends SearchableEntry>(entries: T[], q: SearchQuery): { results: T[]; total: number } {
  const words = q.text ? normalizeSearchText(q.text).split(' ').filter(Boolean) : [];
  const results = entries
    .filter((e) => {
      if (q.type && e.type !== q.type) return false;
      if (q.minAmount != null && e.amount < q.minAmount) return false;
      if (q.maxAmount != null && e.amount > q.maxAmount) return false;
      if (q.from && e.occurredOn < q.from) return false;
      if (q.to && e.occurredOn > q.to) return false;
      if (!words.length) return true;
      const hay = normalizeSearchText(
        [e.note, e.itemNameAr, e.itemNameEn, e.subcategoryNameAr, e.subcategoryNameEn, e.categoryNameAr, e.categoryNameEn, e.accountNameAr, e.accountNameEn]
          .filter(Boolean)
          .join(' '),
      );
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : a.occurredOn > b.occurredOn ? -1 : 0));
  const total = round2(results.reduce((acc, e) => acc + (e.type === 'income' ? e.amount : e.type === 'expense' ? -e.amount : 0), 0));
  return { results, total };
}

// ---------- 5. Unusual spending ----------

export interface UnusualCategory extends NamedId {
  thisMonth: number;
  average: number;
  /** thisMonth − average, in EGP. */
  above: number;
  /** Fraction above normal, e.g. 0.45 = 45% more than usual. */
  ratio: number;
}

/**
 * Categories this month that are more than `threshold` above their average of the previous `lookback` months,
 * and at least `minAbove` EGP above it (so tiny categories don't raise alarms).
 */
export function unusualSpending(
  entries: PivotEntry[],
  month: string,
  opts: { lookback?: number; threshold?: number; minAbove?: number } = {},
): UnusualCategory[] {
  const lookback = opts.lookback ?? 6;
  const threshold = opts.threshold ?? 0.3;
  const minAbove = opts.minAbove ?? 100;
  const previous = getLastNMonths(shiftMonth(month, -1), lookback);
  const per = byCategoryAndMonth(entries, new Set([...previous, month]));
  const out: UnusualCategory[] = [];
  for (const { meta, byMonth } of per.values()) {
    const thisMonth = round2(byMonth.get(month) ?? 0);
    // "Normal" = average of the earlier months that actually had spending in this category, so a category with
    // little history doesn't get an artificially low average and raise false alarms.
    const history = previous.map((m) => byMonth.get(m) ?? 0).filter((v) => v > 0);
    if (!history.length) continue;
    const average = round2(sum(history) / history.length);
    const above = round2(thisMonth - average);
    if (average <= 0 || above < minAbove || thisMonth <= average * (1 + threshold)) continue;
    out.push({ ...meta, thisMonth, average, above, ratio: round2(above / average) });
  }
  return out.sort((a, b) => b.above - a.above);
}

// ---------- 6. Spending pace ----------

export interface SpendingPace {
  spentSoFar: number;
  /** What a typical month had spent by the same day of the month. */
  typicalByToday: number;
  /** A typical full month. */
  typicalMonth: number;
  /** (spentSoFar − typicalByToday) / typicalByToday; 0.12 = 12% ahead of normal, −0.1 = 10% behind. null when there is no history. */
  pace: number | null;
}

/** How this month is going compared with a typical month by the same day (`today` is a local 'YYYY-MM-DD'). */
export function spendingPace(entries: PivotEntry[], today: string, opts: { lookback?: number } = {}): SpendingPace {
  const lookback = opts.lookback ?? 6;
  const month = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const previous = getLastNMonths(shiftMonth(month, -1), lookback);
  const prevSet = new Set(previous);
  let spentSoFar = 0;
  const byToday = new Map<string, number>();
  const full = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== 'expense') continue;
    const d = Number(e.occurredOn.slice(8, 10));
    if (e.month === month && d <= day) spentSoFar += e.amount;
    if (prevSet.has(e.month)) {
      full.set(e.month, (full.get(e.month) ?? 0) + e.amount);
      if (d <= day) byToday.set(e.month, (byToday.get(e.month) ?? 0) + e.amount);
    }
  }
  const monthsWithHistory = previous.filter((m) => (full.get(m) ?? 0) > 0);
  const n = monthsWithHistory.length;
  const typicalByToday = n ? round2(sum(monthsWithHistory.map((m) => byToday.get(m) ?? 0)) / n) : 0;
  const typicalMonth = n ? round2(sum(monthsWithHistory.map((m) => full.get(m) ?? 0)) / n) : 0;
  const pace = typicalByToday > 0 ? round2((spentSoFar - typicalByToday) / typicalByToday) : null;
  return { spentSoFar: round2(spentSoFar), typicalByToday, typicalMonth, pace };
}

// ---------- helpers ----------

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function byCategoryAndMonth(entries: PivotEntry[], months: Set<string>) {
  const per = new Map<string, { meta: NamedId; byMonth: Map<string, number> }>();
  for (const e of entries) {
    if (e.type !== 'expense' || !months.has(e.month)) continue;
    const cid = e.categoryId ?? 'none';
    let c = per.get(cid);
    if (!c) {
      c = { meta: { id: cid, nameAr: e.categoryNameAr, nameEn: e.categoryNameEn }, byMonth: new Map() };
      per.set(cid, c);
    }
    c.byMonth.set(e.month, (c.byMonth.get(e.month) ?? 0) + e.amount);
  }
  return per;
}

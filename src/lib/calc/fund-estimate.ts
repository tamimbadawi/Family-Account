import type { Fund, FundEstimate } from '../market/types';

/**
 * The year-to-date and money-market steps of the written estimate method (scripts/data-fund-estimates.py,
 * steps 4–7), for funds the estimates file does not cover yet (a fund added to the sheet after the file was
 * written). Same rules and constants as the script, so a fund gets the same figure either way.
 */
const MIN_PEERS = 10;
const MIN_YTD_DAYS = 90;
const MIN_SPREAD_FUNDS = 5;
const K = 3;
const T30 = 30 / 365;
const PARTIAL_Z = -3.5;
const FLAT_PRE = 0.002;
const MAD_TO_SD = 1.482602218505602;
const MM_Z = 4;
const MM_SD_FLOOR = 0.5;
const MM_DISAGREE = 5;
export const LIVE_MODEL_VERSION = '2026.10-b-live';

function dayCount(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function lastDateOf(f: Fund, today: Date): Date {
  const d = f.publishedOn ? new Date(`${f.publishedOn.slice(0, 10)}T00:00:00Z`) : null;
  return d && !Number.isNaN(d.getTime()) ? d : today;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

interface Pace {
  pace: number;
  years: number;
  start: Date;
  last: Date;
  partial: boolean;
}

function ytdPace(f: Fund, today: Date): Pace | null {
  const ytd = f.changeYtdPercent;
  if (ytd == null || !Number.isFinite(ytd) || ytd <= -100) return null;
  const last = lastDateOf(f, today);
  const start = new Date(Date.UTC(last.getUTCFullYear(), 0, 1));
  const days = dayCount(start, last);
  if (days < MIN_YTD_DAYS) return null;
  return { pace: (Math.log(1 + ytd / 100) * 365) / days, years: days / 365, start, last, partial: false };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function madSd(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = median(xs);
  return MAD_TO_SD * median(xs.map((x) => Math.abs(x - m)));
}

const recentOf = (f: Fund) =>
  f.change30dPercent != null && Number.isFinite(f.change30dPercent) && f.change30dPercent > -100
    ? Math.log(1 + f.change30dPercent / 100)
    : null;

/**
 * Year-to-date paces for one group (same type and currency), with the partial-year test: a fund that started
 * after 1 January is measured on its last 30 days alone and is not a peer.
 */
function groupPaces(funds: Fund[], today: Date): Map<string, Pace> {
  const out = new Map<string, Pace>();
  const before = new Map<string, number>();
  for (const f of funds) {
    const o = ytdPace(f, today);
    if (!o) continue;
    out.set(f.id, o);
    const r = recentOf(f);
    if (r != null) before.set(f.id, o.pace * o.years - r);
  }
  const partial = new Set([...before].filter(([, b]) => Math.abs(b) < FLAT_PRE).map(([id]) => id));
  if (before.size >= MIN_PEERS) {
    const recent = new Map(funds.map((f) => [f.id, recentOf(f)]));
    const pre = new Map([...before].map(([id, b]) => [id, b / (out.get(id)!.years - T30)]));
    const rec = new Map([...before.keys()].map((id) => [id, recent.get(id)! / T30]));
    const midPre = median([...pre.values()]);
    const mid30 = median([...rec.values()]);
    const z = [...before.keys()].map(
      (id) =>
        [id, (pre.get(id)! - midPre - (rec.get(id)! - mid30)) / Math.sqrt(1 / (out.get(id)!.years - T30) + 1 / T30)] as const,
    );
    const zs = z.map(([, v]) => v);
    const zc = median(zs);
    const sd = madSd(zs);
    if (sd > 0) for (const [id, v] of z) if ((v - zc) / sd < PARTIAL_Z) partial.add(id);
  }
  for (const id of partial) {
    const o = out.get(id)!;
    const f = funds.find((x) => x.id === id)!;
    out.set(id, {
      ...o,
      pace: recentOf(f)! / T30,
      years: T30,
      start: new Date(o.last.getTime() - 30 * 86400000),
      partial: true,
    });
  }
  return out;
}

function mmYield(f: Fund): number | null {
  const c = f.change30dPercent;
  if (c == null || !Number.isFinite(c) || c <= -100) return null;
  return round1((Math.pow(1 + c / 100, 365 / 30) - 1) * 100);
}

/** Estimates for the given funds, worked out from their published changes; peers are drawn from `all`. */
export function estimatesFromRows(missing: Fund[], all: Fund[], today: Date = new Date()): Map<string, FundEstimate> {
  const out = new Map<string, FundEstimate>();
  const byGroup = new Map<string, Fund[]>();
  for (const f of all) {
    const key = `${f.fundType}|${f.currency || 'EGP'}`;
    byGroup.set(key, [...(byGroup.get(key) ?? []), f]);
  }
  const paces = new Map<string, Map<string, Pace>>();
  const computedOn = iso(today);
  for (const f of missing) {
    const key = `${f.fundType}|${f.currency || 'EGP'}`;
    const group = byGroup.get(key) ?? [f];
    const base = { pricesUsed: 2, peers: 0, computedOn, modelVersion: LIVE_MODEL_VERSION };
    if (f.fundType === 'money_market') {
      const y = mmYield(f);
      if (y == null) continue;
      const ys = group.map(mmYield).filter((v): v is number => v != null);
      if (ys.length >= MIN_SPREAD_FUNDS) {
        const sd = Math.max(madSd(ys), MM_SD_FLOOR);
        if (Math.abs(y - median(ys)) / sd > MM_Z) {
          const o = ytdPace(f, today);
          const backed = o ? (Math.exp(o.pace) - 1) * 100 : null;
          if (backed == null || Math.abs(backed - y) > MM_DISAGREE) continue;
        }
      }
      const last = lastDateOf(f, today);
      out.set(f.id, {
        ...base,
        estimatePercent: y,
        method: 'yield',
        firstDate: iso(new Date(last.getTime() - 30 * 86400000)),
        lastDate: iso(last),
      });
      continue;
    }
    if (!paces.has(key)) paces.set(key, groupPaces(group, today));
    const g = paces.get(key)!;
    const o = g.get(f.id);
    const peers = [...g.values()].filter((p) => !p.partial).map((p) => p.pace);
    if (!o || peers.length < MIN_PEERS) continue;
    const w = o.years / (o.years + K);
    const m = w * o.pace + (1 - w) * median(peers);
    out.set(f.id, {
      ...base,
      peers: peers.length,
      estimatePercent: round1((Math.exp(m) - 1) * 100),
      method: 'ytd',
      firstDate: iso(o.start),
      lastDate: iso(o.last),
    });
  }
  return out;
}

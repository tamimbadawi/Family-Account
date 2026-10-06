// =========================================================
// Income Sources Report  ·  Family Accounts
// Breakdown of where money in came from (by item/source)
// =========================================================

import type { EnrichedEntry } from '@/lib/data/types';

export interface IncomeSourceItem {
  id: string;
  name: string;
  amount: number;
  percentage: number; // 0..100
  entriesCount: number;
  color?: string;
}

export interface IncomeSourcesResult {
  sources: IncomeSourceItem[];
  totalIncome: number;
}

// Preset palette for income chart
const INCOME_PALETTE = [
  '#15803D', // Emerald / income primary
  '#0F766E', // Teal
  '#0284C7', // Sky
  '#7C3AED', // Violet
  '#D97706', // Amber
  '#059669', // Mint
];

export function calculateIncomeSources(
  entries: EnrichedEntry[],
  period?: { from?: string; to?: string },
  locale: 'ar' | 'en' = 'en'
): IncomeSourcesResult {
  const isAr = locale.startsWith('ar');

  const filtered = entries.filter((e) => {
    if (e.deletedAt || e.type !== 'income') return false;
    if (period?.from && e.occurredOn < period.from) return false;
    if (period?.to && e.occurredOn > period.to) return false;
    return true;
  });

  const groupMap = new Map<string, { name: string; amount: number; count: number }>();
  let total = 0;

  for (const e of filtered) {
    const key = e.itemId || e.accountId || 'other';
    const name =
      (isAr ? e.itemNameAr || e.itemNameEn : e.itemNameEn || e.itemNameAr) ||
      (isAr ? e.accountNameAr || e.accountNameEn : e.accountNameEn || e.accountNameAr) ||
      (isAr ? 'دخل آخر' : 'Other Income');

    const cur = groupMap.get(key) ?? { name, amount: 0, count: 0 };
    cur.amount += e.amount;
    cur.count += 1;
    groupMap.set(key, cur);
    total += e.amount;
  }

  const sources: IncomeSourceItem[] = Array.from(groupMap.entries()).map(
    ([id, g], index) => {
      const rounded = Math.round(g.amount * 100) / 100;
      const pct = total > 0 ? Math.round((rounded / total) * 100) : 0;
      return {
        id,
        name: g.name,
        amount: rounded,
        percentage: pct,
        entriesCount: g.count,
        color: INCOME_PALETTE[index % INCOME_PALETTE.length],
      };
    }
  );

  // Sort descending by amount
  sources.sort((a, b) => b.amount - a.amount);

  return {
    sources,
    totalIncome: Math.round(total * 100) / 100,
  };
}

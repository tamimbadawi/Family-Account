// =========================================================
// Biggest Expenses Report  ·  Family Accounts
// Top individual expense entries in a given period
// =========================================================

import type { EnrichedEntry } from '@/lib/data/types';

export interface BiggestExpensesResult {
  entries: EnrichedEntry[];
  totalAmount: number;
  count: number;
}

export function calculateBiggestExpenses(
  entries: EnrichedEntry[],
  period?: { from?: string; to?: string },
  limit: number = 10
): BiggestExpensesResult {
  const filtered = entries.filter((e) => {
    if (e.deletedAt || e.type !== 'expense') return false;
    if (period?.from && e.occurredOn < period.from) return false;
    if (period?.to && e.occurredOn > period.to) return false;
    return true;
  });

  // Sort descending by amount
  filtered.sort((a, b) => b.amount - a.amount);

  const top = filtered.slice(0, limit);
  const total = top.reduce((sum, e) => sum + e.amount, 0);

  return {
    entries: top,
    totalAmount: Math.round(total * 100) / 100,
    count: top.length,
  };
}

// =========================================================
// This Month vs Last Month Report  ·  Family Accounts
// Pure calculations comparing spending per category across 2 months
// =========================================================

import type { Category, Entry, EnrichedEntry } from '@/lib/data/types';
import { shiftMonth } from './months';

export interface CategoryComparison {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  thisMonthAmount: number;
  lastMonthAmount: number;
  diffAmount: number;
  diffPercent: number; // positive = spent more, negative = spent less
  isUp: boolean;
}

export interface ThisVsLastMonthResult {
  currentMonth: string;
  previousMonth: string;
  categories: CategoryComparison[];
  thisMonthTotal: number;
  lastMonthTotal: number;
  totalDiffAmount: number;
  totalDiffPercent: number;
}

export function calculateThisVsLastMonth(
  entries: (Entry | EnrichedEntry)[],
  categories: Category[] | Map<string, Category>,
  currentMonth: string,
  locale: 'ar' | 'en' = 'en'
): ThisVsLastMonthResult {
  const previousMonth = shiftMonth(currentMonth, -1);

  const catMap =
    categories instanceof Map
      ? categories
      : new Map(categories.map((c) => [c.id, c]));

  const thisMonthByCat = new Map<string, number>();
  const lastMonthByCat = new Map<string, number>();
  let thisMonthTotal = 0;
  let lastMonthTotal = 0;

  for (const entry of entries) {
    if (entry.deletedAt || entry.type !== 'expense') continue;

    const month = entry.occurredOn.slice(0, 7);
    const catId =
      ('categoryId' in entry && entry.categoryId)
        ? entry.categoryId
        : entry.itemId
        ? 'unknown'
        : null;

    if (!catId) continue;

    if (month === currentMonth) {
      thisMonthByCat.set(catId, (thisMonthByCat.get(catId) ?? 0) + entry.amount);
      thisMonthTotal += entry.amount;
    } else if (month === previousMonth) {
      lastMonthByCat.set(catId, (lastMonthByCat.get(catId) ?? 0) + entry.amount);
      lastMonthTotal += entry.amount;
    }
  }

  // Combine categories with spending in either month
  const allCatIds = new Set<string>([
    ...Array.from(thisMonthByCat.keys()),
    ...Array.from(lastMonthByCat.keys()),
  ]);

  const comparisons: CategoryComparison[] = [];

  for (const id of allCatIds) {
    const thisAmount = Math.round((thisMonthByCat.get(id) ?? 0) * 100) / 100;
    const lastAmount = Math.round((lastMonthByCat.get(id) ?? 0) * 100) / 100;
    const diff = Math.round((thisAmount - lastAmount) * 100) / 100;

    let diffPct = 0;
    if (lastAmount > 0) {
      diffPct = Math.round(((thisAmount - lastAmount) / lastAmount) * 100);
    } else if (thisAmount > 0) {
      diffPct = 100;
    }

    const catObj = catMap.get(id);
    const isAr = locale.startsWith('ar');
    const name = catObj
      ? (isAr ? catObj.nameAr || catObj.nameEn : catObj.nameEn || catObj.nameAr) || id
      : isAr
      ? 'فئة أخرى'
      : 'Other';

    comparisons.push({
      id,
      name,
      icon: catObj?.icon,
      color: catObj?.color,
      thisMonthAmount: thisAmount,
      lastMonthAmount: lastAmount,
      diffAmount: diff,
      diffPercent: diffPct,
      isUp: diff > 0,
    });
  }

  // Sort descending by this month's spending, then last month's
  comparisons.sort((a, b) => {
    if (b.thisMonthAmount !== a.thisMonthAmount) {
      return b.thisMonthAmount - a.thisMonthAmount;
    }
    return b.lastMonthAmount - a.lastMonthAmount;
  });

  const totalDiff = Math.round((thisMonthTotal - lastMonthTotal) * 100) / 100;
  let totalDiffPct = 0;
  if (lastMonthTotal > 0) {
    totalDiffPct = Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);
  } else if (thisMonthTotal > 0) {
    totalDiffPct = 100;
  }

  return {
    currentMonth,
    previousMonth,
    categories: comparisons,
    thisMonthTotal: Math.round(thisMonthTotal * 100) / 100,
    lastMonthTotal: Math.round(lastMonthTotal * 100) / 100,
    totalDiffAmount: totalDiff,
    totalDiffPercent: totalDiffPct,
  };
}

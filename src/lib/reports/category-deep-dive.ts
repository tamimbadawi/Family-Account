// =========================================================
// Category Deep-Dive Report  ·  Family Accounts
// 12-month spending trend + subcategory/item breakdown for a category
// =========================================================

import type { Category, EnrichedEntry, Item, Subcategory } from '@/lib/data/types';
import { formatShortMonth, shiftMonth } from './months';

export interface DeepDiveTrendMonth {
  month: string; // 'YYYY-MM'
  name: string;  // 'Oct'
  amount: number;
}

export interface DeepDiveItemBreakdown {
  id: string;
  name: string;
  amount: number;
  percentage: number;
}

export interface DeepDiveSubcategoryBreakdown {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  items: DeepDiveItemBreakdown[];
}

export interface CategoryDeepDiveResult {
  categoryId: string;
  categoryName: string;
  color?: string | null;
  icon?: string | null;
  baseMonth: string;
  currentMonthTotal: number;
  averageMonthly: number;
  trend12Months: DeepDiveTrendMonth[];
  subcategories: DeepDiveSubcategoryBreakdown[];
}

export function calculateCategoryDeepDive(
  entries: EnrichedEntry[],
  categoryId: string,
  baseMonth: string,
  categories: Category[],
  subcategories: Subcategory[],
  items: Item[],
  locale: 'ar' | 'en' = 'en'
): CategoryDeepDiveResult {
  const isAr = locale.startsWith('ar');

  const cat = categories.find((c) => c.id === categoryId);
  const catName = cat
    ? (isAr ? cat.nameAr || cat.nameEn : cat.nameEn || cat.nameAr) || categoryId
    : categoryId;

  // Build list of last 12 months
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    months.push(shiftMonth(baseMonth, -i));
  }

  const trendMap = new Map<string, number>();
  for (const m of months) trendMap.set(m, 0);

  // Subcategory -> Item -> amount for baseMonth
  const subcatSpend = new Map<string, number>();
  const itemSpend = new Map<string, number>();
  let currentMonthTotal = 0;
  let total12Months = 0;
  let activeMonthsCount = 0;

  for (const e of entries) {
    if (e.deletedAt || e.type !== 'expense') continue;
    if (e.categoryId !== categoryId) continue;

    const m = e.occurredOn.slice(0, 7);
    if (trendMap.has(m)) {
      trendMap.set(m, (trendMap.get(m) ?? 0) + e.amount);
      total12Months += e.amount;
    }

    if (m === baseMonth) {
      currentMonthTotal += e.amount;
      const subId = e.subcategoryId || 'uncategorized';
      subcatSpend.set(subId, (subcatSpend.get(subId) ?? 0) + e.amount);

      const itemId = e.itemId || 'other';
      itemSpend.set(itemId, (itemSpend.get(itemId) ?? 0) + e.amount);
    }
  }

  for (const val of trendMap.values()) {
    if (val > 0) activeMonthsCount++;
  }

  const divisor = activeMonthsCount > 0 ? activeMonthsCount : 12;
  const avgMonthly = Math.round((total12Months / divisor) * 100) / 100;

  const trend12Months: DeepDiveTrendMonth[] = months.map((m) => ({
    month: m,
    name: formatShortMonth(m, locale),
    amount: Math.round((trendMap.get(m) ?? 0) * 100) / 100,
  }));

  // Build subcategory breakdown
  const subMap = new Map(subcategories.map((s) => [s.id, s]));
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const subBreakdowns: DeepDiveSubcategoryBreakdown[] = [];

  for (const [subId, subAmount] of subcatSpend.entries()) {
    const subObj = subMap.get(subId);
    const subName = subObj
      ? (isAr ? subObj.nameAr || subObj.nameEn : subObj.nameEn || subObj.nameAr) || subId
      : isAr
      ? 'عام'
      : 'General';

    const subPct =
      currentMonthTotal > 0
        ? Math.round((subAmount / currentMonthTotal) * 100)
        : 0;

    // Items under this subcategory with spending
    const itemsInSub: DeepDiveItemBreakdown[] = [];
    for (const [itId, itAmount] of itemSpend.entries()) {
      const itObj = itemMap.get(itId);
      if (itObj && itObj.subcategoryId === subId) {
        const itName =
          (isAr ? itObj.nameAr || itObj.nameEn : itObj.nameEn || itObj.nameAr) || itId;
        const itPct =
          subAmount > 0 ? Math.round((itAmount / subAmount) * 100) : 0;
        itemsInSub.push({
          id: itId,
          name: itName,
          amount: Math.round(itAmount * 100) / 100,
          percentage: itPct,
        });
      }
    }
    itemsInSub.sort((a, b) => b.amount - a.amount);

    subBreakdowns.push({
      id: subId,
      name: subName,
      amount: Math.round(subAmount * 100) / 100,
      percentage: subPct,
      items: itemsInSub,
    });
  }

  subBreakdowns.sort((a, b) => b.amount - a.amount);

  return {
    categoryId,
    categoryName: catName,
    color: cat?.color,
    icon: cat?.icon,
    baseMonth,
    currentMonthTotal: Math.round(currentMonthTotal * 100) / 100,
    averageMonthly: avgMonthly,
    trend12Months,
    subcategories: subBreakdowns,
  };
}

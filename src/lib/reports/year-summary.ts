// =========================================================
// Year Summary Report  ·  Family Accounts
// 12-month overview of income, spending, and savings
// =========================================================

import type { Entry, EnrichedEntry } from '@/lib/data/types';
import { formatShortMonth } from './months';

export interface MonthSummaryBar {
  month: string; // 'YYYY-MM'
  name: string;  // e.g. 'Oct' / 'أكت'
  income: number;
  expense: number;
  net: number;
}

export interface YearSummaryResult {
  year: number;
  months: MonthSummaryBar[];
  totalIncome: number;
  totalExpense: number;
  totalSaved: number;
  monthlyAverageExpense: number;
}

export function calculateYearSummary(
  entries: (Entry | EnrichedEntry)[],
  year: number,
  locale: 'ar' | 'en' = 'en'
): YearSummaryResult {
  const monthMap = new Map<string, { income: number; expense: number }>();

  // Initialize all 12 months for the year
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${m.toString().padStart(2, '0')}`;
    monthMap.set(monthKey, { income: 0, expense: 0 });
  }

  let totalIncome = 0;
  let totalExpense = 0;
  let activeExpenseMonths = 0;

  for (const entry of entries) {
    if (entry.deletedAt) continue;
    if (entry.type !== 'expense' && entry.type !== 'income') continue;

    const monthKey = entry.occurredOn.slice(0, 7);
    if (!monthMap.has(monthKey)) continue;

    const current = monthMap.get(monthKey)!;
    if (entry.type === 'income') {
      current.income += entry.amount;
      totalIncome += entry.amount;
    } else if (entry.type === 'expense') {
      current.expense += entry.amount;
      totalExpense += entry.amount;
    }
  }

  const months: MonthSummaryBar[] = [];

  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${m.toString().padStart(2, '0')}`;
    const data = monthMap.get(monthKey)!;
    const inc = Math.round(data.income * 100) / 100;
    const exp = Math.round(data.expense * 100) / 100;
    if (exp > 0) activeExpenseMonths++;

    months.push({
      month: monthKey,
      name: formatShortMonth(monthKey, locale),
      income: inc,
      expense: exp,
      net: Math.round((inc - exp) * 100) / 100,
    });
  }

  const divisor = activeExpenseMonths > 0 ? activeExpenseMonths : 12;
  const avgExpense = Math.round((totalExpense / divisor) * 100) / 100;

  return {
    year,
    months,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    totalSaved: Math.round((totalIncome - totalExpense) * 100) / 100,
    monthlyAverageExpense: avgExpense,
  };
}

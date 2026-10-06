// =========================================================
// Spending Calendar Report  ·  Family Accounts
// Daily expense breakdown in an Egyptian calendar grid (Sat–Fri)
// =========================================================

import type { EnrichedEntry } from '@/lib/data/types';

export interface CalendarDay {
  dateStr: string;   // 'YYYY-MM-DD'
  dayNumber: number; // 1..31
  weekday: number;   // 0 (Saturday) .. 6 (Friday)
  amount: number;
  entriesCount: number;
  tintRatio: number; // 0..1 (for accent 4–28% tinting)
  entries: EnrichedEntry[];
}

export interface SpendingCalendarResult {
  month: string; // 'YYYY-MM'
  leadingEmptyDays: number; // 0..6 days before day 1
  days: CalendarDay[];
  monthTotal: number;
  highestDay: { dateStr: string; amount: number } | null;
}

export function calculateSpendingCalendar(
  entries: EnrichedEntry[],
  monthStr: string // 'YYYY-MM'
): SpendingCalendarResult {
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthNumStr, 10);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  // First day of month weekday in Egypt (Sat=0, Sun=1, ..., Fri=6)
  const firstDayJsWeekday = new Date(year, monthNum - 1, 1).getDay(); // Sun=0..Sat=6
  const leadingEmptyDays = (firstDayJsWeekday + 1) % 7;

  // Group entries by day
  const dayMap = new Map<string, EnrichedEntry[]>();
  for (const e of entries) {
    if (e.deletedAt || e.type !== 'expense') continue;
    if (e.occurredOn.slice(0, 7) !== monthStr) continue;

    const list = dayMap.get(e.occurredOn) ?? [];
    list.push(e);
    dayMap.set(e.occurredOn, list);
  }

  // Calculate day totals and max
  let maxDaySpend = 0;
  let monthTotal = 0;
  let highestDay: { dateStr: string; amount: number } | null = null;

  const days: CalendarDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = d.toString().padStart(2, '0');
    const dateStr = `${monthStr}-${dayStr}`;
    const dayEntries = dayMap.get(dateStr) ?? [];

    const amount = dayEntries.reduce((sum, e) => sum + e.amount, 0);
    const rounded = Math.round(amount * 100) / 100;

    monthTotal += rounded;
    if (rounded > maxDaySpend) {
      maxDaySpend = rounded;
      highestDay = { dateStr, amount: rounded };
    }

    const jsDay = new Date(year, monthNum - 1, d).getDay();
    const egyptWeekday = (jsDay + 1) % 7;

    days.push({
      dateStr,
      dayNumber: d,
      weekday: egyptWeekday,
      amount: rounded,
      entriesCount: dayEntries.length,
      tintRatio: 0, // will compute below
      entries: dayEntries,
    });
  }

  // Assign tint ratios
  for (const day of days) {
    if (day.amount > 0 && maxDaySpend > 0) {
      day.tintRatio = Math.min(day.amount / maxDaySpend, 1);
    }
  }

  return {
    month: monthStr,
    leadingEmptyDays,
    days,
    monthTotal: Math.round(monthTotal * 100) / 100,
    highestDay,
  };
}

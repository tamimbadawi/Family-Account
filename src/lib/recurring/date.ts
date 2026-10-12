// =========================================================
// Recurring Date Maths  ·  Family Accounts (حساباتنا)
// Pure helper functions for monthly recurring entries.
// Handles short months (February 28/29, April 30, etc.)
// =========================================================

/**
 * Returns the number of days in a given year and month (1-12).
 * Month is 1-indexed (1 = January, 2 = February, ..., 12 = December).
 */
export function daysInMonth(year: number, month1Indexed: number): number {
  return new Date(Date.UTC(year, month1Indexed, 0)).getUTCDate();
}

/**
 * Returns 'YYYY-MM-DD' for a rule's day of month in a specific 'YYYY-MM'.
 * Months with fewer days use the last day of the month:
 * e.g. day 31 in February 2026 -> 2026-02-28.
 * e.g. day 31 in February 2024 (leap year) -> 2024-02-29.
 * e.g. day 31 in April 2026 -> 2026-04-30.
 */
export function entryDateForMonth(yearMonth: string, dayOfMonth: number): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`Invalid yearMonth: ${yearMonth}`);
  }

  const maxDays = daysInMonth(year, month);
  const clampedDay = Math.min(Math.max(1, dayOfMonth), maxDays);
  const dayStr = String(clampedDay).padStart(2, '0');

  return `${yearStr}-${monthStr.padStart(2, '0')}-${dayStr}`;
}

/**
 * Generates all year-month strings ('YYYY-MM') from startMonth up to endMonth (inclusive).
 */
export function monthsBetween(startMonth: string, endMonth: string): string[] {
  if (startMonth > endMonth) return [];

  const [startYear, startM] = startMonth.split('-').map(Number);
  const [endYear, endM] = endMonth.split('-').map(Number);

  const months: string[] = [];
  let y = startYear;
  let m = startM;

  while (y < endYear || (y === endYear && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return months;
}

export interface RecurringRuleDueParams {
  startMonth: string; // 'YYYY-MM'
  dayOfMonth: number; // 1-31
  isArchived?: boolean;
}

/**
 * Returns all due months ('YYYY-MM') for a recurring rule up to currentDate.
 * A month M is due if:
 * 1. M >= rule.startMonth
 * 2. entryDateForMonth(M, rule.dayOfMonth) <= currentDate
 * If rule is archived, returns empty array.
 */
export function getDueMonths(rule: RecurringRuleDueParams, currentDate: string): string[] {
  if (rule.isArchived) return [];

  const currentMonth = currentDate.slice(0, 7);
  if (rule.startMonth > currentMonth) return [];

  const allMonths = monthsBetween(rule.startMonth, currentMonth);
  return allMonths.filter((m) => {
    const dueOn = entryDateForMonth(m, rule.dayOfMonth);
    return dueOn <= currentDate;
  });
}

/**
 * Calculates the next due date on or after fromDate ('YYYY-MM-DD').
 * Returns 'YYYY-MM-DD', or null if archived.
 */
export function nextDueDate(dayOfMonth: number, fromDate: string): string {
  const [fromYearStr, fromMonthStr] = fromDate.split('-');
  let year = Number(fromYearStr);
  let month = Number(fromMonthStr);

  const thisMonthCandidate = entryDateForMonth(`${year}-${String(month).padStart(2, '0')}`, dayOfMonth);
  if (thisMonthCandidate >= fromDate) {
    return thisMonthCandidate;
  }

  // Next month
  month++;
  if (month > 12) {
    month = 1;
    year++;
  }

  return entryDateForMonth(`${year}-${String(month).padStart(2, '0')}`, dayOfMonth);
}

// ---------- Daily, weekly, monthly and yearly rules ----------

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceParams {
  startDate?: string | null; // 'YYYY-MM-DD'; older monthly rules only have startMonth + dayOfMonth
  startMonth?: string; // 'YYYY-MM'
  dayOfMonth?: number; // 1-31
  endDate?: string | null; // 'YYYY-MM-DD', the last day an entry may be created
  frequency?: RecurrenceFrequency | null; // default 'monthly'
  interval?: number | null; // every N days/weeks/months/years, default 1
  daysOfWeek?: number[] | null; // weekly only: 0 = Sunday … 6 = Saturday
  isArchived?: boolean;
}

/** A rule that was left alone for years never floods History: only the newest dates are created. */
export const MAX_DUE_DATES = 366;

/** Day of the week of a 'YYYY-MM-DD' date: 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Adds (or subtracts) whole days to a 'YYYY-MM-DD' date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The first date a rule is due. Older monthly rules derive it from their start month and day. */
export function ruleStartDate(rule: RecurrenceParams): string | null {
  if (rule.startDate) return rule.startDate;
  if (rule.startMonth && rule.dayOfMonth) return entryDateForMonth(rule.startMonth, rule.dayOfMonth);
  return null;
}

/**
 * Every date ('YYYY-MM-DD', oldest first) a rule is due from its start up to currentDate,
 * never after its end date. Monthly and yearly rules clamp to short months (31 → 30, 29 Feb → 28 Feb).
 */
export function getDueDates(rule: RecurrenceParams, currentDate: string): string[] {
  if (rule.isArchived) return [];
  const start = ruleStartDate(rule);
  if (!start) return [];
  const last = rule.endDate && rule.endDate < currentDate ? rule.endDate : currentDate;
  if (start > last) return [];

  const frequency = rule.frequency ?? 'monthly';
  const interval = Math.max(1, Math.round(rule.interval ?? 1));
  const due: string[] = [];
  const [startYear, startMonth, startDay] = start.split('-').map(Number);

  if (frequency === 'daily') {
    for (let date = start; date <= last; date = addDays(date, interval)) due.push(date);
  } else if (frequency === 'weekly') {
    const days = rule.daysOfWeek?.length ? [...new Set(rule.daysOfWeek)].sort((a, b) => a - b) : [dayOfWeek(start)];
    // Weeks are counted from the Sunday of the starting week, so "every 2 weeks" keeps its rhythm.
    for (let week = addDays(start, -dayOfWeek(start)); week <= last; week = addDays(week, interval * 7)) {
      for (const day of days) {
        const date = addDays(week, day);
        if (date >= start && date <= last) due.push(date);
      }
    }
  } else if (frequency === 'monthly') {
    const day = rule.dayOfMonth ?? startDay;
    for (let i = 0; ; i += interval) {
      const monthIndex = startMonth - 1 + i;
      const year = startYear + Math.floor(monthIndex / 12);
      const date = entryDateForMonth(`${year}-${String((monthIndex % 12) + 1).padStart(2, '0')}`, day);
      if (date > last) break;
      if (date >= start) due.push(date);
    }
  } else {
    for (let year = startYear; ; year += interval) {
      const date = entryDateForMonth(`${year}-${String(startMonth).padStart(2, '0')}`, startDay);
      if (date > last) break;
      due.push(date);
    }
  }

  return due.slice(-MAX_DUE_DATES);
}

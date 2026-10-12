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

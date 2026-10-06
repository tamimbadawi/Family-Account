/**
 * Family Accounts — Month & Date helpers for Reports
 * Western digits (0–9) are used everywhere, in both languages.
 */

/**
 * Formats a month string ('YYYY-MM') in localized long format (e.g. 'أكتوبر 2026' / 'October 2026').
 * Always uses Western digits (numberingSystem: 'latn').
 */
export function formatMonth(monthStr: string, locale: string = 'en'): string {
  if (!monthStr || !monthStr.includes('-')) return '';
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10) - 1;
  const date = new Date(year, month, 1);
  const isAr = locale.startsWith('ar');

  const formatter = new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-EG', {
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  });
  return formatter.format(date);
}

/**
 * Formats a month string ('YYYY-MM') in localized short format (e.g. 'أكت' / 'Oct').
 * Always uses Western digits (numberingSystem: 'latn').
 */
export function formatShortMonth(monthStr: string, locale: string = 'en'): string {
  if (!monthStr || !monthStr.includes('-')) return '';
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10) - 1;
  const date = new Date(year, month, 1);
  const isAr = locale.startsWith('ar');

  const formatter = new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-EG', {
    month: 'short',
    numberingSystem: 'latn',
  });
  return formatter.format(date);
}

/**
 * Shifts a 'YYYY-MM' string by delta months (+1 for next, -1 for previous).
 */
export function shiftMonth(monthStr: string, delta: number): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [yearStr, monthNumStr] = monthStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthNumStr, 10) + delta;

  while (month < 1) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Returns an array of N consecutive month strings ending at endMonth (in ascending order).
 * e.g. getLastNMonths('2026-10', 6) -> ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
 */
export function getLastNMonths(endMonth: string, count: number = 6): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(shiftMonth(endMonth, -i));
  }
  return months;
}

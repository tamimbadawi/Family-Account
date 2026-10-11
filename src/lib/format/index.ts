/**
 * Family Accounts — format helpers
 * Western digits (0–9) are used everywhere, in both languages.
 */
import { currencySymbol } from './currency';

export { COMMON_CURRENCIES, DEFAULT_CURRENCY, currencyChoices, currencyName, currencySymbol, isCurrencyCode } from './currency';
export type { CurrencyChoice } from './currency';

export interface MoneyOptions {
  sign?: boolean;
  compact?: boolean;
  hideCurrency?: boolean;
  fractionDigits?: number;
  /** ISO code of the wallet's currency (a family has 1 or 2). Default EGP. */
  currency?: string;
}

/**
 * Normalises Arabic-Indic (٠-٩) and Eastern Arabic-Indic / Persian (۰-۹) digits to ASCII 0-9.
 * Also converts Arabic decimal comma (٫) to dot (.) and removes thousands separators (٬ and ,).
 */
export function normalizeDigits(str: string | null | undefined): string {
  if (!str) return '';

  return str
    // Arabic-Indic digits
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    // Eastern Arabic-Indic (Persian) digits
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    // Arabic decimal separator (U+066B) -> '.'
    .replace(/٫/g, '.')
    // Arabic thousands separator (U+066C) and comma -> remove
    .replace(/[٬,]/g, '')
    .trim();
}

/**
 * Formats an amount with Western digits in both English and Arabic, in EGP unless
 * `options.currency` names the wallet's currency.
 * Examples:
 *   money(1250, 'en') => "1,250 EGP"
 *   money(1250.5, 'ar') => "1,250.50 ج.م"
 *   money(500, 'en', { sign: true }) => "+500 EGP"
 */
export function money(
  amount: number,
  locale: string = 'en',
  options: MoneyOptions = {}
): string {
  const isAr = locale.startsWith('ar');
  const symbol = currencySymbol(options.currency, locale);

  const absAmount = Math.abs(amount);
  const isInt = absAmount % 1 === 0;

  let minFraction = isInt ? 0 : 2;
  let maxFraction = 2;

  if (options.fractionDigits !== undefined) {
    minFraction = options.fractionDigits;
    maxFraction = options.fractionDigits;
  }

  const formatter = new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-EG', {
    notation: options.compact ? 'compact' : 'standard',
    minimumFractionDigits: options.compact ? 0 : minFraction,
    maximumFractionDigits: options.compact ? 1 : maxFraction,
    numberingSystem: 'latn',
  });

  const formattedNum = formatter.format(absAmount);

  let prefix = '';
  if (options.sign) {
    if (amount > 0) prefix = '+';
    else if (amount < 0) prefix = '-';
  } else if (amount < 0) {
    prefix = '-';
  }

  if (options.hideCurrency) {
    return `${prefix}${formattedNum}`;
  }

  return `${prefix}${formattedNum} ${symbol}`;
}

export interface BilingualRow {
  name_ar?: string | null;
  name_en?: string | null;
  name?: string | null;
}

/**
 * Selects the localised name from a row, with fallback to the other language.
 */
export function pickName(
  row: BilingualRow | null | undefined,
  locale: string = 'en'
): string {
  if (!row) return '';
  const isAr = locale.startsWith('ar');

  if (isAr) {
    return row.name_ar?.trim() || row.name_en?.trim() || row.name?.trim() || '';
  }
  return row.name_en?.trim() || row.name_ar?.trim() || row.name?.trim() || '';
}

/**
 * Formats a date relative to today (Today / Yesterday / Day of week + date).
 * Always uses Western digits (numberingSystem: 'latn').
 */
export function formatDay(
  dateInput: Date | string | number,
  locale: string = 'en'
): string {
  const isAr = locale.startsWith('ar');
  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;

  const now = new Date();
  const dYear = date.getFullYear();
  const dMonth = date.getMonth();
  const dDate = date.getDate();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dYear, dMonth, dDate);

  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  // Date format e.g. "Monday, Oct 5" or "الإثنين 5 أكتوبر"
  const weekdayFormatter = new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-EG', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    numberingSystem: 'latn',
  });
  const formattedDayStr = weekdayFormatter.format(date);

  if (diffDays === 0) {
    const label = isAr ? 'النهارده' : 'Today';
    return `${label} · ${formattedDayStr}`;
  }
  if (diffDays === 1) {
    const label = isAr ? 'امبارح' : 'Yesterday';
    return `${label} · ${formattedDayStr}`;
  }

  return formattedDayStr;
}

/**
 * Formats YYYY-MM as a localized month and year with Western digits.
 * Example:
 *   formatMonth('2026-10', 'en') => "October 2026"
 *   formatMonth('2026-10', 'ar') => "أكتوبر 2026"
 */
export function formatMonth(
  yearMonth: string,
  locale: string = 'en'
): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const date = new Date(year, month - 1, 1);
  const isAr = locale.startsWith('ar');

  return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-EG', {
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(date);
}

/**
 * Shifts a YYYY-MM string by delta months (+1 or -1).
 * Example:
 *   shiftMonth('2026-10', 1) => "2026-11"
 *   shiftMonth('2026-01', -1) => "2025-12"
 */
export function shiftMonth(yearMonth: string, delta: number): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const date = new Date(year, month - 1 + delta, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}


/**
 * Today's date (or the given date) as YYYY-MM-DD in the phone's local time zone.
 * Never use `toISOString().slice(0, 10)` for this: that is UTC and, in Cairo,
 * lands on yesterday between midnight and 3 am (PLAN.md · Offline strategy rule 12).
 */
export function localISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

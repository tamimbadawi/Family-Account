/**
 * Currencies a family can choose (docs/MULTI-FAMILY.md): any ISO 4217 code, 1 or 2 per family.
 * English shows the code ("USD"), Arabic a familiar symbol where there is one ("$", "ج.م").
 */

/** Shown first in the picker; everything else follows alphabetically by name. */
export const COMMON_CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD'] as const;

const ARABIC_SYMBOLS: Record<string, string> = {
  EGP: 'ج.م',
  USD: '$',
  EUR: '€',
  GBP: '£',
  SAR: 'ر.س',
  AED: 'د.إ',
  KWD: 'د.ك',
  QAR: 'ر.ق',
  BHD: 'د.ب',
  OMR: 'ر.ع',
  JOD: 'د.أ',
};

export const DEFAULT_CURRENCY = 'EGP';

export function isCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/** Label written next to an amount: "EGP" / "ج.م", "USD" / "$". */
export function currencySymbol(code: string = DEFAULT_CURRENCY, locale: string = 'en'): string {
  const upper = code.toUpperCase();
  if (locale.startsWith('ar')) return ARABIC_SYMBOLS[upper] ?? upper;
  return upper;
}

/** The currency's name in the app language, e.g. "US Dollar" / "دولار أمريكي". */
export function currencyName(code: string, locale: string = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface CurrencyChoice {
  code: string;
  name: string;
}

/** Every currency the phone knows, common ones first. Falls back to the common list on old phones. */
export function currencyChoices(locale: string = 'en'): CurrencyChoice[] {
  let all: string[] = [...COMMON_CURRENCIES];
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    if (supported) all = supported('currency');
  } catch {
    // keep the common list
  }
  const common = new Set<string>(COMMON_CURRENCIES);
  const rest = all
    .filter((c) => !common.has(c))
    .map((code) => ({ code, name: currencyName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return [...COMMON_CURRENCIES.map((code) => ({ code, name: currencyName(code, locale) })), ...rest];
}

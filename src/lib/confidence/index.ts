import type { Bank, Confidence, Fund, Manager, Offer } from '../market/types';
import sourceNamesData from './source-names.json';

export const KNOWN_SOURCES: Record<string, { en: string; ar?: string }> = sourceNamesData;

export const KNOWN_SOURCE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(KNOWN_SOURCES).map(([k, v]) => [k, v.en])
);

/**
 * Reduce any date input (ISO string, timestamp, Date) to a calendar date
 * in the Africa/Cairo time zone at UTC midnight.
 */
export function toCairoCalendarDate(dateInput: string | Date = new Date()): Date | null {
  let dateObj: Date;
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const year = Number(ymdMatch[1]);
      const month = Number(ymdMatch[2]);
      const day = Number(ymdMatch[3]);
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    }
    dateObj = new Date(trimmed);
  } else {
    dateObj = dateInput;
  }

  if (Number.isNaN(dateObj.getTime())) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(dateObj);
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);

    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  } catch {
    return null;
  }
}

function extractHost(urlStr: string | null | undefined): string | null {
  if (!urlStr) return null;
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return url.hostname.toLowerCase().replace(/^www\./i, '');
  } catch {
    const withoutProto = trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    return withoutProto.split('/')[0].split('?')[0].split('#')[0].toLowerCase() || null;
  }
}

function resolveSourceName(hostOrName: string, locale: 'en' | 'ar'): string {
  const clean = hostOrName.trim();
  const host = extractHost(clean) || clean.toLowerCase();
  const entry = KNOWN_SOURCES[host];
  if (entry) {
    if (locale === 'ar' && entry.ar) {
      return entry.ar;
    }
    return entry.en;
  }
  return clean;
}

/**
 * Computes readable source names from sources array or sourceUrl host.
 * If locale === 'ar', returns the bank's Arabic name when available;
 * hosts without a bank match (aggregators, uncatalogued hosts) return their Latin name or host.
 */
export function sourceNames(
  row: {
    sources?: string[];
    sourceUrl?: string | null;
  },
  locale: 'en' | 'ar' = 'en'
): string[] {
  if (!row) return [];

  const rawSources = row.sources && row.sources.length > 0 ? row.sources : [];

  if (rawSources.length > 0) {
    return rawSources.map((source) => resolveSourceName(source, locale));
  }

  const host = extractHost(row.sourceUrl);
  if (host) {
    return [resolveSourceName(host, locale)];
  }

  return [];
}

/**
 * Determines whether a row is a fund or an offer.
 * Funds have 7 days freshness limit; certificates/bills have 30 days limit.
 */
export function isFundRow(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  return 'fundType' in row || 'price' in row;
}

/**
 * Applies the out-of-date limits from docs/PLAN.md §4:
 * 7 days for funds, 30 days for certificates and treasury bills.
 * Reduces `today` to a calendar date in Africa/Cairo before calculating day difference.
 * A missing or unparseable publishedOn returns 'stale'.
 * If older than limit, returns 'stale'.
 * Otherwise returns the sheet confidence label.
 */
export function effectiveConfidence(
  row: {
    publishedOn?: string | null;
    confidence?: Confidence;
    type?: string;
    fundType?: string;
    price?: number;
  },
  today: string | Date = new Date()
): Confidence {
  if (!row || !row.publishedOn) return 'stale';

  const baseConfidence: Confidence = row.confidence || 'single';
  if (baseConfidence === 'stale') return 'stale';

  const publishedDate = toCairoCalendarDate(row.publishedOn);
  const todayDate = toCairoCalendarDate(today);

  // Missing or unparseable publishedOn returns 'stale'
  if (!publishedDate || !todayDate) {
    return 'stale';
  }

  const diffMs = todayDate.getTime() - publishedDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Future publishedOn date relative to today in Cairo returns 'stale'
  if (diffDays < 0) {
    return 'stale';
  }

  const limitDays = isFundRow(row) ? 7 : 30;

  if (diffDays > limitDays) {
    return 'stale';
  }

  return baseConfidence;
}

// ---------------- Pure Lookups ----------------

/**
 * Finds the Bank for a given offer (synchronous version when bank list is already in memory).
 */
export function findBankForOffer(offer: Offer, banks: Bank[]): Bank | null {
  if (!offer || !banks) return null;
  const code = (offer.bankCode || '').trim().toLowerCase();
  if (!code) return null;
  return banks.find((b) => b.code.toLowerCase() === code) || null;
}

/**
 * Finds the Manager for a fund by managerAr (synchronous version).
 */
export function findManagerForFund(
  fund: Fund,
  managers: Manager[]
): Manager | null {
  if (!fund || !managers) return null;
  const managerAr = (fund.managerAr || '').trim();
  if (!managerAr) return null;
  return managers.find((m) => m.managerAr.trim() === managerAr) || null;
}

/**
 * Finds all products (certificates and treasury bills) of a bank (synchronous version).
 */
export function findBankProducts(bankCode: string, offers: Offer[]): Offer[] {
  if (!bankCode || !offers) return [];
  const code = bankCode.trim().toLowerCase();
  return offers.filter((o) => (o.bankCode || '').toLowerCase() === code);
}

import { z } from 'zod';
import type { Bank, Confidence, Fund, Manager, Offer } from './types';

export function extractHostFromUrl(urlStr: string | null | undefined): string | null {
  if (!urlStr || urlStr.trim() === '') return null;
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

export function parseSources(sourcesStr: string | undefined, sourceUrl: string | null): string[] {
  if (sourcesStr && sourcesStr.trim() !== '') {
    const list = sourcesStr
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length > 0) return list;
  }
  const host = extractHostFromUrl(sourceUrl);
  return host ? [host] : [];
}

export const CONFIDENCE_VALUES = ['confirmed', 'single', 'differ', 'stale'] as const;
export const HANDLED_OFFER_TYPES = ['certificate', 'tbill', 'tbond'] as const;
export const HANDLED_RATE_KINDS = ['fixed', 'variable', 'stepped'] as const;
export const HANDLED_FUND_TYPES = [
  'money_market',
  'fixed_income',
  'equity',
  'balanced',
  'gold',
  'other',
] as const;
export const HANDLED_RISKS = ['low', 'medium', 'high'] as const;
export const HANDLED_CURRENCIES = ['EGP', 'USD', 'EUR'] as const;
export const HANDLED_ACTIVE = ['TRUE', 'FALSE'] as const;
export const HANDLED_SHARIA = ['TRUE', 'FALSE'] as const;

export function parseConfidence(confidenceStr: string | undefined): Confidence {
  if (
    confidenceStr &&
    CONFIDENCE_VALUES.includes(confidenceStr.trim().toLowerCase() as Confidence)
  ) {
    return confidenceStr.trim().toLowerCase() as Confidence;
  }
  return 'single';
}

/**
 * Raw Offer schema from CSV row
 */
export const rawOfferSchema = z
  .object({
    id: z.string().trim().min(1, 'Offer id is required'),
    bank_en: z.string().default(''),
    bank_ar: z.string().default(''),
    name_en: z.string().default(''),
    name_ar: z.string().default(''),
    type: z.string().trim().min(1, 'Type is required'),
    rate_percent: z
      .string()
      .trim()
      .min(1, 'rate_percent is required')
      .transform((val, ctx) => {
        const clean = val.replace(/,/g, '');
        const n = Number(clean);
        if (Number.isNaN(n)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'rate_percent must be a valid number',
          });
          return z.NEVER;
        }
        return n;
      }),
    rate_kind: z.string().trim().min(1, 'rate_kind is required'),
    rate_note_en: z.string().default(''),
    rate_note_ar: z.string().default(''),
    term_months: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || val.trim() === '') return null;
        const n = Number(val.replace(/,/g, '').trim());
        return Number.isNaN(n) ? null : n;
      }),
    payout: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    min_amount: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || val.trim() === '') return null;
        const n = Number(val.replace(/,/g, '').trim());
        return Number.isNaN(n) ? null : n;
      }),
    source_url: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    checked_on: z.string().default(''),
    active: z.string().default(''),
    country: z.string().default(''),
    currency: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : 'EGP')),
    sources: z.string().optional(),
    published_on: z.string().optional(),
    confidence: z.string().optional(),
    term_days: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || val.trim() === '') return null;
        const n = Number(val.replace(/,/g, '').trim());
        return Number.isNaN(n) ? null : n;
      }),
  })
  .refine(
    (row) => row.name_en.trim() !== '' || row.name_ar.trim() !== '',
    'At least one offer name is required'
  );

export function transformOffer(raw: z.infer<typeof rawOfferSchema>): Offer {
  const bankCode = raw.id.includes('-')
    ? raw.id.slice(0, raw.id.indexOf('-'))
    : raw.id.startsWith('tbill')
      ? 'tbill'
      : raw.id;

  const publishedOn =
    raw.published_on && raw.published_on.trim() !== ''
      ? raw.published_on.trim()
      : raw.checked_on.trim();

  return {
    id: raw.id,
    bankCode,
    bankEn: raw.bank_en.trim(),
    bankAr: raw.bank_ar.trim(),
    nameEn: raw.name_en.trim(),
    nameAr: raw.name_ar.trim(),
    type: raw.type.trim(),
    ratePercent: raw.rate_percent,
    rateKind: raw.rate_kind.trim(),
    rateNoteEn: raw.rate_note_en.trim(),
    rateNoteAr: raw.rate_note_ar.trim(),
    termMonths: raw.term_months,
    termDays: raw.term_days ?? null,
    payout: raw.payout,
    minAmount: raw.min_amount,
    currency: raw.currency,
    sourceUrl: raw.source_url,
    sources: parseSources(raw.sources, raw.source_url),
    publishedOn,
    confidence: parseConfidence(raw.confidence),
    country: raw.country.trim().toUpperCase(),
  };
}

/**
 * Raw Fund schema from CSV row
 */
export const rawFundSchema = z
  .object({
    id: z.string().trim().min(1, 'Fund id is required'),
    fund_en: z.string().default(''),
    fund_ar: z.string().default(''),
    manager_en: z.string().default(''),
    manager_ar: z.string().default(''),
    fund_type: z.string().trim().min(1, 'fund_type is required'),
    currency: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : 'EGP')),
    price: z
      .string()
      .trim()
      .min(1, 'price is required')
      .transform((val, ctx) => {
        const clean = val.replace(/,/g, '');
        const n = Number(clean);
        if (Number.isNaN(n)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'price must be a valid number',
          });
          return z.NEVER;
        }
        return n;
      }),
    price_date: z.string().optional(),
    change_30d_percent: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || val.trim() === '') return null;
        const n = Number(val.replace(/,/g, '').trim());
        return Number.isNaN(n) ? null : n;
      }),
    change_ytd_percent: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || val.trim() === '') return null;
        const n = Number(val.replace(/,/g, '').trim());
        return Number.isNaN(n) ? null : n;
      }),
    risk: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    sharia: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || val.trim() === '') return null;
        return val.trim().toUpperCase() === 'TRUE';
      }),
    source_url: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    checked_on: z.string().default(''),
    active: z.string().default(''),
    country: z.string().default(''),
    sources: z.string().optional(),
    published_on: z.string().optional(),
    confidence: z.string().optional(),
  })
  .refine(
    (row) => row.fund_en.trim() !== '' || row.fund_ar.trim() !== '',
    'At least one fund name is required'
  );

export function transformFund(raw: z.infer<typeof rawFundSchema>): Fund {
  const publishedOn =
    raw.published_on && raw.published_on.trim() !== ''
      ? raw.published_on.trim()
      : raw.price_date && raw.price_date.trim() !== ''
        ? raw.price_date.trim()
        : raw.checked_on.trim();

  return {
    id: raw.id,
    fundEn: raw.fund_en.trim(),
    fundAr: raw.fund_ar.trim(),
    managerEn: raw.manager_en.trim(),
    managerAr: raw.manager_ar.trim(),
    fundType: raw.fund_type.trim(),
    currency: raw.currency,
    price: raw.price,
    change30dPercent: raw.change_30d_percent,
    changeYtdPercent: raw.change_ytd_percent,
    risk: raw.risk,
    sharia: raw.sharia,
    sourceUrl: raw.source_url,
    sources: parseSources(raw.sources, raw.source_url),
    publishedOn,
    confidence: parseConfidence(raw.confidence),
    country: raw.country.trim().toUpperCase(),
  };
}

/**
 * Raw Bank schema from CSV row
 */
export const rawBankSchema = z
  .object({
    code: z.string().trim().min(1, 'Bank code is required'),
    bank_en: z.string().trim().min(1, 'bank_en is required'),
    bank_ar: z.string().trim().min(1, 'bank_ar is required'),
    hotline: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    website: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    logo_url: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    source_url: z.string().optional(),
    checked_on: z.string().default(''),
    logo: z.string().optional(),
    country: z.string().default(''),
    active: z.string().optional(),
  });

export function transformBank(raw: z.infer<typeof rawBankSchema>): Bank {
  return {
    code: raw.code.trim(),
    bankEn: raw.bank_en.trim(),
    bankAr: raw.bank_ar.trim(),
    hotline: raw.hotline,
    website: raw.website,
    logoUrl: raw.logo_url,
    sourceUrl: raw.source_url?.trim() || null,
    checkedOn: raw.checked_on.trim(),
  };
}

/**
 * Raw Manager schema from CSV row
 */
export const rawManagerSchema = z
  .object({
    manager_ar: z.string().trim().min(1, 'manager_ar is required'),
    manager_en: z.string().trim().min(1, 'manager_en is required'),
    phone: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    website: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    logo_url: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
    source_url: z.string().optional(),
    checked_on: z.string().default(''),
    country: z.string().default(''),
    active: z.string().optional(),
  });

export function transformManager(raw: z.infer<typeof rawManagerSchema>): Manager {
  return {
    managerAr: raw.manager_ar.trim(),
    managerEn: raw.manager_en.trim(),
    phone: raw.phone,
    website: raw.website,
    logoUrl: raw.logo_url,
    sourceUrl: raw.source_url?.trim() || null,
    checkedOn: raw.checked_on.trim(),
  };
}

import { effectiveConfidence, sourceNames } from '../confidence';
import type { Offer } from '../market/types';
import { type CalcResult, calculate } from './index';

export type ComparisonPropertyId =
  | 'rate'
  | 'kind'
  | 'term'
  | 'payout'
  | 'minimum'
  | 'perPayout'
  | 'totalReturn'
  | 'source'
  | 'date'
  | 'confidence';

export type ComparisonValue = number | string | string[] | null;

export interface ComparisonRow {
  property: ComparisonPropertyId;
  values: ComparisonValue[];
  differs: boolean;
}

export type ProductCalcStatus =
  | { ok: true }
  | { ok: false; reason: 'noAmount' }
  | { ok: false; reason: 'belowMinimum'; minAmount: number }
  | { ok: false; reason: 'notCalculable'; minAmount?: number };

export interface ComparisonResult {
  offers: Offer[];
  amount: number | null;
  rows: ComparisonRow[];
  status: ProductCalcStatus[];
  calculations: (CalcResult | null)[];
}

function checkDiffers(vals: unknown[]): boolean {
  if (vals.length <= 1) return false;
  const first = JSON.stringify(vals[0]);
  return vals.some((v) => JSON.stringify(v) !== first);
}

/**
 * Builds comparison matrix for up to three offers.
 * Strictly never names a winner and never sorts by "better".
 * Preserves the exact input order of offers.
 * Values are raw (number | string | string[] | null), never formatted strings.
 * Confidence row uses effectiveConfidence(offer, today) and source row uses sourceNames(offer).
 */
export function buildComparison(
  offers: Offer[],
  amount?: number | null,
  today: string | Date = new Date(),
  locale: 'en' | 'ar' = 'en'
): ComparisonResult {
  if (!offers || offers.length === 0) {
    return {
      offers: [],
      amount: amount ?? null,
      rows: [],
      status: [],
      calculations: [],
    };
  }

  const validAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : null;

  const calculations: (CalcResult | null)[] = offers.map((offer) => {
    if (validAmount === null) return null;
    return calculate(offer, validAmount);
  });

  const status: ProductCalcStatus[] = offers.map((offer, idx) => {
    const calc = calculations[idx];
    if (validAmount === null || validAmount <= 0) {
      return { ok: false, reason: 'noAmount' };
    }
    if (!calc) {
      return { ok: false, reason: 'notCalculable' };
    }
    if (calc.ok) {
      return { ok: true };
    }
    if (calc.reason === 'belowMinimum') {
      return { ok: false, reason: 'belowMinimum', minAmount: calc.minAmount };
    }
    if (calc.reason === 'noAmount') {
      return { ok: false, reason: 'noAmount' };
    }
    return { ok: false, reason: 'notCalculable', minAmount: calc.minAmount };
  });

  const rows: ComparisonRow[] = [
    {
      property: 'rate',
      values: offers.map((o) => (typeof o.ratePercent === 'number' ? o.ratePercent : null)),
      differs: checkDiffers(offers.map((o) => o.ratePercent)),
    },
    {
      property: 'kind',
      values: offers.map((o) => o.rateKind || null),
      differs: checkDiffers(offers.map((o) => o.rateKind)),
    },
    {
      property: 'term',
      values: offers.map((o) => (typeof o.termMonths === 'number' ? o.termMonths : null)),
      differs: checkDiffers(offers.map((o) => o.termMonths)),
    },
    {
      property: 'payout',
      values: offers.map((o) => o.payout || null),
      differs: checkDiffers(offers.map((o) => o.payout)),
    },
    {
      property: 'minimum',
      values: offers.map((o) => (typeof o.minAmount === 'number' ? o.minAmount : null)),
      differs: checkDiffers(offers.map((o) => o.minAmount)),
    },
    {
      property: 'perPayout',
      values: calculations.map((c) => (c && c.ok ? c.perPayout : null)),
      differs: checkDiffers(calculations.map((c) => (c && c.ok ? c.perPayout : null))),
    },
    {
      property: 'totalReturn',
      values: calculations.map((c) => (c && c.ok ? c.totalReturn : null)),
      differs: checkDiffers(calculations.map((c) => (c && c.ok ? c.totalReturn : null))),
    },
    {
      property: 'source',
      values: offers.map((o) => sourceNames(o, locale)),
      differs: checkDiffers(offers.map((o) => sourceNames(o, locale))),
    },
    {
      property: 'date',
      values: offers.map((o) => o.publishedOn || null),
      differs: checkDiffers(offers.map((o) => o.publishedOn)),
    },
    {
      property: 'confidence',
      values: offers.map((o) => effectiveConfidence(o, today)),
      differs: checkDiffers(offers.map((o) => effectiveConfidence(o, today))),
    },
  ];

  return {
    offers,
    amount: validAmount,
    rows,
    status,
    calculations,
  };
}

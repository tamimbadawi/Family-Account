// Copied from the bank-offers app (src/lib/calc/index.ts). Keep the two in step.
import type { Offer } from './types';


export type CalcAssumption =
  | 'variable'
  | 'firstYearOnly'
  | 'beforeTax'
  | 'dailyApprox';

export type StepTarget =
  | { kind: 'year'; index: number }
  | { kind: 'term'; months: number };

export interface CalcStep {
  target: StepTarget;
  rate: number;
  amount: number;
  perPayout: number;
  payoutsCount: number;
}

export type CalcResult =
  | {
      ok: true;
      perPayout: number | null;
      payoutsCount: number;
      payout: string;
      totalReturn: number;
      endAmount: number;
      steps: CalcStep[];
      assumptions: CalcAssumption[];
    }
  | {
      ok: false;
      reason: 'noAmount';
    }
  | {
      ok: false;
      reason: 'belowMinimum';
      minAmount: number;
    }
  | {
      ok: false;
      reason: 'notCalculable';
      minAmount?: number;
    };

export const HANDLED_PAYOUTS = [
  'daily',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
  'maturity',
] as const;

function getMonthsPerPeriod(payout: string, termMonths: number): number | null {
  const norm = payout.trim().toLowerCase();
  switch (norm) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    case 'yearly':
      return 12;
    case 'maturity':
      return termMonths;
    default:
      return null;
  }
}

/**
 * Parses yearly rates from rateNoteEn, e.g.:
 * "22% year 1, 17.5% year 2, 13% year 3"
 * Returns array of rates indexed by year [year1Rate, year2Rate, ...] if all years match,
 * otherwise returns null.
 */
export function parseSteppedRates(
  note: string,
  totalYears: number
): number[] | null {
  if (!note || totalYears <= 0) return null;

  const rates: (number | undefined)[] = [];

  const regex1 = /(\d+(?:\.\d+)?)\s*%\s*(?:in\s*|for\s*)?year\s*(\d+)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex1.exec(note)) !== null) {
    const rate = Number(match[1]);
    const year = Number(match[2]);
    if (!Number.isNaN(rate) && !Number.isNaN(year) && year >= 1 && year <= totalYears) {
      rates[year - 1] = rate;
    }
  }

  const regex2 = /year\s*(\d+)[^%\d]*(\d+(?:\.\d+)?)\s*%/gi;
  while ((match = regex2.exec(note)) !== null) {
    const year = Number(match[1]);
    const rate = Number(match[2]);
    if (!Number.isNaN(rate) && !Number.isNaN(year) && year >= 1 && year <= totalYears) {
      if (rates[year - 1] === undefined) {
        rates[year - 1] = rate;
      }
    }
  }

  // Verify all years from 1 to totalYears have been parsed
  for (let y = 0; y < totalYears; y++) {
    if (rates[y] === undefined) {
      return null;
    }
  }

  return rates as number[];
}

/**
 * Pure calculator function per docs/PLAN.md §5.
 * Never rounds until display.
 */
export function calculate(offer: unknown, amount: number): CalcResult {
  // Funds are never calculated, or missing/invalid offer
  if (!offer || typeof offer !== 'object') {
    return { ok: false, reason: 'notCalculable' };
  }

  // Zero, negative, NaN or non-finite amount returns noAmount
  if (
    typeof amount !== 'number' ||
    Number.isNaN(amount) ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return { ok: false, reason: 'noAmount' };
  }

  const o = offer as Partial<Offer>;

  // Must have a valid rate
  if (
    typeof o.ratePercent !== 'number' ||
    Number.isNaN(o.ratePercent) ||
    o.ratePercent <= 0
  ) {
    return { ok: false, reason: 'notCalculable' };
  }

  // Check minimum amount
  const min = o.minAmount != null ? o.minAmount : 0;
  if (amount < min) {
    return { ok: false, reason: 'belowMinimum', minAmount: min };
  }

  const payoutRaw = o.payout?.trim().toLowerCase() || '';

  const assumptions: CalcAssumption[] = [];
  const steps: CalcStep[] = [];

  // Treasury Bills
  if (o.type === 'tbill') {
    let days: number | null = o.termDays ?? null;
    if (days == null && o.id) {
      const match = o.id.match(/-(\d+)d\b/i) || o.id.match(/^tbill-(\d+)d/i);
      if (match) {
        days = Number(match[1]);
      }
    }

    if (days == null || Number.isNaN(days) || days <= 0) {
      return { ok: false, reason: 'notCalculable' };
    }

    assumptions.push('beforeTax');
    const totalReturn = amount * (o.ratePercent / 100) * (days / 365);
    const endAmount = amount + totalReturn;
    const termMonths = o.termMonths ?? Math.round(days / 30);

    steps.push({
      target: { kind: 'term', months: termMonths },
      rate: o.ratePercent,
      amount: totalReturn,
      perPayout: totalReturn,
      payoutsCount: 1,
    });

    return {
      ok: true,
      perPayout: totalReturn,
      payoutsCount: 1,
      payout: o.payout || 'maturity',
      totalReturn,
      endAmount,
      steps,
      assumptions,
    };
  }

  // Offer must have valid termMonths and payout for non-tbill
  if (
    typeof o.termMonths !== 'number' ||
    Number.isNaN(o.termMonths) ||
    o.termMonths <= 0 ||
    !payoutRaw
  ) {
    return { ok: false, reason: 'notCalculable' };
  }

  const termMonths = o.termMonths;

  // Daily payout: rate / 365 per day, count in days, plus assumption 'dailyApprox'
  if (payoutRaw === 'daily') {
    assumptions.push('dailyApprox');
    if (o.rateKind === 'variable') {
      assumptions.push('variable');
    }

    const days = o.termDays ?? Math.round((termMonths / 12) * 365);
    const perPayout = (amount * (o.ratePercent / 100)) / 365;
    const payoutsCount = days;
    const totalReturn = perPayout * payoutsCount;
    const endAmount = amount + totalReturn;

    steps.push({
      target: { kind: 'term', months: termMonths },
      rate: o.ratePercent,
      amount: totalReturn,
      perPayout,
      payoutsCount,
    });

    return {
      ok: true,
      perPayout,
      payoutsCount,
      payout: o.payout!,
      totalReturn,
      endAmount,
      steps,
      assumptions,
    };
  }

  const monthsPerPeriod = getMonthsPerPeriod(payoutRaw, termMonths);
  if (monthsPerPeriod == null) {
    return { ok: false, reason: 'notCalculable' };
  }

  // Variable CD
  if (o.rateKind === 'variable') {
    assumptions.push('variable');
  }

  // Stepped CD
  if (o.rateKind === 'stepped') {
    // Stepped requires at least 1 year (12 months)
    if (termMonths < 12) {
      return { ok: false, reason: 'notCalculable' };
    }

    const isWholeYears = termMonths % 12 === 0;
    const totalYears = Math.floor(termMonths / 12);
    const steppedRates = isWholeYears ? parseSteppedRates(o.rateNoteEn || '', totalYears) : null;

    if (!steppedRates || steppedRates.length === 0) {
      // Cannot parse all years or term is not whole years -> calculate first year only
      assumptions.push('firstYearOnly');
      const year1Rate = o.ratePercent;

      if (payoutRaw === 'maturity') {
        const perPayout = amount * (year1Rate / 100);
        const totalReturn = perPayout;
        const endAmount = amount + totalReturn;

        steps.push({
          target: { kind: 'year', index: 1 },
          rate: year1Rate,
          amount: totalReturn,
          perPayout,
          payoutsCount: 1,
        });

        return {
          ok: true,
          perPayout,
          payoutsCount: 1,
          payout: o.payout!,
          totalReturn,
          endAmount,
          steps,
          assumptions,
        };
      }

      const payoutsInYear1 = 12 / monthsPerPeriod;
      const perPayout = amount * (year1Rate / 100) * (monthsPerPeriod / 12);
      const totalReturn = perPayout * payoutsInYear1;
      const endAmount = amount + totalReturn;

      steps.push({
        target: { kind: 'year', index: 1 },
        rate: year1Rate,
        amount: totalReturn,
        perPayout,
        payoutsCount: payoutsInYear1,
      });

      return {
        ok: true,
        perPayout,
        payoutsCount: payoutsInYear1,
        payout: o.payout!,
        totalReturn,
        endAmount,
        steps,
        assumptions,
      };
    }

    // All years parsed
    if (payoutRaw === 'maturity') {
      let totalReturn = 0;
      for (let y = 0; y < steppedRates.length; y++) {
        const yearRate = steppedRates[y];
        const yearReturn = amount * (yearRate / 100);
        totalReturn += yearReturn;

        steps.push({
          target: { kind: 'year', index: y + 1 },
          rate: yearRate,
          amount: yearReturn,
          perPayout: yearReturn,
          payoutsCount: 1,
        });
      }

      const endAmount = amount + totalReturn;

      return {
        ok: true,
        perPayout: totalReturn,
        payoutsCount: 1,
        payout: o.payout!,
        totalReturn,
        endAmount,
        steps,
        assumptions,
      };
    }

    let totalReturn = 0;
    let totalPayoutsCount = 0;
    const payoutsInYear = 12 / monthsPerPeriod;

    for (let y = 0; y < steppedRates.length; y++) {
      const yearRate = steppedRates[y];
      const stepPerPayout = amount * (yearRate / 100) * (monthsPerPeriod / 12);
      const yearReturn = stepPerPayout * payoutsInYear;
      totalReturn += yearReturn;
      totalPayoutsCount += payoutsInYear;

      steps.push({
        target: { kind: 'year', index: y + 1 },
        rate: yearRate,
        amount: yearReturn,
        perPayout: stepPerPayout,
        payoutsCount: payoutsInYear,
      });
    }

    const endAmount = amount + totalReturn;
    // Check if perPayout is constant over the term
    const allSameRate = steppedRates.every((r) => r === steppedRates[0]);
    const topLevelPerPayout = allSameRate ? steps[0].perPayout : null;

    return {
      ok: true,
      perPayout: topLevelPerPayout,
      payoutsCount: totalPayoutsCount,
      payout: o.payout!,
      totalReturn,
      endAmount,
      steps,
      assumptions,
    };
  }

  // Fixed CD (and Variable CD)
  if (payoutRaw === 'maturity') {
    const totalReturn = amount * (o.ratePercent / 100) * (termMonths / 12);
    const endAmount = amount + totalReturn;
    steps.push({
      target: { kind: 'term', months: termMonths },
      rate: o.ratePercent,
      amount: totalReturn,
      perPayout: totalReturn,
      payoutsCount: 1,
    });

    return {
      ok: true,
      perPayout: totalReturn,
      payoutsCount: 1,
      payout: o.payout!,
      totalReturn,
      endAmount,
      steps,
      assumptions,
    };
  }

  const payoutsCount = termMonths / monthsPerPeriod;
  const perPayout = amount * (o.ratePercent / 100) * (monthsPerPeriod / 12);
  const totalReturn = amount * (o.ratePercent / 100) * (termMonths / 12);
  const endAmount = amount + totalReturn;

  const totalYears = termMonths / 12;
  if (totalYears >= 1 && Number.isInteger(totalYears)) {
    const payoutsInYear = 12 / monthsPerPeriod;
    const yearlyAmount = amount * (o.ratePercent / 100);
    for (let y = 1; y <= totalYears; y++) {
      steps.push({
        target: { kind: 'year', index: y },
        rate: o.ratePercent,
        amount: yearlyAmount,
        perPayout,
        payoutsCount: payoutsInYear,
      });
    }
  } else {
    steps.push({
      target: { kind: 'term', months: termMonths },
      rate: o.ratePercent,
      amount: totalReturn,
      perPayout,
      payoutsCount,
    });
  }

  return {
    ok: true,
    perPayout,
    payoutsCount,
    payout: o.payout!,
    totalReturn,
    endAmount,
    steps,
    assumptions,
  };
}

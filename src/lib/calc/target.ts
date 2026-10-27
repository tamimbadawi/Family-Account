import type { Fund, Offer } from '../market/types';
import { calculate, type CalcResult } from './index';
import { calculateFund, isFund, type FundCalcResult, type FundCalcOptions } from './fund';

export type TargetKind = 'perPayout' | 'perMonth' | 'totalReturn';

const MONTHS_PER_PERIOD: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };

export type TargetResult =
  | {
      ok: true;
      /** Amount needed, rounded up to the whole unit and never below the product's minimum. */
      amount: number;
      /** The period the answer is given in: 'month' for perMonth on a monthly product, otherwise the product's payout. */
      period: string;
      /** Target in that period (a monthly target becomes, say, three months' worth for a quarterly product). */
      periodTarget: number;
      /** True when the minimum is above what the target needs; amount is then the minimum. */
      minimumApplies: boolean;
      termMonths: number | null;
      /** Ordinary calculator result for `amount`, so the screen can show the working. */
      result: CalcResult | FundCalcResult;
    }
  | { ok: false; reason: 'noTarget' | 'notCalculable' | 'cannotReach' };

function payoutOf(o: Offer): string {
  return (o.type === 'tbill' ? o.payout || 'maturity' : o.payout || '').trim().toLowerCase();
}

function metric(r: CalcResult, kind: 'perPayout' | 'totalReturn'): number | null {
  if (!r.ok) return null;
  if (kind === 'totalReturn') return r.totalReturn;
  // Stepped: the first year's rate (its result lists what each later year pays).
  return r.perPayout ?? r.steps[0]?.perPayout ?? null;
}

function offerAmountFor(target: number, kind: TargetKind, offer: Offer): TargetResult {
  const payout = payoutOf(offer);
  let period = payout;
  let periodTarget = target;
  let m: 'perPayout' | 'totalReturn' = kind === 'totalReturn' ? 'totalReturn' : 'perPayout';

  if (kind === 'perMonth') {
    if (payout === 'monthly') {
      period = 'month';
    } else if (MONTHS_PER_PERIOD[payout]) {
      periodTarget = target * MONTHS_PER_PERIOD[payout];
    } else if (payout === 'daily') {
      periodTarget = (target * 12) / 365;
    } else {
      // Pays once at the end: a month's worth for every month of the term.
      const months = offer.termMonths ?? (offer.termDays ? offer.termDays / (365 / 12) : null);
      if (!months) return { ok: false, reason: 'notCalculable' };
      periodTarget = target * months;
      m = 'totalReturn';
    }
  }
  if (kind === 'totalReturn') period = 'term';

  // The calculator is linear in the amount: work out the figure for a reference amount and turn it round.
  const ref = Math.max(offer.minAmount ?? 0, 1_000_000);
  const refFigure = metric(calculate(offer, ref), m);
  if (refFigure == null || !(refFigure > 0)) return { ok: false, reason: 'notCalculable' };

  let amount = Math.ceil(periodTarget / (refFigure / ref) - 1e-9);
  // Guard against floating error: the target must be met.
  for (let i = 0; i < 3; i++) {
    const got = metric(calculate(offer, amount), m);
    if (got != null && got + 1e-9 >= periodTarget) break;
    amount += 1;
  }
  const min = offer.minAmount ?? 0;
  const minimumApplies = amount < min;
  if (minimumApplies) amount = Math.ceil(min);

  return {
    ok: true,
    amount,
    period,
    periodTarget,
    minimumApplies,
    termMonths: offer.termMonths ?? (offer.termDays ? Math.round(offer.termDays / 30) : null),
    result: calculate(offer, amount),
  };
}

function fundAmountFor(target: number, kind: TargetKind, fund: Fund, opts: FundCalcOptions): TargetResult {
  const probe = calculateFund(fund, 1, opts);
  if (!probe.ok || probe.yearlyPercent == null || probe.horizonYears === 0) return { ok: false, reason: 'notCalculable' };
  const r = probe.yearlyPercent / 100;
  if (r <= 0) return { ok: false, reason: 'cannotReach' };
  const years = probe.horizonYears;
  let amount: number;
  let period: string;
  if (kind === 'totalReturn') {
    // target / ((1 + r)^years − 1)
    amount = Math.ceil(target / (Math.pow(1 + r, years) - 1) - 1e-9);
    period = 'term';
  } else {
    // Every month, worked out as selling units: the amount whose estimated first-year gain covers twelve months.
    amount = Math.ceil((target * 12) / (Math.pow(1 + r, 1) - 1) - 1e-9);
    period = 'month';
  }
  return {
    ok: true,
    amount,
    period,
    periodTarget: target,
    minimumApplies: false,
    termMonths: years * 12,
    result: calculateFund(fund, amount, { ...opts, years: kind === 'totalReturn' ? years : 1 }),
  };
}

/**
 * The calculator worked backward (docs/PLAN.md §5 "Target"). Pure: returns data, never copy.
 */
export function amountFor(
  target: number,
  kind: TargetKind,
  product: Offer | Fund,
  opts: FundCalcOptions = {}
): TargetResult {
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) return { ok: false, reason: 'noTarget' };
  if (!product || typeof product !== 'object') return { ok: false, reason: 'notCalculable' };
  return isFund(product) ? fundAmountFor(target, kind, product, opts) : offerAmountFor(target, kind, product as Offer);
}

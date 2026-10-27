import type { Fund, Offer } from '../market/types';
import { calculate } from './index';
import { fundHorizon, isFund } from './fund';

/**
 * The goal planner: "I have X, I want Y, in Z months". Lists every product that gets there in that time
 * (matches, not picks). Pure: returns data, never copy; never ranks, never chooses.
 */

export const PLAN_HORIZONS = [1, 3, 6, 12, 24, 36, 60] as const;
export type PlanHorizon = (typeof PLAN_HORIZONS)[number];

/** How fixed the outcome is. Written rule (How we check):
 *  fixed     — a fixed or stepped certificate, or a treasury bill: the rate is set for the term.
 *  likely    — a variable-rate certificate; a money market or fixed income fund; a fund the sheet marks low risk.
 *  uncertain — any other fund (equity, balanced, gold, other, or marked medium or high risk). */
export type Certainty = 'fixed' | 'likely' | 'uncertain';
export const CERTAINTY_ORDER: Certainty[] = ['fixed', 'likely', 'uncertain'];

export function certaintyOf(p: Offer | Fund): Certainty {
  if (isFund(p)) {
    const risk = (p.risk || '').toLowerCase();
    // Shares and gold move with the markets whatever risk label the row carries.
    if (p.fundType === 'equity' || p.fundType === 'gold') return 'uncertain';
    if (risk === 'medium' || risk === 'high') return 'uncertain';
    if (risk === 'low' || p.fundType === 'money_market' || p.fundType === 'fixed_income') return 'likely';
    return 'uncertain';
  }
  return p.rateKind === 'variable' && p.type !== 'tbill' ? 'likely' : 'fixed';
}

export interface PlanGoal {
  kind: 'amount' | 'percent';
  /** EGP gained (amount) or percent of what you have (percent). */
  value: number;
}

export type PlanRow =
  | {
      ok: true;
      product: Offer | Fund;
      certainty: Certainty;
      /** Money gained by the end of the horizon (payouts received, or the estimated rise in a fund's value). */
      gain: number;
      gainPercent: number;
      reaches: boolean;
      /** Months the money is tied up (an offer's term; for a fund, the horizon itself). */
      months: number;
      currency: string;
    }
  | {
      ok: false;
      product: Offer | Fund;
      certainty: Certainty;
      reason: 'longerThanHorizon' | 'belowMinimum' | 'noEstimate' | 'notCalculable';
      minAmount?: number;
      months?: number;
    };

function offerMonths(o: Offer): number | null {
  if (o.type === 'tbill') {
    const days = o.termDays ?? Number((o.id.match(/(\d+)d\b/i) || [])[1] || 0);
    return days ? days / (365 / 12) : null;
  }
  return o.termMonths ?? null;
}

export function goalGain(amount: number, goal: PlanGoal): number {
  return goal.kind === 'percent' ? (amount * goal.value) / 100 : goal.value;
}

export function planRow(
  p: Offer | Fund,
  amount: number,
  goal: PlanGoal,
  horizonMonths: number,
  ownPercent?: number | null
): PlanRow {
  const certainty = certaintyOf(p);
  const target = goalGain(amount, goal);
  if (isFund(p)) {
    const own = typeof ownPercent === 'number' && Number.isFinite(ownPercent);
    const r = own ? ownPercent! : p.estimate?.estimatePercent ?? null;
    if (r == null) return { ok: false, product: p, certainty, reason: 'noEstimate' };
    const reach = fundHorizon(own ? 'own' : p.estimate?.method ?? 'none', own) * 12;
    if (horizonMonths > reach) return { ok: false, product: p, certainty, reason: 'noEstimate' };
    const gain = Math.floor(amount * Math.pow(1 + r / 100, horizonMonths / 12)) - amount;
    return {
      ok: true,
      product: p,
      certainty,
      gain,
      gainPercent: (gain / amount) * 100,
      reaches: gain >= target,
      months: horizonMonths,
      currency: p.currency || 'EGP',
    };
  }
  const months = offerMonths(p);
  if (months == null) return { ok: false, product: p, certainty, reason: 'notCalculable' };
  // The money must come back within the time asked; nothing is assumed about reinvesting it.
  if (months > horizonMonths + 0.01) return { ok: false, product: p, certainty, reason: 'longerThanHorizon', months };
  const c = calculate(p, amount);
  if (!c.ok) {
    return c.reason === 'belowMinimum'
      ? { ok: false, product: p, certainty, reason: 'belowMinimum', minAmount: c.minAmount }
      : { ok: false, product: p, certainty, reason: 'notCalculable' };
  }
  return {
    ok: true,
    product: p,
    certainty,
    gain: c.totalReturn,
    gainPercent: (c.totalReturn / amount) * 100,
    reaches: c.totalReturn >= target,
    months,
    currency: p.currency || 'EGP',
  };
}

export interface PlanResult {
  rows: PlanRow[];
  /** How many products reach the goal at each horizon in the drop-down, within the certainty chosen. */
  reachByHorizon: Record<number, number>;
  /** The shortest horizon in the drop-down at which at least one product reaches the goal, or null. */
  earliestHorizon: number | null;
}

/** `maxCertainty`: 'fixed' keeps only fixed outcomes; 'likely' keeps fixed and likely; 'uncertain' keeps all. */
export function plan(
  products: (Offer | Fund)[],
  amount: number,
  goal: PlanGoal,
  horizonMonths: number,
  maxCertainty: Certainty = 'uncertain',
  ownPercents: Record<string, number | null | undefined> = {}
): PlanResult {
  const allowed = new Set(CERTAINTY_ORDER.slice(0, CERTAINTY_ORDER.indexOf(maxCertainty) + 1));
  const valid = Number.isFinite(amount) && amount > 0 && Number.isFinite(goal.value) && goal.value > 0;
  const within = products.filter((p) => allowed.has(certaintyOf(p)));
  const rows = valid ? within.map((p) => planRow(p, amount, goal, horizonMonths, ownPercents[p.id])) : [];
  const reachByHorizon: Record<number, number> = {};
  for (const h of PLAN_HORIZONS) {
    reachByHorizon[h] = valid
      ? within.filter((p) => {
          const r = planRow(p, amount, goal, h, ownPercents[p.id]);
          return r.ok && r.reaches;
        }).length
      : 0;
  }
  const earliest = PLAN_HORIZONS.find((h) => reachByHorizon[h] > 0) ?? null;
  return { rows, reachByHorizon, earliestHorizon: earliest };
}

import type { Fund, Offer } from '../market/types';
import { calculate, type CalcResult } from './index';
import { calculateFund, isFund, type FundCalcResult } from './fund';
import { compoundFactor } from './goal';

export const MAX_SPLIT_LINES = 5 as const;

export interface SplitLineInput {
  product: Offer | Fund;
  amount: number;
  /** For a fund line: the person's own yearly figure. */
  ownPercent?: number | null;
}

export interface SplitLine {
  product: Offer | Fund;
  amount: number;
  result: CalcResult | FundCalcResult;
  /** False when the line has no result (below its minimum, no amount, not calculable): left out of every sum. */
  included: boolean;
  /** Year in which the amount comes back (offers), or null. */
  endsInYear: number | null;
  /** A stepped line whose note could not be parsed: years after the first are not published. */
  firstYearOnly: boolean;
}

export interface SplitYear {
  year: number;
  /** Payouts arriving in this year, summed across the certificate and bill lines (EGP). */
  received: number;
  /** Amounts handed back by lines that end in this year (EGP). */
  returned: number;
  /** True when a line's payouts for this year are not published (stepped, first year only). */
  incomplete: boolean;
  /** Estimated fund values at the end of this year, per currency; a change in value is not money received. */
  fundValues: Record<string, number>;
}

export interface SplitResult {
  total: number;
  lines: SplitLine[];
  /** Amount placed, per currency. */
  placed: number;
  /** total − placed; negative when the lines add up to more than the total. */
  left: number;
  years: SplitYear[];
  /** Total received over all the terms (EGP payouts only). */
  totalReceived: number;
  /** Per-month figure, only when every running certificate or bill line pays monthly; else null. */
  perMonth: number | null;
  /** What the included lines are worth at the end of their terms with every payout reinvested (compounded),
   *  plus funds at their estimated value, minus what was placed in them. EGP lines only. */
  gainReinvested: number;
}

/** Each payout's month (1-based, from today) and amount, for an offer line. */
function offerCashflows(offer: Offer, r: Extract<CalcResult, { ok: true }>): { month: number; amount: number }[] {
  const flows: { month: number; amount: number }[] = [];
  const payout = (r.payout || '').toLowerCase();
  if (offer.type === 'tbill') {
    const days = offer.termDays ?? Number((offer.id.match(/(\d+)d\b/i) || [])[1] || 0);
    flows.push({ month: Math.max(1, Math.ceil((days / 365) * 12)), amount: r.totalReturn });
    return flows;
  }
  const term = offer.termMonths ?? 0;
  if (payout === 'maturity') {
    flows.push({ month: term, amount: r.totalReturn });
    return flows;
  }
  if (payout === 'daily') {
    // Spread by month: each month's share of the term's days.
    for (let m = 1; m <= term; m++) flows.push({ month: m, amount: r.totalReturn / term });
    return flows;
  }
  const every = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }[payout] ?? 0;
  if (!every) return flows;
  for (let m = every; m <= term; m += every) {
    const yearIdx = Math.ceil(m / 12) - 1;
    const step = r.steps[yearIdx];
    const per = r.perPayout ?? step?.perPayout ?? 0;
    // firstYearOnly: the result has year 1 only; later payouts are not published.
    if (!step && r.perPayout == null) continue;
    if (r.assumptions.includes('firstYearOnly') && yearIdx > 0) continue;
    flows.push({ month: m, amount: per });
  }
  return flows;
}

/**
 * One amount divided across up to five lines (docs/PLAN.md §5 "Split"). Each line runs through the calculator
 * unchanged. Pure: returns data, never copy. The person sets every amount; nothing is proposed or adjusted.
 */
export function split(total: number, inputs: SplitLineInput[]): SplitResult {
  const safeTotal = typeof total === 'number' && Number.isFinite(total) && total > 0 ? total : 0;
  const lines: SplitLine[] = inputs.slice(0, MAX_SPLIT_LINES).map(({ product, amount, ownPercent }) => {
    const result = isFund(product) ? calculateFund(product, amount, { ownPercent }) : calculate(product, amount);
    const included = result.ok;
    let endsInYear: number | null = null;
    let firstYearOnly = false;
    if (result.ok && !isFund(product) && !('kind' in result)) {
      const o = product as Offer;
      const months = o.type === 'tbill' ? 1 : o.termMonths ?? 0;
      endsInYear = Math.max(1, Math.ceil(months / 12));
      firstYearOnly = result.assumptions.includes('firstYearOnly');
    }
    return { product, amount: Number.isFinite(amount) && amount > 0 ? amount : 0, result, included, endsInYear, firstYearOnly };
  });

  const placed = lines.reduce((s, l) => s + l.amount, 0);
  const byYear = new Map<number, SplitYear>();
  const yearRow = (y: number) => {
    if (!byYear.has(y)) byYear.set(y, { year: y, received: 0, returned: 0, incomplete: false, fundValues: {} });
    return byYear.get(y)!;
  };

  for (const l of lines) {
    if (!l.included) continue;
    if (isFund(l.product)) {
      const r = l.result as Extract<FundCalcResult, { ok: true }>;
      for (const v of r.values) {
        const row = yearRow(v.year);
        row.fundValues[r.currency] = (row.fundValues[r.currency] ?? 0) + v.value;
      }
      continue;
    }
    const r = l.result as Extract<CalcResult, { ok: true }>;
    for (const f of offerCashflows(l.product as Offer, r)) yearRow(Math.ceil(f.month / 12)).received += f.amount;
    yearRow(l.endsInYear!).returned += l.amount;
    if (l.firstYearOnly) for (let y = 2; y <= l.endsInYear!; y++) yearRow(y).incomplete = true;
  }

  const years = [...byYear.values()].sort((a, b) => a.year - b.year);
  const offerLines = lines.filter((l) => l.included && !isFund(l.product));
  const allMonthly =
    offerLines.length > 0 &&
    lines.every((l) => !l.included || (!isFund(l.product) && (l.result as Extract<CalcResult, { ok: true }>).payout?.toLowerCase() === 'monthly'));
  const perMonth = allMonthly
    ? offerLines.reduce((s, l) => {
        const r = l.result as Extract<CalcResult, { ok: true }>;
        return s + (r.perPayout ?? r.steps[0]?.perPayout ?? 0);
      }, 0)
    : null;

  return {
    total: safeTotal,
    lines,
    placed,
    left: safeTotal - placed,
    years,
    totalReceived: years.reduce((s, y) => s + y.received, 0),
    perMonth,
    gainReinvested: lines.reduce((s, l) => {
      if (!l.included || (l.product.currency || 'EGP') !== 'EGP') return s;
      if (isFund(l.product)) {
        const r = l.result as Extract<FundCalcResult, { ok: true }>;
        const last = r.values[r.values.length - 1];
        return last ? s + last.value - l.amount : s;
      }
      const f = compoundFactor(l.product as Offer);
      const r = l.result as Extract<CalcResult, { ok: true }>;
      return s + (f != null ? l.amount * (f - 1) : r.totalReturn);
    }, 0),
  };
}

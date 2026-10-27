import type { Fund, Offer } from '../market/types';

/** A product any tool can take: a certificate or bill (Offer) or a fund. */
export type Product = Offer | Fund;

export function isFund(p: unknown): p is Fund {
  return !!p && typeof p === 'object' && 'fundType' in p && 'price' in p;
}

export function productCurrency(p: Product): string {
  return p.currency || 'EGP';
}

export type FundCalcResult =
  | {
      ok: true;
      kind: 'fund';
      currency: string;
      /** Units the amount buys at the published price, two decimals, rounded down. Published, not estimated. */
      units: number;
      price: number;
      /** What the amount would have gained or lost over the published 30-day and year-to-date changes. */
      change30dMoney: number | null;
      changeYtdMoney: number | null;
      /** The yearly figure used: the person's own when given, otherwise the published estimate; null when none. */
      yearlyPercent: number | null;
      ownFigure: boolean;
      method: string;
      /** Whole years the figure is carried for (docs/PLAN.md §5a "Horizon"). */
      horizonYears: number;
      /** Estimated value at the end of each year 1..horizonYears, rounded down to the whole unit. Empty when no figure. */
      values: { year: number; value: number }[];
    }
  | { ok: false; kind: 'fund'; reason: 'noAmount' | 'notCalculable' };

export interface FundCalcOptions {
  /** A yearly percentage the person typed, used in place of the estimate. */
  ownPercent?: number | null;
  /** Ask for fewer years than the horizon. */
  years?: number;
}

/** Horizon by method: up to 5 years from history, 1 year for ytd and yield; the person's own figure: 5. */
export function fundHorizon(method: string, own: boolean): number {
  if (own) return 5;
  return method === 'history' ? 5 : method === 'ytd' || method === 'yield' ? 1 : 0;
}

function validAmount(a: number): boolean {
  return typeof a === 'number' && Number.isFinite(a) && a > 0;
}

/** amount × (1 + r/100)^years, rounded down to the whole unit. */
export function compoundFund(amount: number, yearlyPercent: number, years: number): number {
  return Math.floor(amount * Math.pow(1 + yearlyPercent / 100, years));
}

export function calculateFund(fund: Fund, amount: number, opts: FundCalcOptions = {}): FundCalcResult {
  if (!isFund(fund) || !(fund.price > 0)) return { ok: false, kind: 'fund', reason: 'notCalculable' };
  if (!validAmount(amount)) return { ok: false, kind: 'fund', reason: 'noAmount' };

  const own = typeof opts.ownPercent === 'number' && Number.isFinite(opts.ownPercent) && opts.ownPercent > -100;
  const published = fund.estimate?.estimatePercent ?? null;
  const method = own ? 'own' : fund.estimate?.method ?? 'none';
  const yearlyPercent = own ? (opts.ownPercent as number) : published;
  let horizonYears = yearlyPercent == null ? 0 : fundHorizon(method, own);
  if (opts.years && opts.years > 0) horizonYears = Math.min(horizonYears, Math.floor(opts.years));

  const values: { year: number; value: number }[] = [];
  if (yearlyPercent != null) {
    for (let y = 1; y <= horizonYears; y++) values.push({ year: y, value: compoundFund(amount, yearlyPercent, y) });
  }

  return {
    ok: true,
    kind: 'fund',
    currency: productCurrency(fund),
    units: Math.floor((amount / fund.price) * 100) / 100,
    price: fund.price,
    change30dMoney: fund.change30dPercent == null ? null : (amount * fund.change30dPercent) / 100,
    changeYtdMoney: fund.changeYtdPercent == null ? null : (amount * fund.changeYtdPercent) / 100,
    yearlyPercent,
    ownFigure: own,
    method,
    horizonYears,
    values,
  };
}

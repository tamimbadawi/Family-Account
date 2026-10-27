import { effectiveConfidence } from '../confidence';
import type { Confidence, Fund, Offer } from '../market/types';
import { calculate, type CalcResult } from './index';
import { calculateFund, isFund, type FundCalcResult } from './fund';
import { compoundFactor } from './goal';

/** A comparison cell: a raw value, `null` for "not published", or `'na'` for "does not apply" to this product. */
export type Cell = number | string | null | 'na';

export type ProductRowId =
  | 'kind'
  | 'rate'
  | 'estimate'
  | 'term'
  | 'payout'
  | 'minimum'
  | 'price'
  | 'change30d'
  | 'changeYtd'
  | 'pays';

export interface ProductRow {
  id: ProductRowId;
  cells: Cell[];
  differs: boolean;
}

export interface ProductColumn {
  product: Offer | Fund;
  isFund: boolean;
  currency: string;
  confidence: Confidence;
  result: CalcResult | FundCalcResult | null;
}

export interface ProductComparison {
  amount: number | null;
  columns: ProductColumn[];
  rows: ProductRow[];
}

function differs(cells: Cell[]): boolean {
  const real = cells.filter((c) => c !== 'na');
  return real.length > 1 && real.some((c) => c !== real[0]);
}

/**
 * Certificates, bills and funds side by side for the same amount (docs/PLAN.md §5a "In the tools").
 * Keeps the input order; never names, sorts or marks a winner. Returns data, never copy.
 */
export function buildProductComparison(
  products: (Offer | Fund)[],
  amount: number | null,
  today: string | Date = new Date(),
  ownPercents: Record<string, number | null | undefined> = {}
): ProductComparison {
  const valid = typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? amount : null;
  const columns: ProductColumn[] = products.map((p) => {
    const fund = isFund(p);
    return {
      product: p,
      isFund: fund,
      currency: p.currency || 'EGP',
      confidence: effectiveConfidence(p, today),
      result: valid == null ? null : fund ? calculateFund(p, valid, { ownPercent: ownPercents[p.id] }) : calculate(p, valid),
    };
  });

  const offerCell = (fn: (o: Offer) => Cell) => (c: ProductColumn): Cell => (c.isFund ? 'na' : fn(c.product as Offer));
  const fundCell = (fn: (f: Fund) => Cell) => (c: ProductColumn): Cell => (c.isFund ? fn(c.product as Fund) : 'na');

  const pays = (c: ProductColumn): Cell => {
    if (!c.result || !c.result.ok) return null;
    if ('kind' in c.result) return c.result.values.length && valid != null ? c.result.values[c.result.values.length - 1].value - valid : null;
    // Payouts reinvested (compounded) over the term; the simple total when the factor cannot be worked out.
    const f = compoundFactor(c.product as Offer);
    return f != null && valid != null ? valid * (f - 1) : c.result.totalReturn;
  };

  const defs: [ProductRowId, (c: ProductColumn) => Cell][] = [
    ['kind', (c) => (c.isFund ? (c.product as Fund).fundType : (c.product as Offer).type)],
    ['rate', offerCell((o) => o.ratePercent ?? null)],
    ['estimate', fundCell((f) => f.estimate?.estimatePercent ?? null)],
    ['term', offerCell((o) => o.termMonths ?? (o.termDays ? Math.round(o.termDays / 30) : null))],
    ['payout', offerCell((o) => o.payout || null)],
    ['minimum', offerCell((o) => o.minAmount ?? null)],
    ['price', fundCell((f) => f.price)],
    ['change30d', fundCell((f) => f.change30dPercent)],
    ['changeYtd', fundCell((f) => f.changeYtdPercent)],
    ['pays', pays],
  ];

  const rows = defs
    .map(([id, fn]) => {
      const cells = columns.map(fn);
      return { id, cells, differs: differs(cells) };
    })
    // A row that applies to none of the chosen products is left out.
    .filter((r) => r.cells.some((c) => c !== 'na'));

  return { amount: valid, columns, rows };
}

import { beforeAll, describe, expect, it } from 'vitest';
import { getFundEstimates, getFunds, getOffers } from '../../market/index';
import type { Fund, Offer } from '../../market/types';
import {
  amountFor,
  buildProductComparison,
  calculate,
  calculateFund,
  compoundFund,
  isFund,
  split,
  type TargetKind,
} from '../index';

const offer = (o: Partial<Offer>): Offer => ({
  id: 'x-fixed-36m-monthly',
  bankCode: 'x',
  bankEn: 'X',
  bankAr: 'X',
  nameEn: 'n',
  nameAr: 'n',
  type: 'certificate',
  ratePercent: 20,
  rateKind: 'fixed',
  rateNoteEn: '',
  rateNoteAr: '',
  termMonths: 36,
  payout: 'monthly',
  minAmount: 1000,
  currency: 'EGP',
  sourceUrl: 'https://x.com',
  sources: ['x.com'],
  publishedOn: '2026-10-13',
  confidence: 'single',
  country: 'EG',
  ...o,
});

const fund = (f: Partial<Fund>): Fund => ({
  id: 'f-1',
  fundEn: 'F',
  fundAr: 'F',
  managerEn: 'M',
  managerAr: 'M',
  fundType: 'equity',
  currency: 'EGP',
  price: 100,
  change30dPercent: 1,
  changeYtdPercent: 10,
  risk: 'high',
  sharia: false,
  sourceUrl: 'https://m.com',
  sources: ['m.com'],
  publishedOn: '2026-10-13',
  confidence: 'single',
  country: 'EG',
  estimate: {
    estimatePercent: 20,
    method: 'history',
    pricesUsed: 156,
    firstDate: '2023-10-13',
    lastDate: '2026-10-13',
    peers: 20,
    computedOn: '2026-10-13',
    modelVersion: 't',
  },
  ...f,
});

let offers: Offer[] = [];
let funds: Fund[] = [];
beforeAll(async () => {
  process.env.DATA_SOURCE = 'fixtures';
  offers = await getOffers();
  funds = await getFunds();
}, 20000);

describe('funds in the tools (D10)', () => {
  it('reads the fund_estimates file and attaches it to funds', async () => {
    const map = await getFundEstimates();
    expect(map.size).toBeGreaterThan(0);
    expect(funds.some((f) => f.estimate && f.estimate.estimatePercent != null)).toBe(true);
  });

  it('compounds only the estimate, rounded down, with the published part', () => {
    const r = calculateFund(fund({}), 100000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.units).toBe(1000);
    expect(r.change30dMoney).toBe(1000);
    expect(r.horizonYears).toBe(5);
    expect(r.values[0]).toEqual({ year: 1, value: 120000 });
    expect(r.values[4].value).toBe(compoundFund(100000, 20, 5));
  });

  it('no estimate: the published part and no values', () => {
    const r = calculateFund(fund({ estimate: null }), 5000);
    expect(r.ok && r.yearlyPercent).toBe(null);
    expect(r.ok && r.values).toEqual([]);
  });

  it('zero and negative estimates; ytd and yield carry one year', () => {
    const zero = calculateFund(fund({ estimate: { ...fund({}).estimate!, estimatePercent: 0, method: 'ytd' } }), 1000);
    expect(zero.ok && zero.values).toEqual([{ year: 1, value: 1000 }]);
    const neg = calculateFund(fund({ estimate: { ...fund({}).estimate!, estimatePercent: -10, method: 'yield' } }), 1000);
    expect(neg.ok && neg.values).toEqual([{ year: 1, value: 900 }]);
    expect(amountFor(1000, 'totalReturn', fund({ estimate: { ...fund({}).estimate!, estimatePercent: -10, method: 'yield' } }))).toEqual({
      ok: false,
      reason: 'cannotReach',
    });
  });

  it("the person's own figure replaces the estimate", () => {
    const r = calculateFund(fund({ estimate: null }), 1000, { ownPercent: 10 });
    expect(r.ok && r.ownFigure).toBe(true);
    expect(r.ok && r.values[0].value).toBe(1100);
  });

  it('dollar and euro funds keep their currency', () => {
    for (const c of ['USD', 'EUR']) {
      const r = calculateFund(fund({ currency: c }), 1000);
      expect(r.ok && r.currency).toBe(c);
    }
  });

  it('every fixture fund calculates without throwing', () => {
    for (const f of funds) {
      const r = calculateFund(f, 100000);
      expect(r.ok).toBe(true);
      if (r.ok && r.yearlyPercent != null) expect(r.values.length).toBeGreaterThan(0);
    }
  });

  it('comparison mixes kinds and marks rows that do not apply', () => {
    const c = buildProductComparison([offer({}), fund({})], 100000, '2026-10-13');
    expect(c.columns.map((x) => x.isFund)).toEqual([false, true]);
    expect(c.rows.find((r) => r.id === 'rate')!.cells).toEqual([20, 'na']);
    expect(c.rows.find((r) => r.id === 'price')!.cells).toEqual(['na', 100]);
    expect(c.rows.find((r) => r.id === 'pays')!.cells[1]).toBe(compoundFund(100000, 20, 5) - 100000);
    // A certificate's row is its gain with every payout reinvested (monthly, 20% a year, 3 years).
    expect(c.rows.find((r) => r.id === 'pays')!.cells[0] as number).toBeCloseTo(100000 * (Math.pow(1 + 0.2 / 12, 36) - 1), 4);
  });
});

describe('Target (D9)', () => {
  it('fixed monthly: divides by the monthly rate, rounded up to the pound', () => {
    const r = amountFor(1000, 'perMonth', offer({}));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.amount).toBe(60000);
    expect(r.period).toBe('month');
  });

  it('minimum applies when it is higher', () => {
    const r = amountFor(1, 'perMonth', offer({ minAmount: 5000 }));
    expect(r.ok && r.minimumApplies).toBe(true);
    expect(r.ok && r.amount).toBe(5000);
  });

  it('every month on a yearly product uses its own period', () => {
    const r = amountFor(1000, 'perMonth', offer({ payout: 'yearly' }));
    expect(r.ok && r.period).toBe('yearly');
    expect(r.ok && r.periodTarget).toBe(12000);
  });

  it('calculate(amountFor(t)) meets t for every fixture offer and kind', () => {
    const kinds: TargetKind[] = ['perPayout', 'perMonth', 'totalReturn'];
    for (const o of offers) {
      for (const kind of kinds) {
        for (const t of [500, 12345.67]) {
          const r = amountFor(t, kind, o);
          if (!r.ok) continue;
          const c = calculate(o, r.amount);
          expect(c.ok).toBe(true);
          if (!c.ok) continue;
          const metric =
            kind === 'totalReturn' || (kind === 'perMonth' && r.period === 'maturity')
              ? c.totalReturn
              : c.perPayout ?? c.steps[0].perPayout;
          expect(metric + 1e-6).toBeGreaterThanOrEqual(r.periodTarget);
        }
      }
    }
  });

  it('fund total: target / ((1 + r)^years − 1)', () => {
    const r = amountFor(10000, 'totalReturn', fund({ estimate: { ...fund({}).estimate!, method: 'ytd' } }));
    expect(r.ok && r.amount).toBe(50000);
  });
});

describe('Split (D9)', () => {
  it('places, leaves and sums year by year', () => {
    const s = split(200000, [
      { product: offer({}), amount: 100000 },
      { product: offer({ id: 'y', termMonths: 12, payout: 'maturity' }), amount: 50000 },
    ]);
    expect(s.placed).toBe(150000);
    expect(s.left).toBe(50000);
    expect(s.years[0].received).toBeCloseTo(20000 + 10000, 6);
    expect(s.years[0].returned).toBe(50000);
    expect(s.years[2].returned).toBe(100000);
    expect(s.totalReceived).toBeCloseTo(60000 + 10000, 6);
    // Reinvested: the monthly line compounds; the 12-month maturity line pays once.
    expect(s.gainReinvested).toBeCloseTo(100000 * (Math.pow(1 + 0.2 / 12, 36) - 1) + 10000, 4);
    expect(s.perMonth).toBe(null); // one line pays at maturity
  });

  it('per month only when every line pays monthly', () => {
    const s = split(100000, [
      { product: offer({}), amount: 60000 },
      { product: offer({ id: 'z' }), amount: 40000 },
    ]);
    expect(s.perMonth).toBeCloseTo(100000 * 0.2 / 12, 6);
  });

  it('a line below its minimum is left out of the sums; over-placing gives a negative left', () => {
    const s = split(1000, [
      { product: offer({ minAmount: 5000 }), amount: 2000 },
      { product: offer({ id: 'b', minAmount: 0 }), amount: 3000 },
    ]);
    expect(s.lines[0].included).toBe(false);
    expect(s.left).toBe(-4000);
    expect(s.totalReceived).toBeCloseTo(3000 * 0.2 * 3, 6);
  });

  it('at most five lines; fund lines are values, not money received', () => {
    const s = split(0, [
      ...Array.from({ length: 6 }, (_, i) => ({ product: offer({ id: `o${i}` }), amount: 1000 })),
    ]);
    expect(s.lines.length).toBe(5);
    const f = split(10000, [{ product: fund({}), amount: 10000 }]);
    expect(f.totalReceived).toBe(0);
    expect(f.years[0].fundValues.EGP).toBe(12000);
  });

  it('stepped first-year-only lines mark later years incomplete', () => {
    const s = split(100000, [
      { product: offer({ rateKind: 'stepped', rateNoteEn: 'unparseable', payout: 'yearly' }), amount: 100000 },
    ]);
    expect(s.years[0].incomplete).toBe(false);
    expect(s.years[1].incomplete).toBe(true);
  });

  it('every fixture offer works as a line', () => {
    for (const o of offers) {
      const s = split(1_000_000, [{ product: o, amount: Math.max(o.minAmount ?? 0, 100000) }]);
      expect(Number.isFinite(s.totalReceived)).toBe(true);
      expect(isFund(o)).toBe(false);
    }
  });
});

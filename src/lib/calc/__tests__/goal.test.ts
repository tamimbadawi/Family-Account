import { beforeAll, describe, expect, it } from 'vitest';
import { getFunds, getOffers } from '../../market/index';
import type { Fund, Offer } from '../../market/types';
import { bestMix, candidateFor, goalPlan, gradeFunds, normCdf, GOAL_HORIZONS } from '../index';

let offers: Offer[] = [];
let funds: Fund[] = [];
beforeAll(async () => {
  process.env.DATA_SOURCE = 'fixtures';
  offers = await getOffers();
  funds = await getFunds();
}, 20000);
const all = () => [...offers, ...funds];

describe('normCdf', () => {
  it('matches known values', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.2816)).toBeCloseTo(0.9, 3);
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe('candidates', () => {
  it('a certificate longer than the horizon is not used; a bill rolls over', () => {
    const cert = offers.find((o) => o.type === 'certificate' && (o.termMonths ?? 0) >= 24)!;
    expect(candidateFor(cert, 12)).toBeNull();
    const bill = offers.find((o) => o.id === 'tbill-91d')!;
    const c = candidateFor(bill, 12)!;
    expect(c.rolledOver).toBe(true);
    expect(c.mu).toBeGreaterThan((bill.ratePercent / 100) * (91 / 365) * 3);
  });
});

describe('best mix', () => {
  it('safe: a modest goal is reached for certain with fixed products only', () => {
    const m = bestMix(all(), { amount: 100000, goal: 10000, horizonMonths: 12, howSure: 'safe' })!;
    expect(m.chance).toBe(1);
    expect(m.lines.every((l) => l.certainty === 'fixed')).toBe(true);
    expect(m.lines.reduce((s, l) => s + l.amount, 0)).toBe(100000);
  });

  it('safe cannot reach 50% in a year; bold gives it a real chance below 100%', () => {
    const safe = bestMix(all(), { amount: 100000, goal: 50000, horizonMonths: 12, howSure: 'safe' })!;
    expect(safe.chance).toBe(0);
    const bold = bestMix(all(), { amount: 100000, goal: 50000, horizonMonths: 12, howSure: 'bold' })!;
    expect(bold.chance).toBeGreaterThan(0);
    expect(bold.chance).toBeLessThan(1);
  });

  it('respects minimums and splits into at most three lines', () => {
    for (const howSure of ['safe', 'balanced', 'bold'] as const) {
      const m = bestMix(all(), { amount: 250000, goal: 40000, horizonMonths: 24, howSure });
      if (!m) continue;
      expect(m.lines.length).toBeLessThanOrEqual(3);
      for (const l of m.lines) {
        const min = 'minAmount' in l.product ? (l.product as Offer).minAmount ?? 0 : 0;
        expect(l.amount).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it('50% in one month is out of reach and the plan names a later time that works', () => {
    const p = goalPlan(all(), { amount: 100000, goal: 50000, horizonMonths: 1, howSure: 'bold' });
    expect(p.mix?.chance ?? 0).toBeLessThan(0.5);
    expect(p.chanceByHorizon.map((c) => c.months)).toEqual([...GOAL_HORIZONS]);
    expect(p.earliestLikely === null || p.earliestLikely > 1).toBe(true);
  });
});

describe('fund grades', () => {
  it('grades every fund with an estimate, A to E', () => {
    const g = gradeFunds(funds);
    const graded = funds.filter((f) => f.estimate?.estimatePercent != null);
    for (const f of graded) expect(['A', 'B', 'C', 'D', 'E']).toContain(g.get(f.id)!.grade);
    for (const f of funds.filter((x) => x.estimate?.estimatePercent == null)) expect(g.get(f.id)!.grade).toBeNull();
    const grades = new Set(graded.map((f) => g.get(f.id)!.grade));
    expect(grades.size).toBeGreaterThan(1);
  });
});

describe('treasury bonds (tbond rows from the pipeline)', () => {
  const bond: Offer = {
    id: 'tbond-3y', bankCode: 'tbond', bankEn: 'Central Bank of Egypt', bankAr: 'البنك المركزي المصري',
    nameEn: '3-year Treasury Bond', nameAr: 'سندات خزانة 3 سنوات', type: 'tbond', ratePercent: 24, rateKind: 'fixed',
    rateNoteEn: '', rateNoteAr: '', termMonths: 36, payout: 'semiannual', minAmount: null, currency: 'EGP',
    sourceUrl: 'https://cbe.org.eg', sources: ['cbe.org.eg'], publishedOn: '2026-10-13', confidence: 'single', country: 'EG',
  };
  it('pays its coupon twice a year, is fixed, and can join a 3-year mix', async () => {
    const { calculate, certaintyOf } = await import('../index');
    const r = calculate(bond, 100000);
    expect(r.ok && r.perPayout).toBe(12000);
    expect(certaintyOf(bond)).toBe('fixed');
    expect(candidateFor(bond, 24)).toBeNull();
    expect(candidateFor(bond, 36)!.mu).toBeCloseTo(Math.pow(1.12, 6) - 1, 6);
  });
});

describe('compounding', () => {
  it('reinvests monthly payouts and rolls a short certificate over', async () => {
    const { compoundFactor } = await import('../index');
    const base = (o: Partial<Offer>): Offer => ({
      id: 'x-fixed-12m-monthly', bankCode: 'x', bankEn: 'X', bankAr: 'X', nameEn: 'n', nameAr: 'n', type: 'certificate',
      ratePercent: 24, rateKind: 'fixed', rateNoteEn: '', rateNoteAr: '', termMonths: 12, payout: 'monthly', minAmount: 0,
      currency: 'EGP', sourceUrl: 'https://x.com', sources: ['x.com'], publishedOn: '2026-10-13', confidence: 'single', country: 'EG', ...o,
    });
    expect(compoundFactor(base({}))).toBeCloseTo(Math.pow(1.02, 12), 9);
    expect(compoundFactor(base({ payout: 'maturity' }))).toBeCloseTo(1.24, 9);
    const c = candidateFor(base({}), 24)!;
    expect(c.rolledOver).toBe(true);
    expect(c.mu).toBeCloseTo(Math.pow(1.02, 24) - 1, 9);
    const stepped = base({ id: 's', rateKind: 'stepped', termMonths: 24, payout: 'yearly', rateNoteEn: '20% year 1, 10% year 2' });
    expect(compoundFactor(stepped)).toBeCloseTo(1.2 * 1.1, 9);
  });
});

describe('the three levels line up', () => {
  it('Safe ≤ Balanced ≤ Bold in expected gain; chance the other way when the goal is reachable', () => {
    for (const [goal, months] of [[10000, 12], [25000, 12], [25000, 24], [40000, 36], [5000, 6]] as const) {
      const at = (howSure: 'safe' | 'balanced' | 'bold') => bestMix(all(), { amount: 100000, goal, horizonMonths: months, howSure });
      const [s, b, x] = [at('safe'), at('balanced'), at('bold')];
      if (!s || !b || !x) continue;
      expect(b.expectedGain).toBeGreaterThanOrEqual(s.expectedGain - 0.5);
      expect(x.expectedGain).toBeGreaterThanOrEqual(b.expectedGain - 0.5);
      if (s.chance >= 0.5) expect(Math.round(b.chance * 100)).toBeLessThanOrEqual(Math.round(s.chance * 100));
      if (b.chance >= 0.5) expect(Math.round(x.chance * 100)).toBeLessThanOrEqual(Math.round(b.chance * 100));
    }
  });
});

describe('funds in the mix', () => {
  it('a charity fund is never suggested; funds stay in play past one year', () => {
    const charity = funds.find((f) => /خيري/.test(f.fundAr));
    if (charity) expect(candidateFor(charity, 12)).toBeNull();
    const fund = funds.find((f) => f.fundType === 'equity' && f.estimate?.method === 'ytd')!;
    const one = candidateFor(fund, 12)!;
    const three = candidateFor(fund, 36)!;
    expect(three).not.toBeNull();
    expect(three.sigma).toBeGreaterThan(one.sigma);
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { getFunds, getOffers } from '../../market/index';
import type { Fund, Offer } from '../../market/types';
import { certaintyOf, plainComparison, plan, planRow, PLAN_HORIZONS } from '../index';

const offer = (o: Partial<Offer>): Offer => ({
  id: 'x-fixed-12m-maturity', bankCode: 'x', bankEn: 'X', bankAr: 'X', nameEn: 'n', nameAr: 'n', type: 'certificate',
  ratePercent: 20, rateKind: 'fixed', rateNoteEn: '', rateNoteAr: '', termMonths: 12, payout: 'maturity', minAmount: 1000,
  currency: 'EGP', sourceUrl: 'https://x.com', sources: ['x.com'], publishedOn: '2026-10-13', confidence: 'single', country: 'EG',
  ...o,
});
const fund = (f: Partial<Fund>): Fund => ({
  id: 'f-1', fundEn: 'F', fundAr: 'F', managerEn: 'M', managerAr: 'M', fundType: 'equity', currency: 'EGP', price: 10,
  change30dPercent: 1, changeYtdPercent: 10, risk: null, sharia: false, sourceUrl: 'https://m.com', sources: ['m.com'],
  publishedOn: '2026-10-13', confidence: 'single', country: 'EG',
  estimate: { estimatePercent: 30, method: 'history', pricesUsed: 156, firstDate: '', lastDate: '', peers: 20, computedOn: '', modelVersion: '' },
  ...f,
});

let offers: Offer[] = [];
let funds: Fund[] = [];
beforeAll(async () => {
  process.env.DATA_SOURCE = 'fixtures';
  offers = await getOffers();
  funds = await getFunds();
}, 20000);

describe('certainty', () => {
  it('follows the written rule', () => {
    expect(certaintyOf(offer({}))).toBe('fixed');
    expect(certaintyOf(offer({ rateKind: 'stepped' }))).toBe('fixed');
    expect(certaintyOf(offer({ rateKind: 'variable' }))).toBe('likely');
    expect(certaintyOf(offer({ type: 'tbill', rateKind: 'variable' }))).toBe('fixed');
    expect(certaintyOf(fund({ fundType: 'money_market' }))).toBe('likely');
    expect(certaintyOf(fund({ fundType: 'money_market', risk: 'high' }))).toBe('uncertain');
    expect(certaintyOf(fund({}))).toBe('uncertain');
    expect(certaintyOf(fund({ fundType: 'balanced', risk: 'low' }))).toBe('likely');
    expect(certaintyOf(fund({ fundType: 'equity', risk: 'low' }))).toBe('uncertain');
  });
});

describe('planner', () => {
  it('an offer must give the money back within the time asked', () => {
    const r = planRow(offer({}), 100000, { kind: 'percent', value: 10 }, 6);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('longerThanHorizon');
    const r12 = planRow(offer({}), 100000, { kind: 'percent', value: 10 }, 12);
    expect(r12.ok && r12.gain).toBe(20000);
    expect(r12.ok && r12.reaches).toBe(true);
  });

  it('a fund compounds its estimate over the months asked, within its horizon', () => {
    const r = planRow(fund({}), 100000, { kind: 'amount', value: 50000 }, 24);
    expect(r.ok && r.gain).toBe(Math.floor(100000 * 1.3 ** 2) - 100000);
    expect(r.ok && r.reaches).toBe(true);
    const ytd = planRow(fund({ estimate: { ...fund({}).estimate!, method: 'ytd' } }), 100000, { kind: 'percent', value: 1 }, 24);
    expect(!ytd.ok && ytd.reason).toBe('noEstimate');
  });

  it('certainty filter: higher certainty keeps fewer products', () => {
    const all = [...offers, ...funds];
    const g = { kind: 'percent' as const, value: 10 };
    const any = plan(all, 100000, g, 12, 'uncertain').rows.length;
    const likely = plan(all, 100000, g, 12, 'likely').rows.length;
    const fixed = plan(all, 100000, g, 12, 'fixed').rows.length;
    expect(any).toBeGreaterThan(likely);
    expect(likely).toBeGreaterThan(fixed);
  });

  it('50% in one month reaches nothing; the earliest horizon that adds up is reported', () => {
    const all = [...offers, ...funds];
    const p = plan(all, 100000, { kind: 'percent', value: 50 }, 1);
    expect(p.reachByHorizon[1]).toBe(0);
    expect(p.earliestHorizon === null || p.earliestHorizon > 1).toBe(true);
    const easy = plan(all, 100000, { kind: 'percent', value: 2 }, 12, 'fixed');
    expect(easy.earliestHorizon).not.toBeNull();
    for (const h of PLAN_HORIZONS) expect(easy.reachByHorizon[h]).toBeGreaterThanOrEqual(0);
  });

  it('every fixture product gives a row at every horizon without throwing', () => {
    for (const h of PLAN_HORIZONS) {
      const p = plan([...offers, ...funds], 250000, { kind: 'amount', value: 30000 }, h);
      expect(p.rows.length).toBe(offers.length + funds.length);
    }
  });
});

describe('plain words', () => {
  it('lists the differences between two certificates', () => {
    const a = offer({ id: 'a-fixed-36m-monthly', ratePercent: 21, termMonths: 36, payout: 'monthly' });
    const b = offer({ id: 'b-fixed-12m-maturity', ratePercent: 20, termMonths: 12, payout: 'maturity', minAmount: 5000 });
    const ids = plainComparison(a, b, 100000).map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['yearly', 'termLonger', 'payout', 'minimum']));
    expect(ids).not.toContain('gainOver');
  });

  it('a certificate against a fund over the certificate term', () => {
    const facts = plainComparison(offer({}), fund({}), 100000);
    const g = facts.find((f) => f.id === 'gainOver');
    expect(g && g.id === 'gainOver' && g.who).toBe('b');
    expect(facts.find((f) => f.id === 'certainty')).toEqual({ id: 'certainty', a: 'fixed', b: 'uncertain' });
  });

  it('same product reads as the same', () => {
    expect(plainComparison(offer({}), offer({}), 100000)).toEqual([{ id: 'same' }]);
  });

  it('every pair of the first fixture products works', () => {
    const some = [...offers.slice(0, 8), ...funds.slice(0, 8)];
    for (const a of some) for (const b of some) expect(plainComparison(a, b, 100000).length).toBeGreaterThan(0);
  });
});

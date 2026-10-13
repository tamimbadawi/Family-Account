import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculate } from './calc';
import { investmentIdeas } from './ideas';
import { parseOffersCsv } from './parse';
import type { Offer } from './types';

const fixture = fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'offers.csv'), 'utf8');

function offer(overrides: Partial<Offer>): Offer {
  return {
    id: 'bm-fixed-36m-monthly',
    bankCode: 'bm',
    bankEn: 'Banque Misr',
    bankAr: 'بنك مصر',
    nameEn: 'Fixed Certificate',
    nameAr: 'شهادة بعائد ثابت',
    type: 'certificate',
    ratePercent: 18,
    rateKind: 'fixed',
    rateNoteEn: '',
    rateNoteAr: '',
    termMonths: 36,
    payout: 'monthly',
    minAmount: 1000,
    currency: 'EGP',
    sourceUrl: null,
    sources: [],
    publishedOn: '2026-10-13',
    confidence: 'confirmed',
    country: 'EG',
    ...overrides,
  };
}

describe('parseOffersCsv', () => {
  it('reads the bank-offers sample sheet', () => {
    const { offers, error } = parseOffersCsv(fixture);
    expect(error).toBe(false);
    expect(offers.length).toBeGreaterThan(100);
    expect(offers.every((o) => o.ratePercent > 0 && o.id)).toBe(true);
  });

  it('skips inactive, non-Egyptian and nameless rows', () => {
    const csv = [
      'id,name_en,name_ar,type,rate_percent,rate_kind,term_months,payout,active,country',
      'a-1,A,,certificate,10,fixed,12,monthly,TRUE,EG',
      'b-1,B,,certificate,10,fixed,12,monthly,FALSE,EG',
      'c-1,C,,certificate,10,fixed,12,monthly,TRUE,AE',
      'd-1,,,certificate,10,fixed,12,monthly,TRUE,EG',
      'e-1,E,,certificate,abc,fixed,12,monthly,TRUE,EG',
    ].join('\n');
    expect(parseOffersCsv(csv).offers.map((o) => o.id)).toEqual(['a-1']);
  });

  it('flags an HTML page or missing columns as an error', () => {
    expect(parseOffersCsv('<html></html>').error).toBe(true);
    expect(parseOffersCsv('id,name_en\nx,y').error).toBe(true);
    expect(parseOffersCsv('').error).toBe(true);
  });
});

describe('calculate (copied from bank-offers)', () => {
  it('fixed monthly: 100,000 at 18% pays 1,500 a month for 36 months', () => {
    const r = calculate(offer({}), 100000);
    expect(r.ok && r.perPayout).toBeCloseTo(1500);
    expect(r.ok && r.payoutsCount).toBe(36);
    expect(r.ok && r.totalReturn).toBeCloseTo(54000);
  });

  it('below the minimum is refused', () => {
    expect(calculate(offer({ minAmount: 5000 }), 1000)).toEqual({
      ok: false,
      reason: 'belowMinimum',
      minAmount: 5000,
    });
  });

  it('treasury bill uses days / 365 and is before tax', () => {
    const r = calculate(
      offer({ type: 'tbill', termMonths: 12, termDays: 364, payout: 'maturity', ratePercent: 25 }),
      100000,
    );
    expect(r.ok && r.totalReturn).toBeCloseTo((100000 * 0.25 * 364) / 365);
    expect(r.ok && r.assumptions).toContain('beforeTax');
  });
});

describe('investmentIdeas', () => {
  const offers = [
    offer({ id: 'a-fixed', bankCode: 'a', nameEn: 'A fixed', ratePercent: 18 }),
    offer({ id: 'b-var', bankCode: 'b', nameEn: 'B variable', ratePercent: 19, rateKind: 'variable' }),
    offer({ id: 'c-quarterly', bankCode: 'c', nameEn: 'C quarterly', ratePercent: 22, payout: 'quarterly' }),
    offer({ id: 'd-big', bankCode: 'd', nameEn: 'D big', ratePercent: 25, minAmount: 1000000 }),
    offer({
      id: 'tbill-91d',
      bankCode: 'tbill',
      nameEn: '91-day bill',
      type: 'tbill',
      termMonths: 3,
      termDays: 91,
      payout: 'maturity',
      ratePercent: 26,
      minAmount: 25000,
    }),
    offer({ id: 'usd', bankCode: 'u', nameEn: 'USD cert', currency: 'USD', ratePercent: 30 }),
  ];

  it('monthly income: only products paying every month, highest first', () => {
    const { ideas, needMore } = investmentIdeas(offers, 100000, 'monthly', 'any');
    expect(ideas.map((i) => i.offer.id)).toEqual(['b-var', 'a-fixed']);
    expect(ideas[1].perMonth).toBeCloseTo(1500);
    expect(ideas[0].notes).toContain('variable');
    expect(needMore).toBe(1);
  });

  it('grow: every EGP product ranked by average yearly return', () => {
    const { ideas } = investmentIdeas(offers, 100000, 'grow', 'any');
    expect(ideas.map((i) => i.offer.id)).toEqual(['tbill-91d', 'c-quarterly', 'b-var', 'a-fixed']);
    expect(ideas[0].perYear).toBeCloseTo(26000);
  });

  it('length filter keeps only short products', () => {
    const { ideas } = investmentIdeas(offers, 100000, 'grow', 'upTo1y');
    expect(ideas.map((i) => i.offer.id)).toEqual(['tbill-91d']);
  });

  it('the same product in several amount tiers is shown once, best tier kept', () => {
    const tiers = [
      offer({ id: 'x-1', bankCode: 'x', nameEn: 'X', ratePercent: 17, minAmount: 1000 }),
      offer({ id: 'x-2', bankCode: 'x', nameEn: 'X', ratePercent: 18, minAmount: 50000 }),
      offer({ id: 'x-3', bankCode: 'x', nameEn: 'X', ratePercent: 19, minAmount: 500000 }),
    ];
    const { ideas, needMore } = investmentIdeas(tiers, 100000, 'monthly', 'any');
    expect(ideas.map((i) => i.offer.id)).toEqual(['x-2']);
    expect(needMore).toBe(0);
  });

  it('no amount, no ideas', () => {
    expect(investmentIdeas(offers, 0, 'grow', 'any').ideas).toEqual([]);
  });

  it('works on the sample sheet', () => {
    const { offers: sheet } = parseOffersCsv(fixture);
    const { ideas, latestDate } = investmentIdeas(sheet, 100000, 'monthly', 'any');
    expect(ideas.length).toBeGreaterThan(5);
    expect(latestDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (let i = 1; i < ideas.length; i++) {
      expect(ideas[i - 1].perMonth).toBeGreaterThanOrEqual(ideas[i].perMonth - 0.005);
    }
  });
});

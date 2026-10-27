import { describe, expect, it } from 'vitest';
import type { Offer } from '../../market/types';
import { buildComparison } from '../compare';

describe('buildComparison', () => {
  const offerA: Offer = {
    id: 'bm-fixed-36m-monthly',
    bankCode: 'bm',
    bankEn: 'Banque Misr',
    bankAr: 'بنك مصر',
    nameEn: 'Fixed Certificate',
    nameAr: 'شهادة بعائد ثابت',
    type: 'certificate',
    ratePercent: 19.25,
    rateKind: 'fixed',
    rateNoteEn: '',
    rateNoteAr: '',
    termMonths: 36,
    payout: 'monthly',
    minAmount: 1000,
    currency: 'EGP',
    sourceUrl: 'https://banquemisr.com',
    sources: ['banquemisr.com'],
    publishedOn: '2026-10-13',
    confidence: 'confirmed',
    country: 'EG',
  };

  const offerB: Offer = {
    id: 'nbe-fixed-36m-monthly',
    bankCode: 'nbe',
    bankEn: 'NBE',
    bankAr: 'الأهلي المصري',
    nameEn: 'Platinum Certificate',
    nameAr: 'البلاتينية',
    type: 'certificate',
    ratePercent: 21.5,
    rateKind: 'fixed',
    rateNoteEn: '',
    rateNoteAr: '',
    termMonths: 36,
    payout: 'monthly',
    minAmount: 5000,
    currency: 'EGP',
    sourceUrl: 'https://nbe.com.eg',
    sources: ['nbe.com.eg'],
    publishedOn: '2026-10-13',
    confidence: 'confirmed',
    country: 'EG',
  };

  const offerStepped: Offer = {
    id: 'bm-stepped-36m-monthly',
    bankCode: 'bm',
    bankEn: 'Banque Misr',
    bankAr: 'بنك مصر',
    nameEn: 'Stepped Certificate',
    nameAr: 'شهادة متدرجة',
    type: 'certificate',
    ratePercent: 22,
    rateKind: 'stepped',
    rateNoteEn: '22% year 1, 17.5% year 2, 13% year 3',
    rateNoteAr: '',
    termMonths: 36,
    payout: 'monthly',
    minAmount: 1000,
    currency: 'EGP',
    sourceUrl: 'https://banquemisr.com',
    sources: ['banquemisr.com'],
    publishedOn: '2026-10-13',
    confidence: 'confirmed',
    country: 'EG',
  };

  it('handles empty offers list', () => {
    const res = buildComparison([]);
    expect(res.offers).toEqual([]);
    expect(res.rows).toEqual([]);
    expect(res.status).toEqual([]);
  });

  it('returns raw values without labels and sets differs to false for single offer', () => {
    const res = buildComparison([offerA], 50000, '2026-10-13');
    expect(res.rows.length).toBe(10);

    for (const row of res.rows) {
      expect(row.differs).toBe(false);
      // Ensure no labelEn or labelAr
      expect((row as unknown as Record<string, unknown>).labelEn).toBeUndefined();
      expect((row as unknown as Record<string, unknown>).labelAr).toBeUndefined();
    }

    const rateRow = res.rows.find((r) => r.property === 'rate');
    expect(rateRow?.values).toEqual([19.25]); // Raw number
  });

  it('identifies differing properties between two offers with raw values', () => {
    const res = buildComparison([offerA, offerB], 100000, '2026-10-13');

    const rateRow = res.rows.find((r) => r.property === 'rate');
    expect(rateRow?.differs).toBe(true);
    expect(rateRow?.values).toEqual([19.25, 21.5]);

    const kindRow = res.rows.find((r) => r.property === 'kind');
    expect(kindRow?.differs).toBe(false);
    expect(kindRow?.values).toEqual(['fixed', 'fixed']);

    const minimumRow = res.rows.find((r) => r.property === 'minimum');
    expect(minimumRow?.differs).toBe(true);
    expect(minimumRow?.values).toEqual([1000, 5000]);

    const sourceRow = res.rows.find((r) => r.property === 'source');
    expect(sourceRow?.values).toEqual([['Banque Misr'], ['National Bank of Egypt']]);
  });

  it('uses effectiveConfidence and today parameter to compute confidence row', () => {
    // 35 days old relative to today '2026-10-13' -> 2026-09-08 -> stale
    const oldOffer = { ...offerA, publishedOn: '2026-09-08' };
    const res = buildComparison([oldOffer, offerB], 10000, '2026-10-13');

    const confRow = res.rows.find((r) => r.property === 'confidence');
    expect(confRow?.differs).toBe(true);
    expect(confRow?.values).toEqual(['stale', 'confirmed']);
  });

  it('handles stepped product with null perPayout when rates vary', () => {
    const res = buildComparison([offerStepped], 100000, '2026-10-13');
    const perPayoutRow = res.rows.find((r) => r.property === 'perPayout');
    expect(perPayoutRow?.values).toEqual([null]);

    const totalReturnRow = res.rows.find((r) => r.property === 'totalReturn');
    expect(totalReturnRow?.values).toEqual([52500]);
  });

  it('exposes per product calculation status (noAmount, belowMinimum, ok)', () => {
    // offerA minimum is 1000, offerB minimum is 5000
    // Amount 2000 -> offerA is ok, offerB is belowMinimum
    const res1 = buildComparison([offerA, offerB], 2000, '2026-10-13');
    expect(res1.status).toEqual([
      { ok: true },
      { ok: false, reason: 'belowMinimum', minAmount: 5000 },
    ]);

    // Amount 0 or negative -> both noAmount
    const res2 = buildComparison([offerA, offerB], 0, '2026-10-13');
    expect(res2.status).toEqual([
      { ok: false, reason: 'noAmount' },
      { ok: false, reason: 'noAmount' },
    ]);
  });

  it('never alters offer order and never sorts by better', () => {
    const res1 = buildComparison([offerA, offerB], 10000);
    expect(res1.offers[0].id).toBe('bm-fixed-36m-monthly');
    expect(res1.offers[1].id).toBe('nbe-fixed-36m-monthly');

    const res2 = buildComparison([offerB, offerA], 10000);
    expect(res2.offers[0].id).toBe('nbe-fixed-36m-monthly');
    expect(res2.offers[1].id).toBe('bm-fixed-36m-monthly');
  });

  it('passes locale to sourceNames so source row reflects chosen locale', () => {
    const resEn = buildComparison([offerA], 10000, '2026-10-13', 'en');
    const sourceRowEn = resEn.rows.find((r) => r.property === 'source');
    expect(sourceRowEn?.values[0]).toEqual(['Banque Misr']);

    const resAr = buildComparison([offerA], 10000, '2026-10-13', 'ar');
    const sourceRowAr = resAr.rows.find((r) => r.property === 'source');
    expect(sourceRowAr?.values[0]).toEqual(['بنك مصر']);
  });
});

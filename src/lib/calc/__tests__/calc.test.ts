import { describe, expect, it } from 'vitest';
import { getFunds, getOffers } from '../../market/index';
import type { Offer } from '../../market/types';
import { moneyRounded, percent } from '../../format';
import { effectiveConfidence } from '../../confidence';
import { calculate } from '../index';

describe('Calculator Logic (src/lib/calc)', () => {
  const baseOffer: Offer = {
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

  describe('Case 1: Fixed rate certificate with monthly payout', () => {
    it('calculates monthly interest accurately with worked arithmetic and structured step data', () => {
      // Amount: 100,000 EGP, Rate: 19.25%, Monthly payout
      // perPayout = 100,000 * 0.1925 * (1 / 12) = 1,604.1666666666667
      // 36 months = 36 payouts
      // totalReturn = 100,000 * 0.1925 * 3 = 57,750
      const amount = 100000;
      const res = calculate(baseOffer, amount);

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const expectedPerPayout = 100000 * 0.1925 * (1 / 12);
      const expectedTotalReturn = 100000 * 0.1925 * 3;

      expect(res.perPayout).toBeCloseTo(expectedPerPayout, 8);
      expect(res.payoutsCount).toBe(36);
      expect(res.payout).toBe('monthly');
      expect(res.totalReturn).toBe(expectedTotalReturn);
      expect(res.endAmount).toBe(100000 + expectedTotalReturn);
      expect(res.assumptions).toEqual([]);

      // Steps return data, not text: { kind: 'year', index }
      expect(res.steps.length).toBe(3);
      expect(res.steps[0]).toEqual({
        target: { kind: 'year', index: 1 },
        rate: 19.25,
        amount: 19250,
        perPayout: res.perPayout,
        payoutsCount: 12,
      });
    });
  });

  describe('Case 2: Fixed rate certificate with maturity payout', () => {
    it('calculates lump sum paid at maturity', () => {
      const offer: Offer = {
        ...baseOffer,
        termMonths: 12,
        ratePercent: 20,
        payout: 'maturity',
      };
      const res = calculate(offer, 50000);

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.payoutsCount).toBe(1);
      expect(res.perPayout).toBe(10000);
      expect(res.totalReturn).toBe(10000);
      expect(res.endAmount).toBe(60000);
      expect(res.steps).toEqual([
        {
          target: { kind: 'term', months: 12 },
          rate: 20,
          amount: 10000,
          perPayout: 10000,
          payoutsCount: 1,
        },
      ]);
    });
  });

  describe('Case 3: Variable rate certificate', () => {
    it('calculates at today rate and includes variable assumption', () => {
      const offer: Offer = {
        ...baseOffer,
        rateKind: 'variable',
        ratePercent: 18.5,
        payout: 'quarterly',
      };
      const res = calculate(offer, 10000);

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.perPayout).toBe(462.5);
      expect(res.payoutsCount).toBe(12);
      expect(res.totalReturn).toBe(5550);
      expect(res.endAmount).toBe(15550);
      expect(res.assumptions).toEqual(['variable']);
    });
  });

  describe('Case 4: Treasury bill', () => {
    it('calculates return using days / 365 with beforeTax assumption', () => {
      // 91-day T-Bill (id: tbill-91d -> 91 days), yield: 23.827%, minAmount: 25,000
      // totalReturn = 25,000 * 0.23827 * (91 / 365)
      const offer: Offer = {
        ...baseOffer,
        id: 'tbill-91d',
        bankCode: 'tbill',
        type: 'tbill',
        ratePercent: 23.827,
        termMonths: 3,
        payout: 'maturity',
        minAmount: 25000,
      };
      const res = calculate(offer, 25000);

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const expectedReturn = 25000 * 0.23827 * (91 / 365);
      expect(res.totalReturn).toBeCloseTo(expectedReturn, 8);
      expect(res.perPayout).toBeCloseTo(expectedReturn, 8);
      expect(res.payoutsCount).toBe(1);
      expect(res.endAmount).toBeCloseTo(25000 + expectedReturn, 8);
      expect(res.assumptions).toEqual(['beforeTax']);
      expect(res.steps[0].target).toEqual({ kind: 'term', months: 3 });
    });

    it('prefers termDays field over id when present', () => {
      const offer: Offer = {
        ...baseOffer,
        id: 'custom-tbill',
        type: 'tbill',
        termDays: 182,
        ratePercent: 25.0,
      };
      const res = calculate(offer, 30000);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.totalReturn).toBeCloseTo(30000 * 0.25 * (182 / 365), 8);
    });

    it('returns notCalculable if tbill has neither termDays nor days in id', () => {
      const offer: Offer = {
        ...baseOffer,
        id: 'tbill-unknown',
        type: 'tbill',
        termDays: null,
      };
      expect(calculate(offer, 25000)).toEqual({
        ok: false,
        reason: 'notCalculable',
      });
    });
  });

  describe('Case 5: Daily payout', () => {
    it('calculates daily payout with rate / 365 per day, count in days, and dailyApprox assumption', () => {
      // 36 months CD with daily payout at 19%
      // 36 months = 3 years = 1095 days
      // perPayout = 100,000 * 0.19 / 365 = 52.054794520547944
      // payoutsCount = 1095
      // totalReturn = 100,000 * 0.19 * (1095 / 365) = 57,000
      const offer: Offer = {
        ...baseOffer,
        ratePercent: 19,
        payout: 'daily',
        termMonths: 36,
      };
      const res = calculate(offer, 100000);

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.perPayout).toBeCloseTo((100000 * 0.19) / 365, 8);
      expect(res.payoutsCount).toBe(1095);
      expect(res.totalReturn).toBeCloseTo(57000, 8);
      expect(res.assumptions).toContain('dailyApprox');
      expect(res.steps[0].target).toEqual({ kind: 'term', months: 36 });
    });
  });

  describe('Case 6: Stepped certificate (all years parsed)', () => {
    it('sets top-level perPayout to null and ensures sum of step.perPayout x step.payoutsCount equals totalReturn', () => {
      // Amount: 100,000 EGP, 36 months, monthly payout
      // "22% year 1, 17.5% year 2, 13% year 3"
      const offer: Offer = {
        ...baseOffer,
        rateKind: 'stepped',
        ratePercent: 22,
        rateNoteEn: '22% year 1, 17.5% year 2, 13% year 3',
        termMonths: 36,
        payout: 'monthly',
      };
      const res = calculate(offer, 100000);

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // Top-level perPayout is null when not constant over the term
      expect(res.perPayout).toBeNull();
      expect(res.payoutsCount).toBe(36);
      expect(res.totalReturn).toBe(52500);
      expect(res.endAmount).toBe(152500);

      expect(res.steps).toEqual([
        {
          target: { kind: 'year', index: 1 },
          rate: 22,
          amount: 22000,
          perPayout: 100000 * 0.22 * (1 / 12),
          payoutsCount: 12,
        },
        {
          target: { kind: 'year', index: 2 },
          rate: 17.5,
          amount: 17500,
          perPayout: 100000 * 0.175 * (1 / 12),
          payoutsCount: 12,
        },
        {
          target: { kind: 'year', index: 3 },
          rate: 13,
          amount: 13000,
          perPayout: 100000 * 0.13 * (1 / 12),
          payoutsCount: 12,
        },
      ]);

      const sumOfSteps = res.steps.reduce(
        (acc, s) => acc + s.perPayout * s.payoutsCount,
        0
      );
      expect(sumOfSteps).toBeCloseTo(res.totalReturn, 8);
    });
  });

  describe('Every stepped fixture row verification', () => {
    it('verifies sum of step.perPayout x step.payoutsCount equals totalReturn for every stepped offer in fixtures', async () => {
      process.env.DATA_SOURCE = 'fixtures';
      const offers = await getOffers();
      const steppedOffers = offers.filter((o) => o.rateKind === 'stepped');

      expect(steppedOffers.length).toBeGreaterThan(0);

      for (const offer of steppedOffers) {
        const res = calculate(offer, 100000);
        expect(res.ok).toBe(true);
        if (!res.ok) continue;

        const sumOfSteps = res.steps.reduce(
          (acc, s) => acc + s.perPayout * s.payoutsCount,
          0
        );
        expect(sumOfSteps).toBeCloseTo(res.totalReturn, 6);
      }
    });
  });

  describe('Stepped edge cases', () => {
    it('handles stepped with unparseable note and payout maturity (firstYearOnly with consistent counts)', () => {
      const offer: Offer = {
        ...baseOffer,
        rateKind: 'stepped',
        ratePercent: 18,
        rateNoteEn: 'variable year 2 and 3',
        termMonths: 36,
        payout: 'maturity',
      };
      const res = calculate(offer, 100000);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.assumptions).toContain('firstYearOnly');
      expect(res.payoutsCount).toBe(1);
      expect(res.perPayout).toBe(18000);
      expect(res.totalReturn).toBe(18000);
      expect(res.steps[0].perPayout * res.steps[0].payoutsCount).toBe(18000);
    });

    it('returns notCalculable for stepped with term < 12 months', () => {
      const offer: Offer = {
        ...baseOffer,
        rateKind: 'stepped',
        ratePercent: 18,
        termMonths: 6,
      };
      expect(calculate(offer, 100000)).toEqual({
        ok: false,
        reason: 'notCalculable',
      });
    });

    it('calculates firstYearOnly for stepped with non-whole year term >= 12 months when note is unparseable', () => {
      const offer: Offer = {
        ...baseOffer,
        rateKind: 'stepped',
        ratePercent: 18,
        rateNoteEn: 'stepped irregular',
        termMonths: 18,
        payout: 'monthly',
      };
      const res = calculate(offer, 100000);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.assumptions).toContain('firstYearOnly');
      expect(res.payoutsCount).toBe(12);
      expect(res.totalReturn).toBe(18000);
    });
  });

  describe('Amount validation (noAmount and belowMinimum)', () => {
    it('returns noAmount when amount is 0', () => {
      expect(calculate(baseOffer, 0)).toEqual({
        ok: false,
        reason: 'noAmount',
      });
    });

    it('returns noAmount when amount is negative', () => {
      expect(calculate(baseOffer, -500)).toEqual({
        ok: false,
        reason: 'noAmount',
      });
    });

    it('returns noAmount when amount is NaN or non-finite', () => {
      expect(calculate(baseOffer, Number.NaN)).toEqual({
        ok: false,
        reason: 'noAmount',
      });
      expect(calculate(baseOffer, Number.POSITIVE_INFINITY)).toEqual({
        ok: false,
        reason: 'noAmount',
      });
    });

    it('returns belowMinimum when amount is positive but below minimum (999 < 1000)', () => {
      expect(calculate(baseOffer, 999)).toEqual({
        ok: false,
        reason: 'belowMinimum',
        minAmount: 1000,
      });
    });
  });

  describe('Formatters: moneyRounded and percent scientific notation', () => {
    it('moneyRounded formats calculated amounts to two decimals rounded down, never up', () => {
      // 1479.1666 -> rounded down is 1479.16
      expect(moneyRounded(1479.1666, 'EGP', 'en')).toBe('EGP 1,479.16');
      expect(moneyRounded(1479.1699, 'EGP', 'en')).toBe('EGP 1,479.16');
      expect(moneyRounded(1479.1666, 'EGP', 'ar')).toBe('1,479.16 ج.م');
      expect(moneyRounded(1000, 'EGP', 'en')).toBe('EGP 1,000.00');
    });

    it('percent formats exponent notation like 1e-7 without scientific notation', () => {
      expect(percent(1e-7)).toBe('0.0000001%');
      expect(percent(17.75)).toBe('17.75%');
    });
  });

  describe('Stepped certificate with maturity payout (all years parsed)', () => {
    it('ensures each year step carries that years amount, top-level payoutsCount is 1, perPayout is totalReturn, and all payoutsCounts are integers', () => {
      const offer: Offer = {
        ...baseOffer,
        rateKind: 'stepped',
        ratePercent: 22,
        rateNoteEn: '22% year 1, 17.5% year 2, 13% year 3',
        termMonths: 36,
        payout: 'maturity',
      };
      const amount = 100000;
      const res = calculate(offer, amount);

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.payoutsCount).toBe(1);
      expect(Number.isInteger(res.payoutsCount)).toBe(true);
      expect(res.totalReturn).toBe(52500);
      expect(res.perPayout).toBe(res.totalReturn);
      expect(res.endAmount).toBe(amount + res.totalReturn);

      expect(res.steps).toHaveLength(3);
      expect(res.steps).toEqual([
        {
          target: { kind: 'year', index: 1 },
          rate: 22,
          amount: 22000,
          perPayout: 22000,
          payoutsCount: 1,
        },
        {
          target: { kind: 'year', index: 2 },
          rate: 17.5,
          amount: 17500,
          perPayout: 17500,
          payoutsCount: 1,
        },
        {
          target: { kind: 'year', index: 3 },
          rate: 13,
          amount: 13000,
          perPayout: 13000,
          payoutsCount: 1,
        },
      ]);

      // Every payoutsCount is an integer
      for (const step of res.steps) {
        expect(Number.isInteger(step.payoutsCount)).toBe(true);
      }

      // Steps' amounts sum to totalReturn
      const sumOfStepAmounts = res.steps.reduce((acc, s) => acc + s.amount, 0);
      expect(sumOfStepAmounts).toBe(res.totalReturn);
    });
  });

  describe('Fixture-wide invariant verification (ORCHESTRATION §1a.3)', () => {
    it('verifies calculate invariants across all active offer rows loaded through the real pipeline', async () => {
      process.env.DATA_SOURCE = 'fixtures';
      const offers = await getOffers();
      expect(offers.length).toBeGreaterThan(0);
      expect(offers.error).toBeFalsy();

      for (const offer of offers) {
        // 1. Minimum test:
        if (offer.minAmount != null && offer.minAmount > 0) {
          const below = calculate(offer, offer.minAmount - 1);
          expect(below).toEqual({
            ok: false,
            reason: 'belowMinimum',
            minAmount: offer.minAmount,
          });
          const atMin = calculate(offer, offer.minAmount);
          expect(atMin.ok).toBe(true);
        } else {
          const pos = calculate(offer, 1000);
          expect(pos.ok).toBe(true);
        }

        // 2. Calculation at amount >= minAmount
        const calcAmount = Math.max(offer.minAmount ?? 0, 100000);
        const res = calculate(offer, calcAmount);
        expect(res.ok).toBe(true);
        if (!res.ok) continue;

        // totalReturn > 0
        expect(res.totalReturn).toBeGreaterThan(0);
        // endAmount = amount + totalReturn
        expect(res.endAmount).toBeCloseTo(calcAmount + res.totalReturn, 6);

        // Integer payout counts
        expect(Number.isInteger(res.payoutsCount)).toBe(true);
        for (const step of res.steps) {
          expect(Number.isInteger(step.payoutsCount)).toBe(true);
        }

        // sum of step amounts equals totalReturn
        const sumOfStepAmounts = res.steps.reduce((acc, s) => acc + s.amount, 0);
        expect(sumOfStepAmounts).toBeCloseTo(res.totalReturn, 6);

        // sum(step.perPayout * step.payoutsCount) equals totalReturn for every payout other than maturity
        if (offer.payout !== 'maturity') {
          const stepPayoutSum = res.steps.reduce((acc, s) => acc + s.perPayout * s.payoutsCount, 0);
          expect(stepPayoutSum).toBeCloseTo(res.totalReturn, 6);
        }

        // assumptions checks
        expect(res.assumptions.includes('variable')).toBe(offer.rateKind === 'variable');
        expect(res.assumptions.includes('beforeTax')).toBe(offer.type === 'tbill');
        expect(res.assumptions.includes('dailyApprox')).toBe(offer.payout === 'daily');

        // top-level perPayout is null exactly when steps carry different rates
        const differentRates =
          res.steps.length > 1 && res.steps.some((s) => s.rate !== res.steps[0].rate);
        expect(res.perPayout === null).toBe(differentRates);
      }
    });

    it('verifies funds are never calculated using real Fund objects from the pipeline', async () => {
      process.env.DATA_SOURCE = 'fixtures';
      const funds = await getFunds();
      expect(funds.length).toBeGreaterThan(0);
      expect(funds.error).toBeFalsy();

      for (const fund of funds) {
        const res = calculate(fund as unknown as Offer, 100000);
        expect(res).toEqual({ ok: false, reason: 'notCalculable' });
      }
    });

    it('verifies effectiveConfidence invariants across all real offer and fund rows', async () => {
      process.env.DATA_SOURCE = 'fixtures';
      const offers = await getOffers();
      const funds = await getFunds();

      for (const offer of offers) {
        const baseDate = new Date(`${offer.publishedOn}T00:00:00Z`);
        // At publishedOn, equals row's own confidence
        expect(effectiveConfidence(offer, baseDate)).toBe(offer.confidence);

        // At publishedOn + 30 days, unchanged
        const plus30 = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        expect(effectiveConfidence(offer, plus30)).toBe(offer.confidence);

        // At publishedOn + 31 days, becomes stale
        const plus31 = new Date(baseDate.getTime() + 31 * 24 * 60 * 60 * 1000);
        expect(effectiveConfidence(offer, plus31)).toBe('stale');
      }

      for (const fund of funds) {
        const baseDate = new Date(`${fund.publishedOn}T00:00:00Z`);
        // At publishedOn, equals row's own confidence
        expect(effectiveConfidence(fund, baseDate)).toBe(fund.confidence);

        // At publishedOn + 7 days, unchanged
        const plus7 = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        expect(effectiveConfidence(fund, plus7)).toBe(fund.confidence);

        // At publishedOn + 8 days, becomes stale
        const plus8 = new Date(baseDate.getTime() + 8 * 24 * 60 * 60 * 1000);
        expect(effectiveConfidence(fund, plus8)).toBe('stale');
      }
    });
  });
});


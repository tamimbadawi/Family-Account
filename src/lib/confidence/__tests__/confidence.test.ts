import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Bank, Fund, Manager, Offer } from '../../market/types';
import {
  effectiveConfidence,
  findBankForOffer,
  findBankProducts,
  findManagerForFund,
  sourceNames,
  toCairoCalendarDate,
} from '../index';
import {
  getBankForOffer,
  getBankProducts,
  getManagerForFund,
} from '../server';

describe('Confidence, Source Names, and Lookups (src/lib/confidence)', () => {
  const mockOffer: Offer = {
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
    sourceUrl: 'https://www.banquemisr.com/rates',
    sources: ['banquemisr.com'],
    publishedOn: '2026-10-13',
    confidence: 'confirmed',
    country: 'EG',
  };

  const mockFund: Fund = {
    id: 'f-1',
    fundEn: 'Equity Fund',
    fundAr: 'صندوق الأسهم',
    managerEn: 'CI Capital Asset Management',
    managerAr: 'سي آي لإدارة الأصول',
    fundType: 'equity',
    currency: 'EGP',
    price: 25.5,
    change30dPercent: 1.5,
    changeYtdPercent: 12.0,
    risk: 'medium',
    sharia: false,
    sourceUrl: 'https://foudalens.com/funds',
    sources: ['foudalens.com'],
    publishedOn: '2026-10-13',
    confidence: 'confirmed',
    country: 'EG',
  };

  const mockBanks: Bank[] = [
    {
      code: 'bm',
      bankEn: 'Banque Misr',
      bankAr: 'بنك مصر',
      hotline: '19888',
      website: 'https://banquemisr.com',
      logoUrl: null,
      sourceUrl: null,
      checkedOn: '2026-10-13',
    },
    {
      code: 'tbill',
      bankEn: 'Central Bank of Egypt',
      bankAr: 'البنك المركزي المصري',
      hotline: '16777',
      website: 'https://cbe.org.eg',
      logoUrl: null,
      sourceUrl: null,
      checkedOn: '2026-10-13',
    },
  ];

  const mockManagers: Manager[] = [
    {
      managerAr: 'سي آي لإدارة الأصول',
      managerEn: 'CI Capital Asset Management',
      phone: '16440',
      website: 'https://cicapital.com',
      logoUrl: null,
      sourceUrl: null,
      checkedOn: '2026-10-13',
    },
  ];

  it('imports index.ts purely without node:fs (client-safe)', async () => {
    vi.doMock('node:fs', () => {
      throw new Error('node:fs must not be imported by pure confidence module');
    });
    vi.doMock('node:fs/promises', () => {
      throw new Error('node:fs/promises must not be imported by pure confidence module');
    });

    const pure = await import('../index');
    expect(typeof pure.effectiveConfidence).toBe('function');
    expect(typeof pure.sourceNames).toBe('function');
    expect(typeof pure.findBankForOffer).toBe('function');
    expect(typeof pure.findManagerForFund).toBe('function');
    expect(typeof pure.findBankProducts).toBe('function');
  });

  describe('Effective confidence and out-of-date limits in Africa/Cairo', () => {
    const today = '2026-10-13';

    it('returns every confidence label as published when within date limits', () => {
      const labels = ['confirmed', 'single', 'differ', 'stale'] as const;
      for (const label of labels) {
        expect(
          effectiveConfidence({ ...mockOffer, confidence: label, publishedOn: '2026-10-10' }, today)
        ).toBe(label);
      }
    });

    it('returns stale when publishedOn is missing, empty, or unparseable', () => {
      expect(effectiveConfidence({ ...mockOffer, publishedOn: '' }, today)).toBe('stale');
      expect(effectiveConfidence({ ...mockOffer, publishedOn: null }, today)).toBe('stale');
      expect(effectiveConfidence({ ...mockOffer, publishedOn: undefined }, today)).toBe('stale');
      expect(effectiveConfidence({ ...mockOffer, publishedOn: 'not-a-date' }, today)).toBe('stale');
    });

    it('applies 7-day limit for funds at the exact boundary day', () => {
      // Exactly 7 days old: 2026-10-13 - 7 days = 2026-10-06 -> NOT stale
      const fund7DaysOld: Fund = {
        ...mockFund,
        publishedOn: '2026-10-06',
        confidence: 'confirmed',
      };
      expect(effectiveConfidence(fund7DaysOld, today)).toBe('confirmed');

      // 8 days old: 2026-10-05 -> stale!
      const fund8DaysOld: Fund = {
        ...mockFund,
        publishedOn: '2026-10-05',
        confidence: 'confirmed',
      };
      expect(effectiveConfidence(fund8DaysOld, today)).toBe('stale');
    });

    it('applies 30-day limit for certificates and bills at the exact boundary day', () => {
      // Exactly 30 days old: 2026-10-13 - 30 days = 2026-09-13 -> NOT stale
      const offer30DaysOld: Offer = {
        ...mockOffer,
        publishedOn: '2026-09-13',
        confidence: 'differ',
      };
      expect(effectiveConfidence(offer30DaysOld, today)).toBe('differ');

      // 31 days old: 2026-09-12 -> stale!
      const offer31DaysOld: Offer = {
        ...mockOffer,
        publishedOn: '2026-09-12',
        confidence: 'differ',
      };
      expect(effectiveConfidence(offer31DaysOld, today)).toBe('stale');
    });

    it('retains stale label if sheet already marked it stale', () => {
      const freshOffer: Offer = {
        ...mockOffer,
        publishedOn: '2026-10-13',
        confidence: 'stale',
      };
      expect(effectiveConfidence(freshOffer, today)).toBe('stale');
    });

    it('returns stale when publishedOn is in the future relative to today in Cairo', () => {
      // Tomorrow is stale
      expect(
        effectiveConfidence({ ...mockOffer, publishedOn: '2026-10-14' }, today)
      ).toBe('stale');

      // Today is not stale
      expect(
        effectiveConfidence({ ...mockOffer, publishedOn: '2026-10-13' }, today)
      ).toBe('confirmed');

      // Cairo midnight boundary:
      // 2026-10-13T20:59:59Z is 23:59:59 in Cairo (UTC+3) -> still 2026-10-13 in Cairo
      expect(
        effectiveConfidence(
          { ...mockOffer, publishedOn: '2026-10-14' },
          '2026-10-13T20:59:59Z'
        )
      ).toBe('stale');
      expect(
        effectiveConfidence(
          { ...mockOffer, publishedOn: '2026-10-13' },
          '2026-10-13T20:59:59Z'
        )
      ).toBe('confirmed');

      // 2026-10-13T21:00:00Z is 00:00:00 on 2026-10-14 in Cairo (UTC+3)
      // Now 2026-10-14 is today (not future -> confirmed)
      expect(
        effectiveConfidence(
          { ...mockOffer, publishedOn: '2026-10-14' },
          '2026-10-13T21:00:00Z'
        )
      ).toBe('confirmed');
      // While 2026-10-15 is tomorrow relative to Cairo 2026-10-14 -> stale
      expect(
        effectiveConfidence(
          { ...mockOffer, publishedOn: '2026-10-15' },
          '2026-10-13T21:00:00Z'
        )
      ).toBe('stale');
    });

    it('reduces today timestamp across Cairo timezone boundary (UTC+3 / UTC+2)', () => {
      // 2026-10-13T22:30:00Z is 2026-10-14 in Cairo
      const cairoDate = toCairoCalendarDate('2026-10-13T22:30:00Z');
      expect(cairoDate).not.toBeNull();
      // Should be 2026-10-14 UTC midnight
      expect(cairoDate?.getUTCDate()).toBe(14);
      expect(cairoDate?.getUTCMonth()).toBe(9); // 0-indexed October
      expect(cairoDate?.getUTCFullYear()).toBe(2026);

      // A fund published on 2026-10-06 is 8 days old on 2026-10-14 in Cairo -> stale
      expect(
        effectiveConfidence(
          { ...mockFund, publishedOn: '2026-10-06' },
          '2026-10-13T22:30:00Z'
        )
      ).toBe('stale');
    });
  });

  describe('sourceNames', () => {
    let fixtureOffers: Offer[] = [];
    let fixtureFunds: Fund[] = [];
    let fixtureBanks: Bank[] = [];

    beforeAll(async () => {
      const { getOffers, getFunds, getBanks } = await import('../../market');
      const [offers, funds, banks] = await Promise.all([
        getOffers(),
        getFunds(),
        getBanks(),
      ]);
      fixtureOffers = offers;
      fixtureFunds = funds;
      fixtureBanks = banks;
    });

    it('maps known source hosts to readable names in English and Arabic', () => {
      // English
      expect(sourceNames({ sources: ['banquemisr.com'] }, 'en')).toEqual(['Banque Misr']);
      expect(sourceNames({ sources: ['bankygate.com'] }, 'en')).toEqual(['Banky']);
      expect(sourceNames({ sources: ['foudalens.com'] }, 'en')).toEqual(['FoudaLens']);
      expect(sourceNames({ sources: ['cbe.org.eg'] }, 'en')).toEqual(['Central Bank of Egypt']);

      // Arabic
      expect(sourceNames({ sources: ['banquemisr.com'] }, 'ar')).toEqual(['بنك مصر']);
      expect(sourceNames({ sources: ['cbe.org.eg'] }, 'ar')).toEqual(['البنك المركزي المصري']);
      expect(sourceNames({ sources: ['cibeg.com'] }, 'ar')).toEqual(['البنك التجاري الدولي']);
      expect(sourceNames({ sources: ['nbe.com.eg'] }, 'ar')).toEqual(['البنك الأهلي المصري']);
    });

    it('extracts host from sourceUrl when sources is empty', () => {
      expect(sourceNames({ sourceUrl: 'https://www.banquemisr.com/cd-rates' }, 'en')).toEqual([
        'Banque Misr',
      ]);
      expect(sourceNames({ sourceUrl: 'https://www.banquemisr.com/cd-rates' }, 'ar')).toEqual([
        'بنك مصر',
      ]);
      expect(sourceNames({ sourceUrl: 'https://cbe.org.eg/en/auctions' }, 'en')).toEqual([
        'Central Bank of Egypt',
      ]);
      expect(sourceNames({ sourceUrl: 'https://cbe.org.eg/en/auctions' }, 'ar')).toEqual([
        'البنك المركزي المصري',
      ]);
    });

    it('hosts without bank match (aggregators) return Latin name in both locales', () => {
      expect(sourceNames({ sources: ['foudalens.com'] }, 'en')).toEqual(['FoudaLens']);
      expect(sourceNames({ sources: ['foudalens.com'] }, 'ar')).toEqual(['FoudaLens']);
      expect(sourceNames({ sources: ['bankygate.com'] }, 'en')).toEqual(['Banky']);
      expect(sourceNames({ sources: ['bankygate.com'] }, 'ar')).toEqual(['Banky']);
    });

    it('falls back to bare host for uncatalogued domains in both locales', () => {
      expect(sourceNames({ sources: ['custombank.com'] }, 'en')).toEqual(['custombank.com']);
      expect(sourceNames({ sources: ['custombank.com'] }, 'ar')).toEqual(['custombank.com']);
      expect(sourceNames({ sourceUrl: 'https://rates.example.org/path' }, 'en')).toEqual([
        'rates.example.org',
      ]);
      expect(sourceNames({ sourceUrl: 'https://rates.example.org/path' }, 'ar')).toEqual([
        'rates.example.org',
      ]);
    });

    it('every ar value in KNOWN_SOURCES equals bank_ar of the matching bank in banks.csv', async () => {
      const { KNOWN_SOURCES } = await import('../index');

      for (const [host, entry] of Object.entries(KNOWN_SOURCES)) {
        if (entry.ar) {
          // Find matching bank in fixture where website host matches
          const matchingBank = fixtureBanks.find((b) => {
            if (!b.website) return false;
            try {
              const u = new URL(b.website.startsWith('http') ? b.website : `https://${b.website}`);
              const h = u.hostname.toLowerCase().replace(/^www\./, '');
              return h === host;
            } catch {
              return false;
            }
          });
          if (matchingBank) {
            expect(entry.ar).toBe(matchingBank.bankAr);
          }
        }
      }
    });

    it('every active fixture row returns at least one name in both locales', { timeout: 15000 }, () => {
      for (const offer of fixtureOffers) {
        const enNames = sourceNames(offer, 'en');
        const arNames = sourceNames(offer, 'ar');
        expect(enNames.length).toBeGreaterThan(0);
        expect(arNames.length).toBeGreaterThan(0);
        expect(enNames[0]).toBeTruthy();
        expect(arNames[0]).toBeTruthy();
      }

      for (const fund of fixtureFunds) {
        const enNames = sourceNames(fund, 'en');
        const arNames = sourceNames(fund, 'ar');
        expect(enNames.length).toBeGreaterThan(0);
        expect(arNames.length).toBeGreaterThan(0);
        expect(enNames[0]).toBeTruthy();
        expect(arNames[0]).toBeTruthy();
      }
    });

    it('preserves already readable source names if not matched', () => {
      expect(sourceNames({ sources: ['Custom Source Name'] }, 'en')).toEqual([
        'Custom Source Name',
      ]);
      expect(sourceNames({ sources: ['Custom Source Name'] }, 'ar')).toEqual([
        'Custom Source Name',
      ]);
    });

    it('returns empty array when neither sources nor sourceUrl is present', () => {
      expect(sourceNames({})).toEqual([]);
      expect(sourceNames({ sources: [], sourceUrl: null })).toEqual([]);
    });
  });

  describe('Lookups', () => {
    it('finds bank for an offer by bankCode (sync and async)', async () => {
      const bank = findBankForOffer(mockOffer, mockBanks);
      expect(bank).not.toBeNull();
      expect(bank?.code).toBe('bm');
      expect(bank?.bankEn).toBe('Banque Misr');

      const asyncBank = await getBankForOffer(mockOffer, mockBanks);
      expect(asyncBank?.code).toBe('bm');
    });

    it('finds manager for a fund by managerAr (sync and async)', async () => {
      const manager = findManagerForFund(mockFund, mockManagers);
      expect(manager).not.toBeNull();
      expect(manager?.managerAr).toBe('سي آي لإدارة الأصول');
      expect(manager?.managerEn).toBe('CI Capital Asset Management');

      const asyncManager = await getManagerForFund(mockFund, mockManagers);
      expect(asyncManager?.managerAr).toBe('سي آي لإدارة الأصول');
    });

    it('finds all products of a bank (sync and async)', async () => {
      const offers: Offer[] = [
        mockOffer,
        { ...mockOffer, id: 'bm-2' },
        { ...mockOffer, id: 'nbe-1', bankCode: 'nbe' },
      ];
      const bmProducts = findBankProducts('bm', offers);
      expect(bmProducts.length).toBe(2);
      expect(bmProducts.map((p) => p.id)).toEqual(['bm-fixed-36m-monthly', 'bm-2']);

      const asyncBmProducts = await getBankProducts('bm', offers);
      expect(asyncBmProducts.length).toBe(2);
    });

    it('returns null or empty array when lookup finds nothing', async () => {
      const unknownOffer: Offer = { ...mockOffer, bankCode: 'unknown-bank' };
      expect(findBankForOffer(unknownOffer, mockBanks)).toBeNull();
      expect(await getBankForOffer(unknownOffer, mockBanks)).toBeNull();

      const unknownFund: Fund = { ...mockFund, managerAr: 'جهة إدارة غير موجودة' };
      expect(findManagerForFund(unknownFund, mockManagers)).toBeNull();
      expect(await getManagerForFund(unknownFund, mockManagers)).toBeNull();

      expect(findBankProducts('unknown-bank', [mockOffer])).toEqual([]);
      expect(await getBankProducts('unknown-bank', [mockOffer])).toEqual([]);
    });
  });
});

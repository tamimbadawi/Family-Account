import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVESTMENT_VALUES,
  DEFAULT_WALLETS,
  generateRealisticEntries,
  SEED_VERSION,
  toLocalDateString,
  WALLET_INVEST_CERT_ID,
  WALLET_INVEST_GOLD_ID,
} from './mock-seed';

describe('generateRealisticEntries timestamps', () => {
  // Early and mid-month: sample entries meant for later days are clamped to today
  for (const base of [new Date(2026, 9, 7, 9, 30), new Date(2026, 9, 2, 8, 0), new Date(2026, 9, 20, 18, 0)]) {
    it(`never stamps an entry after the seed time (${base.toDateString()})`, () => {
      const entries = generateRealisticEntries(base);
      for (const e of entries) {
        expect(new Date(e.created_at).getTime()).toBeLessThanOrEqual(base.getTime());
      }
    });

    it(`stamps each current-month entry on its own occurred_on day (${base.toDateString()})`, () => {
      const month = toLocalDateString(base).slice(0, 7);
      const entries = generateRealisticEntries(base).filter((e) => e.occurred_on.startsWith(month));
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        expect(e.occurred_on <= toLocalDateString(base)).toBe(true);
        expect(toLocalDateString(new Date(e.created_at))).toBe(e.occurred_on);
      }
    });
  }
});

describe('sample investments', () => {
  it('bumps SEED_VERSION to 6', () => {
    expect(SEED_VERSION).toBe(6);
  });

  it('exports sample investment wallets in DEFAULT_WALLETS with required IDs and properties', () => {
    expect(WALLET_INVEST_GOLD_ID).toBe('aaaaaaaa-0000-0000-0000-0000000000e1');
    expect(WALLET_INVEST_CERT_ID).toBe('aaaaaaaa-0000-0000-0000-0000000000e2');

    const gold = DEFAULT_WALLETS.find((w) => w.id === WALLET_INVEST_GOLD_ID);
    expect(gold).toBeDefined();
    expect(gold?.purpose).toBe('investment');
    expect(gold?.investment_kind).toBe('gold');
    expect(gold?.opening_balance).toBe(80000);
    expect(gold?.name_en).toBe('Gold');
    expect(gold?.name_ar).toBe('ذهب');

    const cert = DEFAULT_WALLETS.find((w) => w.id === WALLET_INVEST_CERT_ID);
    expect(cert).toBeDefined();
    expect(cert?.purpose).toBe('investment');
    expect(cert?.investment_kind).toBe('certificate');
    expect(cert?.opening_balance).toBe(150000);
    expect(cert?.name_en).toBe('Bank certificate');
    expect(cert?.name_ar).toBe('شهادة بنكية');
    const expectedMaturesOn = `${new Date().getFullYear() + 2}-03-01`;
    expect(cert?.matures_on).toBe(expectedMaturesOn);
  });

  it('exports sample investment value updates dated in the past', () => {
    const today = toLocalDateString(new Date());
    expect(DEFAULT_INVESTMENT_VALUES.length).toBe(2);

    for (const v of DEFAULT_INVESTMENT_VALUES) {
      expect(v.valued_on <= today).toBe(true);
      expect(new Date(v.created_at).getTime()).toBeLessThanOrEqual(Date.now());
    }

    const goldVal = DEFAULT_INVESTMENT_VALUES.find((v) => v.account_id === WALLET_INVEST_GOLD_ID);
    expect(goldVal?.value).toBe(96000);

    const certVal = DEFAULT_INVESTMENT_VALUES.find((v) => v.account_id === WALLET_INVEST_CERT_ID);
    expect(certVal?.value).toBe(154000);
  });
});


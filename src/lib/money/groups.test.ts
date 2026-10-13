import { describe, expect, it } from 'vitest';
import { splitByPurpose, totalsByCurrency } from './groups';
import type { WalletPurpose } from '../data/types';

describe('groups', () => {
  describe('splitByPurpose', () => {
    it('splits wallets into spending, goal, and investment, skipping archived', () => {
      const wallets: { id: string; purpose?: WalletPurpose; isArchived?: boolean }[] = [
        { id: '1', purpose: 'spending', isArchived: false },
        { id: '2', purpose: 'goal', isArchived: false },
        { id: '3', purpose: 'investment', isArchived: false },
        { id: '4', isArchived: false }, // legacy: defaults to spending
        { id: '5', purpose: 'spending', isArchived: true }, // archived: skipped
        { id: '6', purpose: 'goal', isArchived: true }, // archived: skipped
        { id: '7', purpose: 'investment', isArchived: true }, // archived: skipped
      ];

      const split = splitByPurpose(wallets);
      expect(split.spending.map((w) => w.id)).toEqual(['1', '4']);
      expect(split.goal.map((w) => w.id)).toEqual(['2']);
      expect(split.investment.map((w) => w.id)).toEqual(['3']);
    });
  });

  describe('totalsByCurrency', () => {
    it('groups by currency, preserving first appearance order and never adding across currencies', () => {
      const items = [
        { currency: 'EGP', amount: 100.5 },
        { currency: 'USD', amount: 50 },
        { currency: 'EGP', amount: 200.25 },
        { currency: 'EUR', amount: 75.1 },
        { currency: 'USD', amount: 25 },
      ];

      const totals = totalsByCurrency(items);
      expect(totals).toEqual([
        { currency: 'EGP', amount: 300.75 },
        { currency: 'USD', amount: 75 },
        { currency: 'EUR', amount: 75.1 },
      ]);
    });

    it('handles empty items', () => {
      expect(totalsByCurrency([])).toEqual([]);
    });
  });
});

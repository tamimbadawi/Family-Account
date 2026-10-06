import { describe, it, expect } from 'vitest';
import { calculateIncomeSources } from './income-sources';
import type { EnrichedEntry } from '@/lib/data/types';

describe('calculateIncomeSources', () => {
  const entries: EnrichedEntry[] = [
    {
      id: 'e1',
      householdId: 'h1',
      type: 'income',
      amount: 10000,
      occurredOn: '2026-10-01',
      accountId: 'w1',
      toAccountId: null,
      itemId: 'i1',
      itemNameEn: 'Salary',
      itemNameAr: 'مرتب',
      note: null,
      createdBy: 'u1',
      updatedBy: null,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
    },
    {
      id: 'e2',
      householdId: 'h1',
      type: 'income',
      amount: 2500,
      occurredOn: '2026-10-05',
      accountId: 'w1',
      toAccountId: null,
      itemId: 'i2',
      itemNameEn: 'Consulting',
      itemNameAr: 'استشارات',
      note: null,
      createdBy: 'u1',
      updatedBy: null,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
    },
  ];

  it('groups income by item and calculates percentages', () => {
    const result = calculateIncomeSources(entries, undefined, 'en');

    expect(result.totalIncome).toBe(12500);
    expect(result.sources).toHaveLength(2);

    expect(result.sources[0].name).toBe('Salary');
    expect(result.sources[0].amount).toBe(10000);
    expect(result.sources[0].percentage).toBe(80);

    expect(result.sources[1].name).toBe('Consulting');
    expect(result.sources[1].amount).toBe(2500);
    expect(result.sources[1].percentage).toBe(20);
  });
});

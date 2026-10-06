import { describe, it, expect } from 'vitest';
import { calculateBiggestExpenses } from './biggest-expenses';
import type { EnrichedEntry } from '@/lib/data/types';

describe('calculateBiggestExpenses', () => {
  const entries: EnrichedEntry[] = [
    {
      id: 'e1',
      householdId: 'h1',
      type: 'expense',
      amount: 1200,
      occurredOn: '2026-10-01',
      accountId: 'w1',
      toAccountId: null,
      itemId: 'i1',
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
      type: 'expense',
      amount: 3500,
      occurredOn: '2026-10-05',
      accountId: 'w1',
      toAccountId: null,
      itemId: 'i2',
      note: null,
      createdBy: 'u1',
      updatedBy: null,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
    },
    {
      id: 'e3',
      householdId: 'h1',
      type: 'expense',
      amount: 800,
      occurredOn: '2026-09-25',
      accountId: 'w1',
      toAccountId: null,
      itemId: 'i3',
      note: null,
      createdBy: 'u1',
      updatedBy: null,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
    },
  ];

  it('ranks entries descending and respects limit', () => {
    const result = calculateBiggestExpenses(entries, undefined, 2);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].id).toBe('e2');
    expect(result.entries[0].amount).toBe(3500);
    expect(result.entries[1].id).toBe('e1');
    expect(result.entries[1].amount).toBe(1200);
    expect(result.totalAmount).toBe(4700);
  });

  it('filters by date range', () => {
    const result = calculateBiggestExpenses(entries, {
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(result.entries).toHaveLength(2);
    expect(result.totalAmount).toBe(4700);
  });
});

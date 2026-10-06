import { describe, it, expect } from 'vitest';
import { calculateSpendingCalendar } from './spending-calendar';
import type { EnrichedEntry } from '@/lib/data/types';

describe('calculateSpendingCalendar', () => {
  const entries: EnrichedEntry[] = [
    {
      id: 'e1',
      householdId: 'h1',
      type: 'expense',
      amount: 500,
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
      amount: 1000,
      occurredOn: '2026-10-15',
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
  ];

  it('builds calendar for October 2026 correctly', () => {
    const result = calculateSpendingCalendar(entries, '2026-10');

    expect(result.month).toBe('2026-10');
    expect(result.days).toHaveLength(31);
    expect(result.monthTotal).toBe(1500);

    // 2026-10-01 was Thursday (JS day 4) -> Egypt weekday (4+1)%7 = 5
    expect(result.days[0].dayNumber).toBe(1);
    expect(result.days[0].amount).toBe(500);
    expect(result.days[0].tintRatio).toBe(0.5);

    // 2026-10-15 is highest spend (1000)
    expect(result.days[14].amount).toBe(1000);
    expect(result.days[14].tintRatio).toBe(1);
    expect(result.highestDay?.amount).toBe(1000);
  });
});

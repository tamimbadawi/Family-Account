import { describe, it, expect } from 'vitest';
import { calculateYearSummary } from './year-summary';
import type { Entry } from '@/lib/data/types';

describe('calculateYearSummary', () => {
  const entries: Entry[] = [
    {
      id: 'e1',
      householdId: 'h1',
      type: 'income',
      amount: 10000,
      occurredOn: '2026-01-10',
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
      amount: 4000,
      occurredOn: '2026-01-15',
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
      amount: 6000,
      occurredOn: '2026-02-15',
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

  it('aggregates 12 months with income, expenses, and savings', () => {
    const result = calculateYearSummary(entries, 2026, 'en');

    expect(result.year).toBe(2026);
    expect(result.months).toHaveLength(12);

    expect(result.months[0].month).toBe('2026-01');
    expect(result.months[0].income).toBe(10000);
    expect(result.months[0].expense).toBe(4000);
    expect(result.months[0].net).toBe(6000);

    expect(result.months[1].month).toBe('2026-02');
    expect(result.months[1].income).toBe(0);
    expect(result.months[1].expense).toBe(6000);
    expect(result.months[1].net).toBe(-6000);

    expect(result.totalIncome).toBe(10000);
    expect(result.totalExpense).toBe(10000);
    expect(result.totalSaved).toBe(0);
    // 2 active months with expenses
    expect(result.monthlyAverageExpense).toBe(5000);
  });
});

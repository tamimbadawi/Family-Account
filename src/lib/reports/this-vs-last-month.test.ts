import { describe, it, expect } from 'vitest';
import { calculateThisVsLastMonth } from './this-vs-last-month';
import type { Category, EnrichedEntry } from '@/lib/data/types';

describe('calculateThisVsLastMonth', () => {
  const categories: Category[] = [
    {
      id: 'cat-1',
      householdId: 'h1',
      nameAr: 'طعام',
      nameEn: 'Food',
      color: '#0F766E',
      icon: 'utensils',
      kind: 'expense',
      sortOrder: 1,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat-2',
      householdId: 'h1',
      nameAr: 'مواصلات',
      nameEn: 'Transport',
      color: '#C2410C',
      icon: 'car',
      kind: 'expense',
      sortOrder: 2,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const entries: EnrichedEntry[] = [
    {
      id: 'e1',
      householdId: 'h1',
      type: 'expense',
      amount: 500,
      occurredOn: '2026-10-10',
      accountId: 'w1',
      toAccountId: null,
      itemId: 'i1',
      categoryId: 'cat-1',
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
      amount: 400,
      occurredOn: '2026-09-15',
      accountId: 'w1',
      toAccountId: null,
      itemId: 'i1',
      categoryId: 'cat-1',
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
      amount: 200,
      occurredOn: '2026-09-20',
      accountId: 'w1',
      toAccountId: null,
      itemId: 'i2',
      categoryId: 'cat-2',
      note: null,
      createdBy: 'u1',
      updatedBy: null,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
    },
  ];

  it('calculates this month vs last month spending accurately', () => {
    const result = calculateThisVsLastMonth(entries, categories, '2026-10', 'en');

    expect(result.currentMonth).toBe('2026-10');
    expect(result.previousMonth).toBe('2026-09');
    expect(result.thisMonthTotal).toBe(500);
    expect(result.lastMonthTotal).toBe(600);
    expect(result.totalDiffAmount).toBe(-100);
    expect(result.totalDiffPercent).toBe(-17);

    expect(result.categories).toHaveLength(2);
    // cat-1 is top because it has 500 this month
    expect(result.categories[0].id).toBe('cat-1');
    expect(result.categories[0].thisMonthAmount).toBe(500);
    expect(result.categories[0].lastMonthAmount).toBe(400);
    expect(result.categories[0].diffAmount).toBe(100);
    expect(result.categories[0].diffPercent).toBe(25);
    expect(result.categories[0].isUp).toBe(true);

    // cat-2 had 0 this month, 200 last month
    expect(result.categories[1].id).toBe('cat-2');
    expect(result.categories[1].thisMonthAmount).toBe(0);
    expect(result.categories[1].lastMonthAmount).toBe(200);
    expect(result.categories[1].diffAmount).toBe(-200);
    expect(result.categories[1].isUp).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { calculateCategoryDeepDive } from './category-deep-dive';
import type { Category, EnrichedEntry, Item, Subcategory } from '@/lib/data/types';

describe('calculateCategoryDeepDive', () => {
  const categories: Category[] = [
    {
      id: 'cat-food',
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
  ];

  const subcategories: Subcategory[] = [
    {
      id: 'sub-groceries',
      householdId: 'h1',
      categoryId: 'cat-food',
      nameAr: 'سوبرماركت',
      nameEn: 'Groceries',
      sortOrder: 1,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const items: Item[] = [
    {
      id: 'item-milk',
      householdId: 'h1',
      subcategoryId: 'sub-groceries',
      nameAr: 'لبن',
      nameEn: 'Milk',
      sortOrder: 1,
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
      amount: 300,
      occurredOn: '2026-10-01',
      accountId: 'w1',
      toAccountId: null,
      itemId: 'item-milk',
      categoryId: 'cat-food',
      subcategoryId: 'sub-groceries',
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
      amount: 500,
      occurredOn: '2026-09-01',
      accountId: 'w1',
      toAccountId: null,
      itemId: 'item-milk',
      categoryId: 'cat-food',
      subcategoryId: 'sub-groceries',
      note: null,
      createdBy: 'u1',
      updatedBy: null,
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
    },
  ];

  it('computes 12-month trend and subcategory breakdown', () => {
    const result = calculateCategoryDeepDive(
      entries,
      'cat-food',
      '2026-10',
      categories,
      subcategories,
      items,
      'en'
    );

    expect(result.categoryId).toBe('cat-food');
    expect(result.categoryName).toBe('Food');
    expect(result.currentMonthTotal).toBe(300);
    expect(result.trend12Months).toHaveLength(12);

    expect(result.subcategories).toHaveLength(1);
    expect(result.subcategories[0].name).toBe('Groceries');
    expect(result.subcategories[0].amount).toBe(300);
    expect(result.subcategories[0].items[0].name).toBe('Milk');
    expect(result.subcategories[0].items[0].amount).toBe(300);
  });
});

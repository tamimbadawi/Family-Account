import { describe, expect, it } from 'vitest';
import { generateRealisticEntries, getFlattenedCategoryTree } from '../data/mock-seed';
import type { Category, Entry, Item, Member, Subcategory, Wallet } from '../data/types';
import { pivotToCsv } from './export';
import { getEgyptWeekStart, pivot } from './pivot';
import { PIVOT_PRESETS, resolvePresetPeriod } from './presets';

describe('pivot engine', () => {
  const catHousehold: Category = {
    id: 'cat-1',
    householdId: 'h-1',
    kind: 'expense',
    nameAr: 'المنزل',
    nameEn: 'Household',
    icon: 'house',
    color: '#0F766E',
    sortOrder: 0,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const catFood: Category = {
    id: 'cat-2',
    householdId: 'h-1',
    kind: 'expense',
    nameAr: 'الطعام',
    nameEn: 'Food',
    icon: 'shopping-basket',
    color: '#B45309',
    sortOrder: 1,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const catIncome: Category = {
    id: 'cat-inc',
    householdId: 'h-1',
    kind: 'income',
    nameAr: 'الدخل',
    nameEn: 'Income',
    icon: 'wallet',
    color: '#15803D',
    sortOrder: 2,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const subUtilities: Subcategory = {
    id: 'sub-1',
    householdId: 'h-1',
    categoryId: 'cat-1',
    nameAr: 'المرافق',
    nameEn: 'Utilities',
    sortOrder: 0,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const itemElectricity: Item = {
    id: 'item-1',
    householdId: 'h-1',
    subcategoryId: 'sub-1',
    nameAr: 'كهرباء',
    nameEn: 'Electricity',
    sortOrder: 0,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const itemGroceries: Item = {
    id: 'item-2',
    householdId: 'h-1',
    subcategoryId: 'sub-2',
    nameAr: 'بقالة',
    nameEn: 'Groceries',
    sortOrder: 0,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const walletCash: Wallet = {
    id: 'w-cash',
    householdId: 'h-1',
    nameAr: 'كاش',
    nameEn: 'Cash',
    type: 'cash',
    openingBalance: 1000,
    icon: 'banknote',
    color: '#0F766E',
    sortOrder: 0,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const memberMama: Member = {
    householdId: 'h-1',
    userId: 'u-mama',
    displayName: 'ماما',
    role: 'owner',
    locale: 'ar',
    createdAt: '2026-01-01',
  };

  const lookups = {
    categories: [catHousehold, catFood, catIncome],
    subcategories: [subUtilities],
    items: [itemElectricity, itemGroceries],
    wallets: [walletCash],
    members: [memberMama],
    locale: 'en' as const,
  };

  it('handles empty input gracefully', () => {
    const res = pivot([], lookups, {
      measure: 'expense',
      rows: 'category',
      columns: 'none',
    });

    expect(res.rowKeys).toEqual([]);
    expect(res.rowLabels).toEqual([]);
    expect(res.colKeys).toEqual(['total']);
    expect(res.colLabels).toEqual(['Total']);
    expect(res.cells).toEqual([]);
    expect(res.rowTotals).toEqual([]);
    expect(res.colTotals).toEqual([0]);
    expect(res.grandTotal).toBe(0);
  });

  it('computes a single cell accurately', () => {
    const entry: Entry = {
      id: 'e-1',
      householdId: 'h-1',
      type: 'expense',
      amount: 150.5,
      occurredOn: '2026-10-06',
      accountId: 'w-cash',
      toAccountId: null,
      itemId: 'item-1',
      note: 'فاتورة الكهرباء',
      createdBy: 'u-mama',
      updatedBy: null,
      createdAt: '2026-10-06T10:00:00Z',
      updatedAt: '2026-10-06T10:00:00Z',
      deletedAt: null,
    };

    const res = pivot([entry], lookups, {
      measure: 'expense',
      rows: 'category',
      columns: 'none',
    });

    expect(res.rowKeys).toEqual(['cat-1']);
    expect(res.rowLabels).toEqual(['Household']);
    expect(res.cells).toEqual([[150.5]]);
    expect(res.rowTotals).toEqual([150.5]);
    expect(res.colTotals).toEqual([150.5]);
    expect(res.grandTotal).toBe(150.5);
  });

  it('computes net measure correctly with mixed types (income positive, expense negative)', () => {
    const incomeEntry: Entry = {
      id: 'e-inc',
      householdId: 'h-1',
      type: 'income',
      amount: 5000,
      occurredOn: '2026-10-01',
      accountId: 'w-cash',
      toAccountId: null,
      itemId: 'item-1',
      note: null,
      createdBy: 'u-mama',
      updatedBy: null,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
      deletedAt: null,
    };

    const expenseEntry: Entry = {
      id: 'e-exp',
      householdId: 'h-1',
      type: 'expense',
      amount: 1200,
      occurredOn: '2026-10-02',
      accountId: 'w-cash',
      toAccountId: null,
      itemId: 'item-1',
      note: null,
      createdBy: 'u-mama',
      updatedBy: null,
      createdAt: '2026-10-02T10:00:00Z',
      updatedAt: '2026-10-02T10:00:00Z',
      deletedAt: null,
    };

    const res = pivot([incomeEntry, expenseEntry], lookups, {
      measure: 'net',
      rows: 'wallet',
      columns: 'none',
    });

    expect(res.cells[0][0]).toBe(3800);
    expect(res.grandTotal).toBe(3800);
  });

  it('excludes transfers from calculations', () => {
    const transferEntry: Entry = {
      id: 'e-tr',
      householdId: 'h-1',
      type: 'transfer',
      amount: 4000,
      occurredOn: '2026-10-02',
      accountId: 'w-cash',
      toAccountId: 'w-bank',
      itemId: null,
      note: 'تحويل',
      createdBy: 'u-mama',
      updatedBy: null,
      createdAt: '2026-10-02T10:00:00Z',
      updatedAt: '2026-10-02T10:00:00Z',
      deletedAt: null,
    };

    const resExpense = pivot([transferEntry], lookups, {
      measure: 'expense',
      rows: 'wallet',
      columns: 'none',
    });
    expect(resExpense.grandTotal).toBe(0);

    const resNet = pivot([transferEntry], lookups, {
      measure: 'net',
      rows: 'wallet',
      columns: 'none',
    });
    expect(resNet.grandTotal).toBe(0);
  });

  it('handles Egyptian week boundaries starting on Saturday', () => {
    // Oct 2, 2026 is a Friday (belongs to week of Sat Sep 26)
    // Oct 3, 2026 is a Saturday (starts week of Sat Oct 3)
    // Oct 4, 2026 is a Sunday (belongs to week of Sat Oct 3)
    // Oct 9, 2026 is a Friday (belongs to week of Sat Oct 3)
    // Oct 10, 2026 is a Saturday (starts week of Sat Oct 10)

    const friOct2 = getEgyptWeekStart(new Date(2026, 9, 2));
    const satOct3 = getEgyptWeekStart(new Date(2026, 9, 3));
    const sunOct4 = getEgyptWeekStart(new Date(2026, 9, 4));
    const friOct9 = getEgyptWeekStart(new Date(2026, 9, 9));
    const satOct10 = getEgyptWeekStart(new Date(2026, 9, 10));

    expect(satOct3.getTime()).toBe(sunOct4.getTime());
    expect(satOct3.getTime()).toBe(friOct9.getTime());
    expect(friOct2.getTime()).not.toBe(satOct3.getTime());
    expect(satOct10.getTime()).not.toBe(satOct3.getTime());

    const entries: Entry[] = [
      {
        id: 'e-1',
        householdId: 'h-1',
        type: 'expense',
        amount: 100,
        occurredOn: '2026-10-03', // Saturday
        accountId: 'w-cash',
        toAccountId: null,
        itemId: 'item-1',
        note: null,
        createdBy: null,
        updatedBy: null,
        createdAt: '2026-10-03',
        updatedAt: '2026-10-03',
        deletedAt: null,
      },
      {
        id: 'e-2',
        householdId: 'h-1',
        type: 'expense',
        amount: 200,
        occurredOn: '2026-10-04', // Sunday
        accountId: 'w-cash',
        toAccountId: null,
        itemId: 'item-1',
        note: null,
        createdBy: null,
        updatedBy: null,
        createdAt: '2026-10-04',
        updatedAt: '2026-10-04',
        deletedAt: null,
      },
      {
        id: 'e-3',
        householdId: 'h-1',
        type: 'expense',
        amount: 300,
        occurredOn: '2026-10-09', // Friday
        accountId: 'w-cash',
        toAccountId: null,
        itemId: 'item-1',
        note: null,
        createdBy: null,
        updatedBy: null,
        createdAt: '2026-10-09',
        updatedAt: '2026-10-09',
        deletedAt: null,
      },
      {
        id: 'e-4',
        householdId: 'h-1',
        type: 'expense',
        amount: 400,
        occurredOn: '2026-10-10', // Saturday (next week)
        accountId: 'w-cash',
        toAccountId: null,
        itemId: 'item-1',
        note: null,
        createdBy: null,
        updatedBy: null,
        createdAt: '2026-10-10',
        updatedAt: '2026-10-10',
        deletedAt: null,
      },
    ];

    const res = pivot(entries, lookups, {
      measure: 'expense',
      rows: 'category',
      columns: 'week',
    });

    // Should produce 2 week columns
    expect(res.colKeys).toHaveLength(2);
    // Newest week first
    expect(res.colKeys[0]).toBe('2026-10-10');
    expect(res.colKeys[1]).toBe('2026-10-03');
    // Week of Oct 10 has 400, week of Oct 3 has 100 + 200 + 300 = 600
    expect(res.cells[0][0]).toBe(400);
    expect(res.cells[0][1]).toBe(600);
  });

  it('respects month boundaries in local time without UTC skew', () => {
    const entries: Entry[] = [
      {
        id: 'e-sep',
        householdId: 'h-1',
        type: 'expense',
        amount: 50,
        occurredOn: '2026-09-30',
        accountId: 'w-cash',
        toAccountId: null,
        itemId: 'item-1',
        note: null,
        createdBy: null,
        updatedBy: null,
        createdAt: '2026-09-30',
        updatedAt: '2026-09-30',
        deletedAt: null,
      },
      {
        id: 'e-oct',
        householdId: 'h-1',
        type: 'expense',
        amount: 75,
        occurredOn: '2026-10-01',
        accountId: 'w-cash',
        toAccountId: null,
        itemId: 'item-1',
        note: null,
        createdBy: null,
        updatedBy: null,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
        deletedAt: null,
      },
    ];

    const res = pivot(entries, lookups, {
      measure: 'expense',
      rows: 'category',
      columns: 'month',
    });

    expect(res.colKeys).toContain('2026-09');
    expect(res.colKeys).toContain('2026-10');
    // Chronological newest first
    expect(res.colKeys).toEqual(['2026-10', '2026-09']);
    expect(res.cells[0]).toEqual([75, 50]);
  });

  it('excludes soft-deleted entries', () => {
    const activeEntry: Entry = {
      id: 'e-act',
      householdId: 'h-1',
      type: 'expense',
      amount: 100,
      occurredOn: '2026-10-05',
      accountId: 'w-cash',
      toAccountId: null,
      itemId: 'item-1',
      note: null,
      createdBy: null,
      updatedBy: null,
      createdAt: '2026-10-05',
      updatedAt: '2026-10-05',
      deletedAt: null,
    };

    const deletedEntry: Entry = {
      id: 'e-del',
      householdId: 'h-1',
      type: 'expense',
      amount: 250,
      occurredOn: '2026-10-05',
      accountId: 'w-cash',
      toAccountId: null,
      itemId: 'item-1',
      note: null,
      createdBy: null,
      updatedBy: null,
      createdAt: '2026-10-05',
      updatedAt: '2026-10-05',
      deletedAt: '2026-10-05T12:00:00Z',
    };

    const res = pivot([activeEntry, deletedEntry], lookups, {
      measure: 'expense',
      rows: 'category',
      columns: 'none',
    });

    expect(res.grandTotal).toBe(100);
  });

  it('filters by category accurately', () => {
    const entries: Entry[] = [
      {
        id: 'e-h',
        householdId: 'h-1',
        type: 'expense',
        amount: 200,
        occurredOn: '2026-10-01',
        accountId: 'w-cash',
        toAccountId: null,
        itemId: 'item-1', // belongs to cat-1 Household
        note: null,
        createdBy: null,
        updatedBy: null,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
        deletedAt: null,
      },
      {
        id: 'e-f',
        householdId: 'h-1',
        type: 'expense',
        amount: 300,
        occurredOn: '2026-10-01',
        accountId: 'w-cash',
        toAccountId: null,
        itemId: 'item-2', // belongs to cat-2 Food
        note: null,
        createdBy: null,
        updatedBy: null,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
        deletedAt: null,
      },
    ];

    const res = pivot(entries, lookups, {
      measure: 'expense',
      rows: 'item',
      columns: 'none',
      filter: { categoryId: 'cat-1' },
    });

    expect(res.rowKeys).toEqual(['item-1']);
    expect(res.grandTotal).toBe(200);
  });

  it('generates 12 month columns across a 12-month period in newest-first order', () => {
    const entry: Entry = {
      id: 'e-1',
      householdId: 'h-1',
      type: 'expense',
      amount: 100,
      occurredOn: '2026-10-01',
      accountId: 'w-cash',
      toAccountId: null,
      itemId: 'item-1',
      note: null,
      createdBy: null,
      updatedBy: null,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
      deletedAt: null,
    };

    const res = pivot([entry], lookups, {
      measure: 'expense',
      rows: 'category',
      columns: 'month',
      period: {
        from: '2025-11-01',
        to: '2026-10-31',
      },
    });

    expect(res.colKeys).toHaveLength(12);
    expect(res.colKeys[0]).toBe('2026-10');
    expect(res.colKeys[11]).toBe('2025-11');
    expect(res.cells[0][0]).toBe(100);
    expect(res.cells[0][1]).toBe(0);
  });

  it('runs each of the 5 presets successfully on realistic sample data', () => {
    const tree = getFlattenedCategoryTree();
    const realisticEntries = generateRealisticEntries(new Date(2026, 9, 6));

    const fullLookups = {
      categories: tree.categories,
      subcategories: tree.subcategories,
      items: tree.items,
      wallets: [walletCash],
      members: [memberMama],
      locale: 'ar' as const,
    };

    for (const preset of PIVOT_PRESETS) {
      const period = resolvePresetPeriod(preset.periodPreset, new Date(2026, 9, 6));
      const res = pivot(realisticEntries, fullLookups, {
        ...preset.config,
        period,
      });

      expect(res.colKeys.length).toBeGreaterThanOrEqual(1);
      expect(res.grandTotal).toBeGreaterThan(0);
      expect(res.rowLabels.length).toBe(res.rowKeys.length);
      expect(res.colLabels.length).toBe(res.colKeys.length);
      expect(res.cells.length).toBe(res.rowKeys.length);
    }
  });

  it('exports pivot result to CSV with UTF-8 BOM and Western digits', () => {
    const res = pivot(
      [
        {
          id: 'e-1',
          householdId: 'h-1',
          type: 'expense',
          amount: 250.75,
          occurredOn: '2026-10-06',
          accountId: 'w-cash',
          toAccountId: null,
          itemId: 'item-1',
          note: null,
          createdBy: null,
          updatedBy: null,
          createdAt: '2026-10-06',
          updatedAt: '2026-10-06',
          deletedAt: null,
        },
      ],
      lookups,
      {
        measure: 'expense',
        rows: 'category',
        columns: 'none',
        locale: 'ar',
      }
    );

    const csvAr = pivotToCsv(res, 'ar');
    expect(csvAr.startsWith('\uFEFF')).toBe(true);
    expect(csvAr).toContain('البند');
    expect(csvAr).toContain('الإجمالي');
    expect(csvAr).toContain('250.75');

    const csvEn = pivotToCsv(res, 'en');
    expect(csvEn.startsWith('\uFEFF')).toBe(true);
    expect(csvEn).toContain('Item');
    expect(csvEn).toContain('Total');
  });
});

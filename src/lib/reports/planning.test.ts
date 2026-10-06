import { describe, expect, it } from 'vitest';
import type { PivotEntry } from '../data/types';
import {
  billsTracker,
  monthlyAverages,
  normalizeSearchText,
  searchEntries,
  spendingPace,
  unusualSpending,
  whoSpentWhat,
} from './planning';

let n = 0;
function e(p: Partial<PivotEntry> & { occurredOn: string; amount: number }): PivotEntry {
  n += 1;
  return {
    id: `e${n}`,
    type: 'expense',
    month: p.occurredOn.slice(0, 7),
    week: '',
    categoryId: 'food',
    categoryNameAr: 'الطعام',
    categoryNameEn: 'Food',
    categoryIcon: null,
    categoryColor: null,
    subcategoryId: 'groceries',
    subcategoryNameAr: 'البقالة',
    subcategoryNameEn: 'Groceries',
    itemId: 'super',
    itemNameAr: 'سوبرماركت',
    itemNameEn: 'Supermarket',
    accountId: 'cash',
    accountNameAr: 'كاش',
    accountNameEn: 'Cash',
    createdById: 'mama',
    createdByName: 'ماما',
    ...p,
  };
}
const elec = (occurredOn: string, amount: number) =>
  e({ occurredOn, amount, categoryId: 'home', categoryNameEn: 'Household', subcategoryId: 'util', subcategoryNameEn: 'Utilities', itemId: 'elec', itemNameEn: 'Electricity', itemNameAr: 'كهرباء' });

describe('billsTracker', () => {
  const months = ['2026-05', '2026-06', '2026-07', '2026-08'];
  it('puts each utility item in a row with one value per month', () => {
    const rows = billsTracker([elec('2026-05-10', 400), elec('2026-06-10', 420), elec('2026-06-20', 30), e({ occurredOn: '2026-06-01', amount: 999 })], months);
    expect(rows).toHaveLength(1);
    expect(rows[0].nameEn).toBe('Electricity');
    expect(rows[0].values).toEqual([400, 450, 0, 0]);
  });
  it('flags a month that jumps more than 25% above its recent average', () => {
    const rows = billsTracker([elec('2026-05-10', 400), elec('2026-06-10', 400), elec('2026-07-10', 410), elec('2026-08-10', 700)], months);
    expect(rows[0].jumps).toEqual([3]);
  });
  it('ignores income and other subcategories', () => {
    expect(billsTracker([e({ occurredOn: '2026-05-01', amount: 50 }), { ...elec('2026-05-02', 10), type: 'income' }], months)).toEqual([]);
  });
});

describe('monthlyAverages', () => {
  it('averages over all months, counting empty months as zero', () => {
    const [food] = monthlyAverages([e({ occurredOn: '2026-07-03', amount: 300 }), e({ occurredOn: '2026-09-03', amount: 900 })], ['2026-07', '2026-08', '2026-09']);
    expect(food).toMatchObject({ id: 'food', average: 400, min: 0, max: 900 });
  });
});

describe('whoSpentWhat', () => {
  it('splits spending by person and category', () => {
    const res = whoSpentWhat(
      [e({ occurredOn: '2026-10-01', amount: 100 }), e({ occurredOn: '2026-10-02', amount: 50, createdById: 'baba', createdByName: 'بابا' }), elec('2026-10-03', 200)],
      ['2026-10'],
    );
    expect(res.map((p) => [p.id, p.total])).toEqual([['mama', 300], ['baba', 50]]);
    expect(res[0].byCategory.map((c) => c.id)).toEqual(['home', 'food']);
  });
});

describe('search', () => {
  const list = [
    { id: '1', type: 'expense' as const, amount: 120, occurredOn: '2026-10-01', itemNameAr: 'سوبرماركت', itemNameEn: 'Supermarket', note: 'خضار للعشاء' },
    { id: '2', type: 'expense' as const, amount: 900, occurredOn: '2026-10-05', itemNameAr: 'كهرباء', itemNameEn: 'Electricity' },
    { id: '3', type: 'income' as const, amount: 5000, occurredOn: '2026-10-02', itemNameAr: 'معاش', itemNameEn: 'Pension' },
  ];
  it('matches English, Arabic and notes, case- and diacritic-insensitive', () => {
    expect(searchEntries(list, { text: 'super' }).results.map((r) => r.id)).toEqual(['1']);
    expect(searchEntries(list, { text: 'كَهرباء' }).results.map((r) => r.id)).toEqual(['2']);
    expect(searchEntries(list, { text: 'خضار' }).results.map((r) => r.id)).toEqual(['1']);
  });
  it('filters by amount and date, newest first, with a signed total', () => {
    const r = searchEntries(list, { minAmount: 100, from: '2026-10-01', to: '2026-10-05' });
    expect(r.results.map((x) => x.id)).toEqual(['2', '3', '1']);
    expect(r.total).toBe(5000 - 900 - 120);
  });
  it('normalises Arabic-Indic digits and alef forms', () => {
    expect(normalizeSearchText('إيجار ١٢٠')).toBe('ايجار 120');
  });
});

describe('unusualSpending', () => {
  it('reports categories well above their normal level, in EGP and %', () => {
    const hist = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((m) => e({ occurredOn: `${m}-10`, amount: 1000 }));
    const res = unusualSpending([...hist, e({ occurredOn: '2026-10-10', amount: 1600 })], '2026-10');
    expect(res).toEqual([expect.objectContaining({ id: 'food', thisMonth: 1600, average: 1000, above: 600, ratio: 0.6 })]);
  });
  it('ignores small differences and categories with no history', () => {
    const hist = ['2026-09'].map((m) => e({ occurredOn: `${m}-10`, amount: 100 }));
    expect(unusualSpending([...hist, e({ occurredOn: '2026-10-10', amount: 150 })], '2026-10')).toEqual([]);
    expect(unusualSpending([e({ occurredOn: '2026-10-10', amount: 5000 })], '2026-10')).toEqual([]);
  });
});

describe('spendingPace', () => {
  it('compares spending so far with a typical month by the same day', () => {
    const entries = [
      e({ occurredOn: '2026-08-05', amount: 1000 }),
      e({ occurredOn: '2026-08-25', amount: 1000 }),
      e({ occurredOn: '2026-09-05', amount: 1000 }),
      e({ occurredOn: '2026-09-25', amount: 1000 }),
      e({ occurredOn: '2026-10-03', amount: 1200 }),
      e({ occurredOn: '2026-10-20', amount: 500 }), // after "today": not counted
    ];
    const p = spendingPace(entries, '2026-10-10', { lookback: 2 });
    expect(p).toEqual({ spentSoFar: 1200, typicalByToday: 1000, typicalMonth: 2000, pace: 0.2 });
  });
  it('returns pace null without history', () => {
    expect(spendingPace([e({ occurredOn: '2026-10-01', amount: 10 })], '2026-10-05').pace).toBeNull();
  });
});

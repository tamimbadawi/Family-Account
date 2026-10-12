import { describe, expect, it } from 'vitest';
import type { EnrichedEntry } from '@/lib/data/types';
import { searchCategoryTotals } from './category-search';

const food = {
  categoryId: 'c1',
  categoryNameEn: 'Food',
  categoryNameAr: 'الطعام',
  subcategoryId: 's1',
  subcategoryNameEn: 'Groceries',
  subcategoryNameAr: 'بقالة',
};
const bread = { ...food, itemId: 'i1', itemNameEn: 'Bread', itemNameAr: 'عيش' };
const milk = { ...food, itemId: 'i2', itemNameEn: 'Milk', itemNameAr: 'لبن' };
const entry = (over: Partial<EnrichedEntry>): EnrichedEntry =>
  ({ id: Math.random().toString(), type: 'expense', amount: 1, accountId: 'w1', ...over }) as EnrichedEntry;

const rows = [
  entry({ ...bread, amount: 50 }),
  entry({ ...bread, amount: 45.5 }),
  entry({ ...milk, amount: 30 }),
  entry({ ...bread, type: 'income', amount: 999 }),
  entry({ type: 'transfer', amount: 500, itemId: null }),
];

describe('searchCategoryTotals', () => {
  it('returns nothing for an empty query', () => {
    expect(searchCategoryTotals(rows, '  ', 'expense')).toEqual([]);
  });

  it('adds up an item found by name, only for the chosen kind', () => {
    const [hit, ...rest] = searchCategoryTotals(rows, 'bread', 'expense');
    expect(rest).toEqual([]);
    expect(hit).toMatchObject({ level: 'item', id: 'i1', total: 95.5, count: 2, pathEn: ['Food', 'Groceries'] });
  });

  it('finds Arabic names, ignoring letter variants', () => {
    expect(searchCategoryTotals(rows, 'عيش', 'expense')[0]).toMatchObject({ id: 'i1', total: 95.5 });
    expect(searchCategoryTotals(rows, 'بقاله', 'expense')[0]).toMatchObject({ level: 'subcategory', total: 125.5 });
  });

  it('finds a category and a group, largest first', () => {
    const hits = searchCategoryTotals(rows, 'o', 'expense'); // fOod, grOceries
    expect(hits.map((h) => h.level)).toEqual(['category', 'subcategory']);
    expect(hits[0]).toMatchObject({ id: 'c1', total: 125.5, count: 3, pathEn: [] });
  });
});

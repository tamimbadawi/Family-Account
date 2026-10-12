import { describe, expect, it } from 'vitest';
import type { EnrichedEntry } from '@/lib/data/types';
import { summarize } from './summary';

const entry = (over: Partial<EnrichedEntry>): EnrichedEntry =>
  ({ id: Math.random().toString(), type: 'expense', amount: 1, accountId: 'w1', ...over }) as EnrichedEntry;

const bread = { categoryId: 'c1', subcategoryId: 's1', itemId: 'i1' };

describe('summarize', () => {
  it('is empty for no entries', () => {
    expect(summarize(undefined)).toEqual({ spent: 0, received: 0, count: 0, item: null });
    expect(summarize([])).toEqual({ spent: 0, received: 0, count: 0, item: null });
  });

  it('adds money out and money in, rounded to 2 dp, and leaves moves out', () => {
    const s = summarize([
      entry({ amount: 10.1, ...bread }),
      entry({ amount: 20.2, ...bread }),
      entry({ type: 'income', amount: 500, categoryId: 'c9', subcategoryId: 's9', itemId: 'i9' }),
      entry({ type: 'transfer', amount: 1000, itemId: null }),
    ]);
    expect(s.spent).toBe(30.3);
    expect(s.received).toBe(500);
    expect(s.count).toBe(3);
  });

  it('names the item when every entry is the same item', () => {
    const s = summarize([entry(bread), entry(bread), entry({ type: 'transfer', itemId: null })]);
    expect(s.item).toEqual(bread);
  });

  it('names no item when the entries are different items', () => {
    expect(summarize([entry(bread), entry({ ...bread, itemId: 'i2' })]).item).toBeNull();
  });
});

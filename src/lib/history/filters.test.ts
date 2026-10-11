import { describe, expect, it } from 'vitest';
import type { EnrichedEntry } from '@/lib/data/types';
import { activeFilterCount, applyFilters, EMPTY_FILTERS, singlePick, togglePick, toListParams } from './filters';

const entry = (over: Partial<EnrichedEntry>): EnrichedEntry =>
  ({ id: Math.random().toString(), type: 'expense', amount: 1, accountId: 'w1', createdBy: 'u1', ...over }) as EnrichedEntry;

describe('togglePick', () => {
  it('turns a choice on and off', () => {
    const on = togglePick([], { categoryId: 'c1' });
    expect(on).toEqual([{ categoryId: 'c1' }]);
    expect(togglePick(on, { categoryId: 'c1' })).toEqual([]);
  });

  it('keeps choices from other categories and sibling items', () => {
    let picks = togglePick([], { categoryId: 'c2' });
    picks = togglePick(picks, { categoryId: 'c1', subcategoryId: 's1', itemId: 'i1' });
    picks = togglePick(picks, { categoryId: 'c1', subcategoryId: 's1', itemId: 'i2' });
    expect(picks.map((p) => p.itemId ?? p.categoryId)).toEqual(['c2', 'i1', 'i2']);
  });

  it('drops the choices above or below on the same path', () => {
    let picks = togglePick([], { categoryId: 'c1', subcategoryId: 's1', itemId: 'i1' });
    picks = togglePick(picks, { categoryId: 'c1', subcategoryId: 's2' });
    picks = togglePick(picks, { categoryId: 'c1' });
    expect(picks).toEqual([{ categoryId: 'c1' }]);
    picks = togglePick(picks, { categoryId: 'c1', subcategoryId: 's1' });
    expect(picks).toEqual([{ categoryId: 'c1', subcategoryId: 's1' }]);
    picks = togglePick(picks, { categoryId: 'c1', subcategoryId: 's1', itemId: 'i1' });
    expect(picks).toEqual([{ categoryId: 'c1', subcategoryId: 's1', itemId: 'i1' }]);
  });
});

describe('applyFilters', () => {
  const rows = [
    entry({ id: 'a', categoryId: 'c1', subcategoryId: 's1', itemId: 'i1', accountId: 'w1', createdBy: 'u1' }),
    entry({ id: 'b', categoryId: 'c2', subcategoryId: 's2', itemId: 'i2', accountId: 'w2', createdBy: 'u2' }),
    entry({ id: 'c', type: 'transfer', accountId: 'w3', toAccountId: 'w2', createdBy: 'u1' }),
    entry({ id: 'd', categoryId: 'c3', subcategoryId: 's3', itemId: 'i3', accountId: 'w3', createdBy: 'u3' }),
  ];
  const ids = (f: Parameters<typeof applyFilters>[1]) => applyFilters(rows, f)?.map((e) => e.id);

  it('returns everything with no choices', () => {
    expect(ids(EMPTY_FILTERS)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('matches any of several categories, groups or items', () => {
    expect(ids({ ...EMPTY_FILTERS, picks: [{ categoryId: 'c1' }, { categoryId: 'c2', subcategoryId: 's2', itemId: 'i2' }] })).toEqual(['a', 'b']);
  });

  it('matches any of several wallets, on either side of a move', () => {
    expect(ids({ ...EMPTY_FILTERS, walletIds: ['w1', 'w2'] })).toEqual(['a', 'b', 'c']);
  });

  it('matches any of several people, and combines with other parts', () => {
    expect(ids({ ...EMPTY_FILTERS, memberIds: ['u1', 'u3'] })).toEqual(['a', 'c', 'd']);
    expect(ids({ ...EMPTY_FILTERS, memberIds: ['u1', 'u3'], walletIds: ['w3'] })).toEqual(['c', 'd']);
  });
});

describe('toListParams', () => {
  it('passes a single choice to the repository and leaves several to memory', () => {
    const one = toListParams({ ...EMPTY_FILTERS, walletIds: ['w1'], picks: [{ categoryId: 'c1', subcategoryId: 's1' }] }, { month: '2026-10' });
    expect(one).toMatchObject({ accountId: 'w1', subcategoryId: 's1', categoryId: undefined, itemId: undefined });
    const many = toListParams({ ...EMPTY_FILTERS, walletIds: ['w1', 'w2'], picks: [{ categoryId: 'c1' }, { categoryId: 'c2' }] }, { month: '2026-10' });
    expect(many).toMatchObject({ accountId: undefined, categoryId: undefined });
  });
});

describe('counts', () => {
  it('counts every choice and finds the single pick', () => {
    const f = { ...EMPTY_FILTERS, picks: [{ categoryId: 'c1' }], walletIds: ['w1', 'w2'], memberIds: ['u1'] };
    expect(activeFilterCount(f)).toBe(4);
    expect(singlePick(f)).toEqual({ categoryId: 'c1' });
    expect(singlePick({ ...f, picks: [] })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { EnrichedEntry } from '@/lib/data/types';
import { entriesFor } from './drill';

const e = (over: Partial<EnrichedEntry>): EnrichedEntry =>
  ({ id: Math.random().toString(), type: 'expense', amount: 1, accountId: 'w1', toAccountId: null, occurredOn: '2026-10-05', createdAt: '', deletedAt: null, createdBy: 'u1', ...over }) as EnrichedEntry;

const rows = [
  e({ id: 'a', categoryId: 'c1', subcategoryId: 's1', itemId: 'i1', occurredOn: '2026-10-01' }),
  e({ id: 'b', categoryId: 'c1', subcategoryId: 's1', itemId: 'i2', occurredOn: '2026-10-09', createdBy: 'u2' }),
  e({ id: 'c', categoryId: 'c2', occurredOn: '2026-09-15' }),
  e({ id: 'd', type: 'transfer', accountId: 'w2', toAccountId: 'w1', occurredOn: '2026-10-03' }),
  e({ id: 'x', categoryId: 'c1', deletedAt: '2026-10-10' }),
  e({ id: 'n', categoryId: 'c1', createdBy: null }),
];

describe('entriesFor', () => {
  it('narrows by category and month, newest first, never deleted', () => {
    expect(entriesFor(rows, { categoryId: 'c1', months: ['2026-10'] }).map((r) => r.id)).toEqual(['b', 'n', 'a']);
  });
  it('narrows by item, person and date range', () => {
    expect(entriesFor(rows, { itemId: 'i2' }).map((r) => r.id)).toEqual(['b']);
    expect(entriesFor(rows, { createdBy: 'u2' }).map((r) => r.id)).toEqual(['b']);
    expect(entriesFor(rows, { createdBy: 'unknown' }).map((r) => r.id)).toEqual(['n']);
    expect(entriesFor(rows, { from: '2026-09-01', to: '2026-09-30' }).map((r) => r.id)).toEqual(['c']);
  });
  it('counts a move for both wallets', () => {
    expect(entriesFor(rows, { type: 'transfer', walletId: 'w1' }).map((r) => r.id)).toEqual(['d']);
    expect(entriesFor(rows, { type: 'transfer', walletId: 'w2' }).map((r) => r.id)).toEqual(['d']);
  });
});

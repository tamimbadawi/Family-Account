import { describe, expect, it } from 'vitest';
import { historyHref, parseHistoryLink } from './link';

const parse = (href: string) => {
  const p = new URLSearchParams(href.split('?')[1]);
  return parseHistoryLink((k) => p.get(k));
};

describe('historyHref / parseHistoryLink', () => {
  it('round-trips an item for a Reports month', () => {
    const href = historyHref({ categoryId: 'c', subcategoryId: 's', itemId: 'i', month: '2026-10', type: 'expense' });
    expect(href.startsWith('/history?')).toBe(true);
    const r = parse(href);
    expect(r.filters.picks).toEqual([{ categoryId: 'c', subcategoryId: 's', itemId: 'i' }]);
    expect(r.filters.type).toBe('expense');
    expect(r.period).toBe('month');
    expect(r.anchor).toBe('2026-10-01');
    expect(r.back).toBe(true);
  });

  it('keeps a wallet and a person, and an item only under its group', () => {
    const r = parse(historyHref({ walletId: 'w', memberId: 'u', itemId: 'i' }));
    expect(r.filters.walletIds).toEqual(['w']);
    expect(r.filters.memberIds).toEqual(['u']);
    expect(r.filters.picks).toEqual([]);
  });

  it('ignores unknown values', () => {
    const r = parse('/history?type=nope&period=decade&date=10/10/2026');
    expect(r.filters.type).toBe('all');
    expect(r.period).toBeUndefined();
    expect(r.anchor).toBeUndefined();
    expect(r.back).toBe(false);
  });

  it('carries a search and a year', () => {
    const r = parse(historyHref({ q: 'bread', period: 'year', date: '2026-01-01' }));
    expect(r).toMatchObject({ q: 'bread', period: 'year', anchor: '2026-01-01' });
  });
});

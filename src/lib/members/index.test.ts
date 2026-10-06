import { describe, expect, it } from 'vitest';
import type { Member } from '@/lib/data/types';
import { memberInitial, memberSlot, orderMembers } from './index';

const m = (userId: string, createdAt: string, displayName = userId): Member => ({
  householdId: 'h',
  userId,
  displayName,
  role: 'member',
  locale: 'en',
  createdAt,
});

describe('members', () => {
  const members = [m('b', '2026-06-02'), m('a', '2026-06-01'), m('c', '2026-06-02')];

  it('orders by join date, then id', () => {
    expect(orderMembers(members).map((x) => x.userId)).toEqual(['a', 'b', 'c']);
  });

  it('gives each member a stable slot regardless of input order', () => {
    expect(memberSlot('a', members)).toBe(0);
    expect(memberSlot('c', [...members].reverse())).toBe(2);
  });

  it('wraps slots and returns null for unknown or missing users', () => {
    const many = ['1', '2', '3', '4', '5'].map((id) => m(id, '2026-06-0' + id));
    expect(memberSlot('5', many)).toBe(0);
    expect(memberSlot('zz', members)).toBeNull();
    expect(memberSlot(null, members)).toBeNull();
  });

  it('takes the first letter of Arabic and English names', () => {
    expect(memberInitial('ماما')).toBe('م');
    expect(memberInitial('  injy')).toBe('I');
    expect(memberInitial('')).toBe('?');
    expect(memberInitial(null)).toBe('?');
  });
});

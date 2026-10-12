import { describe, expect, it } from 'vitest';
import { timeAgo } from './time';

const NOW = new Date('2026-10-12T18:00:00Z').getTime();

describe('timeAgo', () => {
  it('says how long ago in English', () => {
    expect(timeAgo('2026-10-12T17:55:00Z', 'en', NOW)).toBe('5 minutes ago');
    expect(timeAgo('2026-10-12T15:00:00Z', 'en', NOW)).toBe('3 hours ago');
    expect(timeAgo('2026-10-11T18:00:00Z', 'en', NOW)).toBe('yesterday');
    expect(timeAgo('2026-10-12T17:59:50Z', 'en', NOW)).toBe('now');
  });

  it('uses Western digits in Arabic', () => {
    const text = timeAgo('2026-10-09T18:00:00Z', 'ar', NOW);
    expect(text).toMatch(/3/);
    expect(text).not.toMatch(/[٠-٩]/);
  });
});

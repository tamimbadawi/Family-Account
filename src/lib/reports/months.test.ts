import { describe, expect, it } from 'vitest';
import { formatMonth, formatShortMonth, getLastNMonths, shiftMonth } from './months';

describe('months helpers', () => {
  it('formats month in English with Western digits', () => {
    const formatted = formatMonth('2026-10', 'en');
    expect(formatted).toBe('October 2026');
  });

  it('formats month in Arabic with Western digits', () => {
    const formatted = formatMonth('2026-10', 'ar');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('أكتوبر');
  });

  it('formats short month in English and Arabic', () => {
    expect(formatShortMonth('2026-10', 'en')).toBe('Oct');
    const arShort = formatShortMonth('2026-10', 'ar');
    expect(arShort.length).toBeGreaterThan(0);
  });

  it('shifts month forward and backward across year boundary', () => {
    expect(shiftMonth('2026-10', -1)).toBe('2026-09');
    expect(shiftMonth('2026-10', 1)).toBe('2026-11');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-05', -6)).toBe('2025-11');
  });

  it('generates last N months correctly', () => {
    const sixMonths = getLastNMonths('2026-10', 6);
    expect(sixMonths).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });
});

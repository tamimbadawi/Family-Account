import { describe, expect, it } from 'vitest';
import { barLabel, bucketIndex, lastPeriods, periodLabel, rangeOf, shiftAnchor } from './period';

describe('history periods', () => {
  it('builds each kind of range around a date', () => {
    // 2026-10-07 is a Wednesday; the week runs Saturday 3 → Friday 9
    expect(rangeOf('day', '2026-10-07')).toEqual({ startDate: '2026-10-07', endDate: '2026-10-07' });
    expect(rangeOf('week', '2026-10-07')).toEqual({ startDate: '2026-10-03', endDate: '2026-10-09' });
    expect(rangeOf('week', '2026-10-03')).toEqual({ startDate: '2026-10-03', endDate: '2026-10-09' });
    expect(rangeOf('week', '2026-10-09')).toEqual({ startDate: '2026-10-03', endDate: '2026-10-09' });
    expect(rangeOf('month', '2026-02-14')).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
    expect(rangeOf('year', '2026-10-07')).toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' });
  });

  it('weeks cross month and year ends', () => {
    expect(rangeOf('week', '2026-01-01')).toEqual({ startDate: '2025-12-27', endDate: '2026-01-02' });
  });

  it('moves by whole periods without skipping short months', () => {
    expect(shiftAnchor('day', '2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftAnchor('week', '2026-10-07', 1)).toBe('2026-10-14');
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftAnchor('month', '2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftAnchor('year', '2028-02-29', 1)).toBe('2029-02-28');
  });

  it('lists the last periods oldest first and finds a date in them', () => {
    const months = lastPeriods('month', '2026-10-07', 3);
    expect(months.map((r) => r.startDate)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    expect(bucketIndex(months, '2026-09-30')).toBe(1);
    expect(bucketIndex(months, '2026-07-31')).toBe(-1);
  });

  it('labels use Western digits in Arabic too', () => {
    expect(periodLabel('year', '2026-10-07', 'ar')).toBe('2026');
    expect(periodLabel('week', '2026-10-07', 'en')).toBe('Oct 3 – 9');
    expect(periodLabel('month', '2026-10-07', 'ar')).toMatch(/2026/);
    expect(barLabel('week', rangeOf('week', '2026-08-31'), 'en')).toBe('29/8');
  });
});

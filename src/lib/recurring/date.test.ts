import { describe, expect, it } from 'vitest';
import {
  daysInMonth,
  entryDateForMonth,
  getDueMonths,
  monthsBetween,
  nextDueDate,
} from './date';

describe('daysInMonth', () => {
  it('returns 31 for January and March', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 3)).toBe(31);
  });

  it('returns 30 for April and June', () => {
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 6)).toBe(30);
  });

  it('returns 28 for February in a normal year', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2025, 2)).toBe(28);
  });

  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2028, 2)).toBe(29);
  });
});

describe('entryDateForMonth', () => {
  it('handles standard dates within range', () => {
    expect(entryDateForMonth('2026-10', 15)).toBe('2026-10-15');
    expect(entryDateForMonth('2026-01', 1)).toBe('2026-01-01');
    expect(entryDateForMonth('2026-01', 31)).toBe('2026-01-31');
  });

  it('clamps day 31 to 30 for 30-day months', () => {
    expect(entryDateForMonth('2026-04', 31)).toBe('2026-04-30');
    expect(entryDateForMonth('2026-09', 31)).toBe('2026-09-30');
    expect(entryDateForMonth('2026-11', 31)).toBe('2026-11-30');
  });

  it('clamps day 31 and 30 to 28 for February in non-leap year', () => {
    expect(entryDateForMonth('2026-02', 31)).toBe('2026-02-28');
    expect(entryDateForMonth('2026-02', 30)).toBe('2026-02-28');
    expect(entryDateForMonth('2026-02', 29)).toBe('2026-02-28');
    expect(entryDateForMonth('2026-02', 28)).toBe('2026-02-28');
    expect(entryDateForMonth('2026-02', 15)).toBe('2026-02-15');
  });

  it('clamps day 31 and 30 to 29 for February in leap year', () => {
    expect(entryDateForMonth('2024-02', 31)).toBe('2024-02-29');
    expect(entryDateForMonth('2024-02', 30)).toBe('2024-02-29');
    expect(entryDateForMonth('2024-02', 29)).toBe('2024-02-29');
    expect(entryDateForMonth('2024-02', 28)).toBe('2024-02-28');
  });

  it('clamps negative or zero days to 1', () => {
    expect(entryDateForMonth('2026-05', 0)).toBe('2026-05-01');
    expect(entryDateForMonth('2026-05', -5)).toBe('2026-05-01');
  });
});

describe('monthsBetween', () => {
  it('returns single month when start equals end', () => {
    expect(monthsBetween('2026-10', '2026-10')).toEqual(['2026-10']);
  });

  it('returns empty array when start is after end', () => {
    expect(monthsBetween('2026-11', '2026-10')).toEqual([]);
  });

  it('generates sequential months across years', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('getDueMonths', () => {
  it('returns empty array for archived rule', () => {
    const due = getDueMonths({ startMonth: '2026-01', dayOfMonth: 1, isArchived: true }, '2026-10-12');
    expect(due).toEqual([]);
  });

  it('returns empty array if startMonth is in future', () => {
    const due = getDueMonths({ startMonth: '2026-11', dayOfMonth: 1 }, '2026-10-12');
    expect(due).toEqual([]);
  });

  it('returns past months and current month if due date has passed', () => {
    // Current date is 2026-10-12, rule day is 10
    const due = getDueMonths({ startMonth: '2026-08', dayOfMonth: 10 }, '2026-10-12');
    expect(due).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('excludes current month if due date has not passed yet', () => {
    // Current date is 2026-10-12, rule day is 15
    const due = getDueMonths({ startMonth: '2026-08', dayOfMonth: 15 }, '2026-10-12');
    expect(due).toEqual(['2026-08', '2026-09']);
  });

  it('includes current month on the exact due date', () => {
    // Current date is 2026-10-15, rule day is 15
    const due = getDueMonths({ startMonth: '2026-10', dayOfMonth: 15 }, '2026-10-15');
    expect(due).toEqual(['2026-10']);
  });

  it('handles clamped end-of-month correctly', () => {
    // Rule day is 31, February 2026 has 28 days
    const due = getDueMonths({ startMonth: '2026-02', dayOfMonth: 31 }, '2026-02-28');
    expect(due).toEqual(['2026-02']);
  });
});

describe('nextDueDate', () => {
  it('returns today if fromDate is the due date', () => {
    expect(nextDueDate(15, '2026-10-15')).toBe('2026-10-15');
  });

  it('returns later this month if fromDate is before due date', () => {
    expect(nextDueDate(20, '2026-10-12')).toBe('2026-10-20');
  });

  it('returns next month if fromDate is after due date', () => {
    expect(nextDueDate(5, '2026-10-12')).toBe('2026-11-05');
  });

  it('rolls over year in December', () => {
    expect(nextDueDate(10, '2026-12-15')).toBe('2027-01-10');
  });
});

import { describe, expect, it } from 'vitest';
import {
  MAX_DUE_DATES,
  addDays,
  dayOfWeek,
  daysInMonth,
  getDueDates,
  entryDateForMonth,
  getDueMonths,
  monthsBetween,
  nextDueDate,
  getNextDueDate,
  getDaysUntil,
  getMonthlyEquivalent,
  isSubscriptionRule,
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

describe('getDueDates', () => {
  it('older monthly rules (start month + day) are due on that day every month', () => {
    expect(getDueDates({ startMonth: '2026-08', dayOfMonth: 31 }, '2026-10-12')).toEqual(['2026-08-31', '2026-09-30']);
  });

  it('nothing is due before the start date, for an archived rule, or without a start', () => {
    expect(getDueDates({ startDate: '2026-11-01', frequency: 'daily' }, '2026-10-12')).toEqual([]);
    expect(getDueDates({ startDate: '2026-10-01', frequency: 'daily', isArchived: true }, '2026-10-12')).toEqual([]);
    expect(getDueDates({ frequency: 'weekly' }, '2026-10-12')).toEqual([]);
  });

  it('daily: every day, or every N days', () => {
    expect(getDueDates({ startDate: '2026-10-10', frequency: 'daily' }, '2026-10-12')).toEqual([
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);
    expect(getDueDates({ startDate: '2026-10-01', frequency: 'daily', interval: 5 }, '2026-10-12')).toEqual([
      '2026-10-01',
      '2026-10-06',
      '2026-10-11',
    ]);
  });

  it('weekly: defaults to the weekday of the start date', () => {
    // 2026-10-05 is a Monday
    expect(dayOfWeek('2026-10-05')).toBe(1);
    expect(getDueDates({ startDate: '2026-10-05', frequency: 'weekly' }, '2026-10-20')).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
  });

  it('weekly: several weekdays, never before the start date', () => {
    // Starts on a Wednesday; Sunday (0) and Wednesday (3)
    expect(
      getDueDates({ startDate: '2026-10-07', frequency: 'weekly', daysOfWeek: [3, 0] }, '2026-10-18')
    ).toEqual(['2026-10-07', '2026-10-11', '2026-10-14', '2026-10-18']);
  });

  it('weekly: every 2 weeks skips the week in between', () => {
    expect(getDueDates({ startDate: '2026-10-05', frequency: 'weekly', interval: 2 }, '2026-11-03')).toEqual([
      '2026-10-05',
      '2026-10-19',
      '2026-11-02',
    ]);
  });

  it('monthly: clamps to short months and comes back to the chosen day', () => {
    expect(getDueDates({ startDate: '2026-01-31', frequency: 'monthly' }, '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('monthly: every 3 months, across a year end', () => {
    expect(getDueDates({ startDate: '2026-11-15', frequency: 'monthly', interval: 3 }, '2027-06-01')).toEqual([
      '2026-11-15',
      '2027-02-15',
      '2027-05-15',
    ]);
  });

  it('yearly: 29 February falls on 28 February in normal years and returns in leap years', () => {
    expect(getDueDates({ startDate: '2024-02-29', frequency: 'yearly' }, '2028-03-01')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  it('stops at the end date (the end date itself still counts)', () => {
    expect(
      getDueDates({ startDate: '2026-10-01', frequency: 'daily', endDate: '2026-10-03' }, '2026-10-12')
    ).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('a rule left alone for years only creates the newest dates', () => {
    const due = getDueDates({ startDate: '2020-01-01', frequency: 'daily' }, '2026-10-12');
    expect(due).toHaveLength(MAX_DUE_DATES);
    expect(due.at(-1)).toBe('2026-10-12');
  });
});

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('getNextDueDate and subscriptions', () => {
  it('calculates next monthly renewal date', () => {
    const rule = { startDate: '2026-05-15', frequency: 'monthly' as const, interval: 1, dayOfMonth: 15 };
    expect(getNextDueDate(rule, '2026-10-10')).toBe('2026-10-15');
    expect(getNextDueDate(rule, '2026-10-15')).toBe('2026-10-15');
    expect(getNextDueDate(rule, '2026-10-16')).toBe('2026-11-15');
  });

  it('calculates days until renewal', () => {
    expect(getDaysUntil('2026-10-15', '2026-10-15')).toBe(0);
    expect(getDaysUntil('2026-10-16', '2026-10-15')).toBe(1);
    expect(getDaysUntil('2026-10-22', '2026-10-15')).toBe(7);
  });

  it('normalizes to monthly cost equivalent', () => {
    expect(getMonthlyEquivalent(300, 'monthly', 1)).toBe(300);
    expect(getMonthlyEquivalent(1200, 'yearly', 1)).toBe(100);
    expect(getMonthlyEquivalent(600, 'monthly', 2)).toBe(300);
  });

  it('detects subscriptions accurately', () => {
    expect(isSubscriptionRule({ isSubscription: true })).toBe(true);
    expect(isSubscriptionRule({ isSubscription: false })).toBe(false);
    expect(isSubscriptionRule({ itemNameEn: 'Netflix standard' })).toBe(true);
    expect(isSubscriptionRule({ itemNameAr: 'اشتراك جيم' })).toBe(true);
    expect(isSubscriptionRule({ itemNameEn: 'Supermarket groceries' })).toBe(false);
  });
});

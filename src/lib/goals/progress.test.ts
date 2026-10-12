import { describe, expect, it } from 'vitest';
import { calculateGoalProgress, formatGoalTargetDate } from './progress';

describe('calculateGoalProgress', () => {
  it('calculates initial zero progress', () => {
    const res = calculateGoalProgress(10000, 0);
    expect(res.percent).toBe(0);
    expect(res.barPercent).toBe(0);
    expect(res.remaining).toBe(10000);
    expect(res.isReached).toBe(false);
  });

  it('calculates partial progress accurately', () => {
    const res = calculateGoalProgress(10000, 2500);
    expect(res.percent).toBe(25);
    expect(res.barPercent).toBe(25);
    expect(res.remaining).toBe(7500);
    expect(res.isReached).toBe(false);
  });

  it('calculates exact 100% completion', () => {
    const res = calculateGoalProgress(10000, 10000);
    expect(res.percent).toBe(100);
    expect(res.barPercent).toBe(100);
    expect(res.remaining).toBe(0);
    expect(res.isReached).toBe(true);
  });

  it('handles over-saving beyond 100%', () => {
    const res = calculateGoalProgress(10000, 12500);
    expect(res.percent).toBe(125);
    expect(res.barPercent).toBe(100); // bar clamped at 100
    expect(res.remaining).toBe(0);
    expect(res.isReached).toBe(true);
  });

  it('handles negative current balance safely', () => {
    const res = calculateGoalProgress(10000, -500);
    expect(res.percent).toBe(0);
    expect(res.barPercent).toBe(0);
    expect(res.remaining).toBe(10000);
    expect(res.isReached).toBe(false);
  });

  it('handles zero or negative target amount safely', () => {
    const res = calculateGoalProgress(0, 100);
    expect(res.percent).toBe(0);
    expect(res.barPercent).toBe(0);
    expect(res.remaining).toBe(0);
    expect(res.isReached).toBe(false);
  });
});

describe('formatGoalTargetDate', () => {
  it('formats dates in English with Western digits', () => {
    const str = formatGoalTargetDate('2026-12-31', 'en');
    expect(str).toBe('31/12/2026');
  });

  it('formats dates in Arabic with Western digits', () => {
    const str = formatGoalTargetDate('2026-12-31', 'ar');
    expect(str).toBe('31/12/2026');
    expect(str).not.toMatch(/[٠-٩]/); // Western digits only
  });

  it('returns null for empty or invalid input', () => {
    expect(formatGoalTargetDate(null, 'en')).toBeNull();
    expect(formatGoalTargetDate(undefined, 'en')).toBeNull();
    expect(formatGoalTargetDate('invalid', 'en')).toBeNull();
  });
});

// =========================================================
// Savings Goals Progress Calculations  ·  Family Accounts (حساباتنا)
// Pure helper functions for goal progress, amounts remaining, and dates.
// =========================================================

export interface GoalProgress {
  /** Progress percentage rounded to nearest integer (e.g. 75, or 100 when reached). Min 0. */
  percent: number;
  /** Clamped 0-100 for progress bar width style. */
  barPercent: number;
  /** Amount remaining to reach the goal. 0 when goal is reached. */
  remaining: number;
  /** True when currentAmount >= targetAmount. */
  isReached: boolean;
}

/**
 * Calculates progress statistics for a savings goal.
 * @param targetAmount Target amount to save (EGP)
 * @param currentAmount Current balance in the linked wallet (EGP)
 */
export function calculateGoalProgress(targetAmount: number, currentAmount: number): GoalProgress {
  if (targetAmount <= 0) {
    return {
      percent: 0,
      barPercent: 0,
      remaining: 0,
      isReached: false,
    };
  }

  const effectiveCurrent = Math.max(0, currentAmount);
  const rawRatio = effectiveCurrent / targetAmount;
  const percent = Math.round(rawRatio * 100);
  const barPercent = Math.min(100, Math.max(0, percent));
  const remaining = Math.max(0, Number((targetAmount - effectiveCurrent).toFixed(2)));
  const isReached = currentAmount >= targetAmount;

  return {
    percent,
    barPercent,
    remaining,
    isReached,
  };
}

/**
 * Formats a target date (YYYY-MM-DD) for display (e.g., "Dec 2026" or "ديسمبر 2026").
 * Always formats digits in Western / Latin system.
 */
export function formatGoalTargetDate(dateStr: string | null | undefined, locale: string): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = match[3] ? Number(match[3]) : 1;

  const d = new Date(Date.UTC(year, month, day));
  const intlLocale = locale.startsWith('ar') ? 'ar-EG' : 'en-EG';

  return new Intl.DateTimeFormat(intlLocale, {
    month: 'short',
    year: 'numeric',
    numberingSystem: 'latn',
    timeZone: 'UTC',
  }).format(d);
}

// After an expense is saved: which of its budgets crossed 80% or 100% this month on this entry (once per threshold per month).

import type { Repository } from '@/lib/data/repository';
import { pickName } from '@/lib/format';
import {
  budgetCovers,
  budgetProgress,
  budgetThresholdCross,
  type BudgetProgress,
  type BudgetThreshold,
} from '@/lib/reports/budgets';

export interface BudgetWarning {
  progress: BudgetProgress;
  /** "Food" or "Food · Groceries" */
  label: string;
  threshold: BudgetThreshold;
}

const alertedMemory = new Set<string>();

export function hasAlertedThreshold(budgetId: string, month: string, threshold: string): boolean {
  const key = `${budgetId}|${month}|${threshold}`;
  if (alertedMemory.has(key)) return true;
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(`fa_budget_alert_${key}`) === '1';
  }
  return false;
}

export function recordAlertedThreshold(budgetId: string, month: string, threshold: string): void {
  const key = `${budgetId}|${month}|${threshold}`;
  alertedMemory.add(key);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`fa_budget_alert_${key}`, '1');
    } catch {
      // ignore
    }
  }
}

export function resetAlertedThresholds(): void {
  alertedMemory.clear();
}

export async function budgetWarningsForEntry(
  repo: Repository,
  entryId: string,
  locale: string
): Promise<BudgetWarning[]> {
  const entry = await repo.getEntry(entryId);
  if (!entry || entry.type !== 'expense' || entry.deletedAt) return [];
  const budgets = (await repo.getBudgets()).filter((b) => budgetCovers(b, entry));
  if (budgets.length === 0) return [];

  const month = entry.occurredOn.slice(0, 7);
  const monthEntries = await repo.listEntries({ month, type: 'expense' });
  const pick = (ar?: string | null, en?: string | null) =>
    pickName({ name_ar: ar ?? null, name_en: en ?? null }, locale);
  const category = pick(entry.categoryNameAr, entry.categoryNameEn);
  const group = pick(entry.subcategoryNameAr, entry.subcategoryNameEn);

  const allProgress = budgetProgress(budgets, monthEntries, month);
  const warnings: BudgetWarning[] = [];

  for (const progress of allProgress) {
    const budget = progress.budget;
    // Calculate total spent before this entry was added
    const spentAfter = progress.spent;
    const spentBefore = Math.round((spentAfter - entry.amount) * 100) / 100;

    const cross = budgetThresholdCross(budget.amount, spentBefore, spentAfter);
    if (!cross) continue;

    // Check if we've already alerted this threshold this month
    if (hasAlertedThreshold(budget.id, month, cross.threshold)) continue;

    recordAlertedThreshold(budget.id, month, cross.threshold);

    warnings.push({
      progress: {
        ...progress,
        level: cross.level,
      },
      label: budget.subcategoryId && group ? `${category} · ${group}` : category,
      threshold: cross.threshold,
    });
  }

  return warnings;
}

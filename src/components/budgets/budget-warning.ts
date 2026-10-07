// After an expense is saved: which of its budgets are now at 80% or more this month (soft warning).

import type { Repository } from '@/lib/data/repository';
import { pickName } from '@/lib/format';
import { budgetCovers, budgetProgress, type BudgetProgress } from '@/lib/reports/budgets';

export interface BudgetWarning {
  progress: BudgetProgress;
  /** "Food" or "Food · Groceries" */
  label: string;
}

export async function budgetWarningsForEntry(repo: Repository, entryId: string, locale: string): Promise<BudgetWarning[]> {
  const entry = await repo.getEntry(entryId);
  if (!entry || entry.type !== 'expense' || entry.deletedAt) return [];
  const budgets = (await repo.getBudgets()).filter((b) => budgetCovers(b, entry));
  if (budgets.length === 0) return [];

  const month = entry.occurredOn.slice(0, 7);
  const monthEntries = await repo.listEntries({ month, type: 'expense' });
  const pick = (ar?: string | null, en?: string | null) => pickName({ name_ar: ar ?? null, name_en: en ?? null }, locale);
  const category = pick(entry.categoryNameAr, entry.categoryNameEn);
  const group = pick(entry.subcategoryNameAr, entry.subcategoryNameEn);

  return budgetProgress(budgets, monthEntries, month)
    .filter((p) => p.level !== 'ok')
    .map((progress) => ({
      progress,
      label: progress.budget.subcategoryId && group ? `${category} · ${group}` : category,
    }));
}

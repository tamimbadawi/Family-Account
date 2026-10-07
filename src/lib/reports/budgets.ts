// =========================================================
// Budgets · actual vs budget for one month. Pure functions, no React/Dexie.
// A budget is a monthly limit on an expense category, or on one group (subcategory) inside it.
// The same amount applies to every month. Balance corrections never count as spending.
// =========================================================

import type { Budget } from '../data/types';
import { ITEM_EXPENSE_BALANCE_CORRECTION_ID } from '../data/mock-seed';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** From this share of the budget a soft warning starts. */
export const BUDGET_WARN_AT = 0.8;

/** ok: under 80% · near: 80–100% · over: spent more than the budget */
export type BudgetLevel = 'ok' | 'near' | 'over';

export interface BudgetEntryLike {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  occurredOn: string; // 'YYYY-MM-DD'
  itemId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
}

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  /** Budget minus spent; negative when over. */
  remaining: number;
  /** spent / budget (1 = exactly used up). */
  ratio: number;
  level: BudgetLevel;
}

export function budgetLevel(spent: number, amount: number): BudgetLevel {
  if (amount <= 0) return 'ok';
  if (spent > amount) return 'over';
  if (spent >= amount * BUDGET_WARN_AT) return 'near';
  return 'ok';
}

/** Does this entry count against this budget? */
export function budgetCovers(budget: Budget, entry: BudgetEntryLike): boolean {
  if (entry.type !== 'expense') return false;
  if (entry.itemId === ITEM_EXPENSE_BALANCE_CORRECTION_ID) return false;
  if (budget.subcategoryId) return entry.subcategoryId === budget.subcategoryId;
  return entry.categoryId === budget.categoryId;
}

/** Actual vs budget for `month` ('YYYY-MM'), most-used budgets first. */
export function budgetProgress(
  budgets: Budget[],
  entries: BudgetEntryLike[],
  month: string,
): BudgetProgress[] {
  const inMonth = entries.filter((e) => e.type === 'expense' && e.occurredOn.startsWith(month));
  return budgets
    .filter((b) => !b.isArchived)
    .map((budget) => {
      const spent = round2(
        inMonth.reduce((sum, e) => (budgetCovers(budget, e) ? sum + e.amount : sum), 0),
      );
      const ratio = budget.amount > 0 ? spent / budget.amount : 0;
      return {
        budget,
        spent,
        remaining: round2(budget.amount - spent),
        ratio,
        level: budgetLevel(spent, budget.amount),
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/** Only the budgets that need a soft warning (near or over), worst first. */
export function budgetWarnings(progress: BudgetProgress[]): BudgetProgress[] {
  return progress.filter((p) => p.level !== 'ok');
}

/**
 * Totals across all budgets. A group budget inside a category that has its own budget is left out,
 * so the same spending is never counted twice.
 */
export function budgetTotals(progress: BudgetProgress[]): { budget: number; spent: number; level: BudgetLevel } {
  const withCategoryBudget = new Set(progress.filter((p) => !p.budget.subcategoryId).map((p) => p.budget.categoryId));
  const top = progress.filter((p) => !p.budget.subcategoryId || !withCategoryBudget.has(p.budget.categoryId));
  const budget = round2(top.reduce((s, p) => s + p.budget.amount, 0));
  const spent = round2(top.reduce((s, p) => s + p.spent, 0));
  return { budget, spent, level: budgetLevel(spent, budget) };
}

/** Share of the budget used, in whole percent (can pass 100). */
export function budgetPercent(p: Pick<BudgetProgress, 'ratio'>): number {
  return Math.round(p.ratio * 100);
}

/** How many wordings each friendly budget message has (keys "1"…"3" in messages/<locale>/budgets.json). */
export const BUDGET_MESSAGE_VARIANTS = 3;

/**
 * Picks one of the message variants. The same seed always gives the same variant
 * (Home uses budget + day, so its wording stays put all day); no seed = a fresh pick each time.
 */
export function messageVariant(seed?: string, count = BUDGET_MESSAGE_VARIANTS): string {
  if (seed === undefined) return String(1 + Math.floor(Math.random() * count));
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return String(1 + (h % count));
}

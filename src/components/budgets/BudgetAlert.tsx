'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, TriangleAlert } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { budgetPercent, messageVariant, type BudgetProgress } from '@/lib/reports/budgets';
import { localISODate } from '@/lib/format';
import { useBudgetNames } from './BudgetProgressRow';

/** Home: one calm line when a budget is at 80% or more this month. Opens Budget vs actual. */
export function BudgetAlert({ warnings }: { warnings: BudgetProgress[] }) {
  const t = useTranslations('budgets');
  const names = useBudgetNames();
  const [worst] = warnings;
  if (!worst) return null;

  const isOver = warnings.some((w) => w.level === 'over');
  const name = names.label(worst.budget);
  // Same friendly wording all day for the same budget, a different one on another day
  const variant = messageVariant(`${worst.budget.id}|${localISODate()}`);
  const text =
    warnings.length > 1
      ? t('homeMore', { name, more: String(warnings.length - 1) })
      : worst.level === 'over'
        ? t(`homeOver.${variant}`, { name })
        : t(`homeNear.${variant}`, { name, percent: String(budgetPercent(worst)) });

  return (
    <Link
      href="/reports/r/budget-vs-actual"
      className={`flex min-h-12 items-center gap-2.5 rounded-card px-3.5 py-2 active:scale-[0.99] transition-transform ${
        isOver ? 'bg-expense-soft text-expense' : 'bg-warning/12 text-warning'
      }`}
    >
      <TriangleAlert className="size-5 shrink-0" />
      <span className="flex-1 min-w-0 text-body font-semibold text-ink tabular-nums">{text}</span>
      <ChevronRight className="size-5 shrink-0 rtl:rotate-180" />
    </Link>
  );
}

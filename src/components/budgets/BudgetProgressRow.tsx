'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';
import { useCategories, useSubcategories } from '@/lib/data/provider';
import type { Budget, Category, Subcategory } from '@/lib/data/types';
import { budgetPercent, type BudgetLevel, type BudgetProgress } from '@/lib/reports/budgets';
import { money, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';

export interface BudgetNames {
  category: (id: string) => Category | undefined;
  label: (budget: Pick<Budget, 'categoryId' | 'subcategoryId'>) => string;
}

/** Looks up the category (and group) a budget is for, including hidden ones. */
export function useBudgetNames(): BudgetNames {
  const locale = useLocale();
  const categories = useCategories('expense', true);
  const subcategories = useSubcategories(undefined, true);

  return React.useMemo(() => {
    const cats = new Map((categories ?? []).map((c) => [c.id, c]));
    const subs = new Map<string, Subcategory>((subcategories ?? []).map((s) => [s.id, s]));
    const name = (n: { nameAr: string | null; nameEn: string | null } | undefined) =>
      n ? pickName({ name_ar: n.nameAr, name_en: n.nameEn }, locale) : '';
    return {
      category: (id) => cats.get(id),
      label: (b) => {
        const cat = name(cats.get(b.categoryId));
        if (!b.subcategoryId) return cat;
        const sub = name(subs.get(b.subcategoryId));
        return cat && sub ? `${cat} · ${sub}` : sub || cat;
      },
    };
  }, [categories, subcategories, locale]);
}

const BAR: Record<BudgetLevel, string> = {
  ok: 'bg-income',
  near: 'bg-warning',
  over: 'bg-expense',
};

const TEXT: Record<BudgetLevel, string> = {
  ok: 'text-ink-muted',
  near: 'text-warning',
  over: 'text-expense',
};

export interface BudgetProgressRowProps {
  progress: BudgetProgress;
  names: BudgetNames;
  onClick?: () => void;
}

/** One budget: icon, name, bar, "spent of budget" and what is left (or over). */
export function BudgetProgressRow({ progress, names, onClick }: BudgetProgressRowProps) {
  const locale = useLocale();
  const t = useTranslations('budgets');
  const { budget, spent, remaining, level } = progress;
  const category = names.category(budget.categoryId);
  const percent = budgetPercent(progress);
  const fmt = (n: number) => money(n, locale, { fractionDigits: 0 });

  const body = (
    <>
      <div className="flex items-center gap-3">
        <div
          style={category?.color ? { backgroundColor: `${category.color}18`, color: category.color } : undefined}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          <CategoryIcon name={category?.icon ?? null} className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-body font-semibold text-ink leading-snug">{names.label(budget)}</span>
            <span className={`shrink-0 text-body font-bold tabular-nums ${TEXT[level]}`}>{percent}%</span>
          </div>
          <div className="text-caption text-ink-muted tabular-nums">
            {t('spentOf', { spent: fmt(spent), budget: fmt(budget.amount) })}
          </div>
        </div>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        aria-label={names.label(budget)}
      >
        <div
          style={{ width: `${Math.min(100, percent)}%` }}
          className={`h-full rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none ${BAR[level]}`}
        />
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-caption">
        {level === 'ok' ? (
          <span />
        ) : (
          <span className={`flex items-center gap-1 font-semibold ${TEXT[level]}`}>
            <TriangleAlert className="size-4" />
            {level === 'over' ? t('statusOver') : t('statusNear')}
          </span>
        )}
        <span className={`font-medium tabular-nums ${level === 'over' ? 'text-expense' : 'text-ink-muted'}`}>
          {remaining < 0 ? t('overBy', { amount: fmt(-remaining) }) : t('left', { amount: fmt(remaining) })}
        </span>
      </div>
    </>
  );

  if (!onClick) return <div className="px-3.5 py-3">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3.5 py-3 text-start transition-colors hover:bg-surface-2/40 active:bg-surface-2 cursor-pointer"
    >
      {body}
    </button>
  );
}

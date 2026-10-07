'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PiggyBank } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useBudgetProgress } from '@/lib/data/provider';
import { budgetTotals, budgetWarnings, messageVariant } from '@/lib/reports/budgets';
import { localISODate, money } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MonthSwitcher } from '@/components/reports/MonthSwitcher';
import { BudgetProgressRow, useBudgetNames } from '@/components/budgets/BudgetProgressRow';

const BAR = { ok: 'bg-income', near: 'bg-warning', over: 'bg-expense' } as const;

export function BudgetVsActualView() {
  const locale = useLocale();
  const t = useTranslations('budgets');
  const [month, setMonth] = React.useState(() => localISODate().slice(0, 7));
  const progress = useBudgetProgress(month);
  const names = useBudgetNames();
  const fmt = (n: number) => money(n, locale, { fractionDigits: 0 });

  if (!progress) {
    return <Skeleton className="h-40 w-full rounded-card" />;
  }

  if (progress.length === 0) {
    return (
      <Card className="rounded-card bg-surface p-6 text-center shadow-card border border-line/60 space-y-3">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <PiggyBank className="size-7" />
        </div>
        <h2 className="text-heading font-bold text-ink">{t('emptyTitle')}</h2>
        <p className="text-body text-ink-muted max-w-sm mx-auto">{t('reportEmptyBody')}</p>
        <Link
          href="/settings/budgets"
          className="mx-auto flex h-12 w-full max-w-xs items-center justify-center rounded-2xl bg-accent text-accent-ink text-body font-semibold active:scale-95 transition-all"
        >
          {t('setUp')}
        </Link>
      </Card>
    );
  }

  const totals = budgetTotals(progress);
  const totalPercent = totals.budget > 0 ? Math.round((totals.spent / totals.budget) * 100) : 0;
  const left = totals.budget - totals.spent;

  return (
    <div className="space-y-2.5 select-none">
      <MonthSwitcher month={month} onMonthChange={setMonth} />

      {/* Total: everything budgeted vs everything spent in those budgets */}
      <Card className="rounded-card bg-surface p-3.5 gap-0 shadow-card border border-line/60">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-body font-semibold text-ink">{t('totalTitle')}</span>
          <span className="text-body font-bold tabular-nums text-ink">{totalPercent}%</span>
        </div>
        <div className="text-caption text-ink-muted tabular-nums">
          {t('spentOf', { spent: fmt(totals.spent), budget: fmt(totals.budget) })}
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            style={{ width: `${Math.min(100, totalPercent)}%` }}
            className={`h-full rounded-full ${BAR[totals.level]}`}
          />
        </div>
        <div className={`mt-1 text-caption font-medium tabular-nums text-end ${left < 0 ? 'text-expense' : 'text-ink-muted'}`}>
          {left < 0 ? t('overBy', { amount: fmt(-left) }) : t('left', { amount: fmt(left) })}
        </div>
        {budgetWarnings(progress).length === 0 && (
          <p className="mt-2 pt-2 border-t border-line/40 text-body font-semibold text-income text-center">
            {t(`allGood.${messageVariant(month)}`)}
          </p>
        )}
      </Card>

      {/* One row per budget, fullest first */}
      <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 overflow-hidden p-0 gap-0">
        {progress.map((p) => (
          <BudgetProgressRow key={p.budget.id} progress={p} names={names} />
        ))}
      </Card>
    </div>
  );
}

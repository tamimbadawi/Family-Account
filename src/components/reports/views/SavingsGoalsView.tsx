'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Target, Trophy } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useEntries, useSavingsGoals, useWallets } from '@/lib/data/provider';
import { Card } from '@/components/ui/card';
import { CategoryIcon } from '@/components/ui/category-icon';
import { money, pickName } from '@/lib/format';
import { formatGoalTargetDate } from '@/lib/goals/progress';
import { entriesFor } from '@/lib/reports/drill';
import { useEntriesDrill } from '../useEntriesDrill';

/** Reports → Savings goals: how far each goal has come, and the total put aside. */
export function SavingsGoalsView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const tGoals = useTranslations('goals');
  const goals = useSavingsGoals(false);
  const wallets = useWallets();
  const entries = useEntries();
  const drill = useEntriesDrill();

  const currencyOf = React.useCallback(
    (walletId: string) => wallets?.find((w) => w.id === walletId)?.currency,
    [wallets]
  );

  // Two goals kept in the same wallet share its money, so that wallet is counted once.
  // Amounts in different currencies are never added together.
  const totals = React.useMemo(() => {
    const seen = new Set<string>();
    const byCurrency = new Map<string, number>();
    for (const g of goals ?? []) {
      if (seen.has(g.walletId)) continue;
      seen.add(g.walletId);
      const cur = currencyOf(g.walletId) ?? '';
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + g.currentAmount);
    }
    return [...byCurrency.entries()];
  }, [goals, currencyOf]);

  if (goals === undefined) return null;

  if (goals.length === 0) {
    return (
      <Card className="rounded-card bg-surface p-6 text-center shadow-card border border-line/60 gap-3 select-none">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Target className="size-7" />
        </div>
        <p className="text-body text-ink-muted leading-relaxed">{tGoals('emptyDesc')}</p>
        <Link
          href="/settings/goals"
          className="mx-auto flex min-h-12 items-center rounded-2xl bg-accent px-5 text-body font-semibold text-accent-ink"
        >
          {tGoals('newGoal')}
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-2 select-none">
      <Card className="rounded-card bg-surface p-3 px-3.5 shadow-card border border-line/60 gap-1">
        <span className="text-caption font-medium text-ink-muted">{t('library.savedInGoals')}</span>
        {totals.map(([currency, amount]) => (
          <span key={currency} className="text-title font-bold tabular-nums text-ink leading-tight">
            {money(amount, locale, { currency: currency || undefined })}
          </span>
        ))}
      </Card>

      {goals.map((goal) => {
        const currency = currencyOf(goal.walletId);
        const date = formatGoalTargetDate(goal.targetDate, locale);
        return (
          <Card
            key={goal.id}
            role="button"
            tabIndex={0}
            onClick={() =>
              drill.show(pickName({ name_ar: goal.nameAr, name_en: goal.nameEn }, locale), entriesFor(entries, { walletId: goal.walletId }), {
                total: goal.currentAmount,
              })
            }
            className="cursor-pointer rounded-card bg-surface p-3.5 shadow-card border border-line/60 gap-2.5 active:bg-surface-2 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-income-soft text-income">
                <CategoryIcon name={goal.icon ?? 'sparkles'} className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-body font-bold text-ink leading-tight break-words">
                  {pickName({ name_ar: goal.nameAr, name_en: goal.nameEn }, locale)}
                </h2>
                <p className="text-caption text-ink-muted tabular-nums leading-tight mt-0.5">
                  {tGoals('target', { amount: money(goal.targetAmount, locale, { currency }) })}
                  {date ? ` · ${date}` : ''}
                </p>
              </div>
              {goal.isReached ? (
                <Trophy className="size-5 shrink-0 text-income" aria-label={tGoals('reached')} />
              ) : (
                <span className="shrink-0 text-body font-bold tabular-nums text-accent">{goal.percent}%</span>
              )}
            </div>

            <div
              role="progressbar"
              aria-valuenow={goal.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className={`h-full rounded-full ${goal.isReached ? 'bg-income' : 'bg-accent'}`}
                style={{ width: `${goal.barPercent}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 text-caption font-semibold tabular-nums leading-tight">
              <span className="text-ink">{tGoals('saved', { amount: money(goal.currentAmount, locale, { currency }) })}</span>
              {!goal.isReached && (
                <span className="text-expense">
                  {tGoals('left', { amount: money(goal.remaining, locale, { currency }) })}
                </span>
              )}
            </div>
          </Card>
        );
      })}

      <Link
        href="/settings/goals"
        className="flex min-h-12 items-center justify-center rounded-2xl bg-surface-2 text-body font-semibold text-accent"
      >
        {t('library.manageGoals')}
      </Link>
      {drill.sheet}
    </div>
  );
}

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, Target } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useSavingsGoals, useHousehold } from '@/lib/data/provider';
import { money } from '@/lib/format';

/** Reports overview: one row that says how much is saved in goals and opens the Savings goals report. */
export function SavingsGoalsRow({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('reports');
  const goals = useSavingsGoals(false);

  const household = useHousehold();
  const householdCurrency = household?.currency ?? 'EGP';

  // Goals kept in the same wallet share its money (counted once)
  const saved = React.useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    for (const g of goals ?? []) {
      if (seen.has(g.walletId)) continue;
      seen.add(g.walletId);
      total += g.currentAmount;
    }
    return money(total, locale, { currency: householdCurrency });
  }, [goals, locale, householdCurrency]);

  if (goals === undefined) {
    return (
      <div className={`h-14 rounded-card bg-surface shadow-card animate-pulse ${className}`} />
    );
  }
  const hasGoals = goals.length > 0;

  return (
    <Link
      href={hasGoals ? '/reports/r/savings-goals' : '/money/goals'}
      className={`flex min-h-14 items-center gap-3 rounded-card bg-surface px-3.5 py-2 shadow-card transition-colors active:bg-surface-2 select-none ${className}`}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-income-soft text-income">
        <Target className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-body font-semibold text-ink leading-tight">{t('library.savingsGoals')}</div>
        <div className="text-caption text-ink-muted tabular-nums leading-tight">
          {hasGoals ? t('library.savedInGoalsLine', { amount: saved, count: goals.length }) : t('library.noGoalsYet')}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-muted rtl:rotate-180" />
    </Link>
  );
}

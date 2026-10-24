'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { money } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { historyHref } from '@/lib/history/link';
import { useCountUp } from './useCountUp';

export interface HeroTotalsCardProps {
  spent: number;
  income: number;
  net: number;
  currency?: string;
  /** 'YYYY-MM': tapping a total opens that month's entries in History. */
  month?: string;
  className?: string;
}

export function HeroTotalsCard({ spent, income, net, currency, month, className = '' }: HeroTotalsCardProps) {
  const locale = useLocale();
  const t = useTranslations('reports');

  const animatedSpent = useCountUp(spent);
  const animatedIncome = useCountUp(income);
  const animatedNet = useCountUp(net);

  return (
    <Card className={`rounded-card bg-surface px-3.5 py-2.5 shadow-card select-none gap-0 ${className}`}>
      {/* Hero: Net */}
      <Link href={historyHref({ month })} className="flex items-baseline justify-between gap-2 rounded-xl active:bg-surface-2 transition-colors">
        <span className="text-caption font-medium text-ink-muted">
          {t('net')}
        </span>
        <div
          className={`text-display font-bold tabular-nums tracking-tight leading-none ${
            net >= 0 ? 'text-ink' : 'text-expense'
          }`}
        >
          {money(animatedNet, locale, { currency })}
        </div>
      </Link>

      {/* Subline: Spent & Income in text-body amounts */}
      <div className="mt-1.5 grid grid-cols-2 gap-2 pt-1.5 border-t border-line">
        {/* Spent */}
        <Link href={historyHref({ type: 'expense', month })} className="block min-h-12 rounded-xl active:bg-surface-2 transition-colors">
          <span className="text-caption text-ink-muted block leading-tight">
            {t('spent')}
          </span>
          <span className="text-body font-bold tabular-nums text-expense leading-snug">
            {money(animatedSpent, locale, { currency })}
          </span>
        </Link>

        {/* Income */}
        <Link href={historyHref({ type: 'income', month })} className="block min-h-12 rounded-xl text-end active:bg-surface-2 transition-colors">
          <span className="text-caption text-ink-muted block leading-tight">
            {t('income')}
          </span>
          <span className="text-body font-bold tabular-nums text-income leading-snug">
            {money(animatedIncome, locale, { currency })}
          </span>
        </Link>
      </div>
    </Card>
  );
}

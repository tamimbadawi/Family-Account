'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { money } from '@/lib/format';
import { useCountUp } from './useCountUp';

export interface HeroTotalsCardProps {
  spent: number;
  income: number;
  net: number;
  className?: string;
}

export function HeroTotalsCard({ spent, income, net, className = '' }: HeroTotalsCardProps) {
  const locale = useLocale();
  const t = useTranslations('reports');

  const animatedSpent = useCountUp(spent);
  const animatedIncome = useCountUp(income);
  const animatedNet = useCountUp(net);

  return (
    <Card className={`rounded-card bg-surface px-3.5 py-2.5 shadow-card select-none gap-0 ${className}`}>
      {/* Hero: Net */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-caption font-medium text-ink-muted">
          {t('net')}
        </span>
        <div
          className={`text-display font-bold tabular-nums tracking-tight leading-none ${
            net >= 0 ? 'text-ink' : 'text-expense'
          }`}
        >
          {money(animatedNet, locale)}
        </div>
      </div>

      {/* Subline: Spent & Income in text-body amounts */}
      <div className="mt-1.5 grid grid-cols-2 gap-2 pt-1.5 border-t border-line">
        {/* Spent */}
        <div>
          <span className="text-caption text-ink-muted block leading-tight">
            {t('spent')}
          </span>
          <span className="text-body font-bold tabular-nums text-expense leading-snug">
            {money(animatedSpent, locale)}
          </span>
        </div>

        {/* Income */}
        <div className="text-end">
          <span className="text-caption text-ink-muted block leading-tight">
            {t('income')}
          </span>
          <span className="text-body font-bold tabular-nums text-income leading-snug">
            {money(animatedIncome, locale)}
          </span>
        </div>
      </div>
    </Card>
  );
}

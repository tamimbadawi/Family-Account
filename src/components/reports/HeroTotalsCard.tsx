'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
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
    <Card className={`rounded-card bg-surface p-3 shadow-card select-none ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-caption font-medium text-ink-muted">
          {t('net')}
        </span>
        <div
          className={`text-title font-bold tabular-nums tracking-tight leading-none ${
            net >= 0 ? 'text-ink' : 'text-expense'
          }`}
        >
          {money(animatedNet, locale)}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-line text-xs font-medium">
        {/* Spent */}
        <div className="flex items-center gap-1.5 text-expense">
          <span className="flex size-4 items-center justify-center rounded-full bg-expense-soft">
            <ArrowDownLeft className="size-2.5 rtl:rotate-90" />
          </span>
          <span className="text-ink-muted">{t('spent')}:</span>
          <span className="font-bold tabular-nums">
            {money(animatedSpent, locale)}
          </span>
        </div>

        {/* Income */}
        <div className="flex items-center gap-1.5 text-income">
          <span className="flex size-4 items-center justify-center rounded-full bg-income-soft">
            <ArrowUpRight className="size-2.5 rtl:rotate-90" />
          </span>
          <span className="text-ink-muted">{t('income')}:</span>
          <span className="font-bold tabular-nums">
            {money(animatedIncome, locale)}
          </span>
        </div>
      </div>
    </Card>
  );
}

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonth, shiftMonth } from '@/lib/reports/months';

export interface MonthSwitcherProps {
  month: string;
  onMonthChange: (month: string) => void;
  className?: string;
}

export function MonthSwitcher({ month, onMonthChange, className = '' }: MonthSwitcherProps) {
  const locale = useLocale();
  const t = useTranslations('reports');

  const handlePrev = () => {
    onMonthChange(shiftMonth(month, -1));
  };

  const handleNext = () => {
    onMonthChange(shiftMonth(month, 1));
  };

  const formattedMonth = formatMonth(month, locale);

  return (
    <div className={`flex items-center justify-between select-none ${className}`}>
      <button
        type="button"
        onClick={handlePrev}
        aria-label={t('previousMonth')}
        className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink active:scale-95 transition-all"
      >
        <ChevronLeft className="size-5 rtl:rotate-180" />
      </button>

      <span className="text-body font-bold text-ink tabular-nums">
        {formattedMonth}
      </span>

      <button
        type="button"
        onClick={handleNext}
        aria-label={t('nextMonth')}
        className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink active:scale-95 transition-all"
      >
        <ChevronRight className="size-5 rtl:rotate-180" />
      </button>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonth, shiftMonth } from '@/lib/format';

export interface MonthSwitcherProps {
  value: string; // 'YYYY-MM'
  onChange: (month: string) => void;
  className?: string;
}

export function MonthSwitcher({ value, onChange, className = '' }: MonthSwitcherProps) {
  const locale = useLocale();
  const t = useTranslations('history');

  const handlePrev = () => {
    onChange(shiftMonth(value, -1));
  };

  const handleNext = () => {
    onChange(shiftMonth(value, 1));
  };

  const formattedMonth = formatMonth(value, locale);

  return (
    <div
      className={`flex items-center justify-between bg-surface rounded-card p-1.5 shadow-sm border border-line/40 select-none ${className}`}
    >
      <button
        type="button"
        onClick={handlePrev}
        aria-label={t('prevMonth')}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:text-ink hover:bg-surface-2 active:bg-surface-2/80 cursor-pointer"
      >
        <ChevronLeft className="size-6 rtl:rotate-180" />
      </button>

      <div className="flex-1 text-center px-2">
        <span className="text-heading font-semibold text-ink tracking-tight">
          {formattedMonth}
        </span>
      </div>

      <button
        type="button"
        onClick={handleNext}
        aria-label={t('nextMonth')}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:text-ink hover:bg-surface-2 active:bg-surface-2/80 cursor-pointer"
      >
        <ChevronRight className="size-6 rtl:rotate-180" />
      </button>
    </div>
  );
}

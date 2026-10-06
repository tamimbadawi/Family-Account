'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Calendar } from 'lucide-react';

export interface DateChipsProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  className?: string;
}

function getLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DateChips({ value, onChange, className = '' }: DateChipsProps) {
  const t = useTranslations('entry');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const todayStr = React.useMemo(() => getLocalDateString(new Date()), []);
  const yesterdayStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
  }, []);

  const isToday = value === todayStr;
  const isYesterday = value === yesterdayStr;
  const isCustom = !isToday && !isYesterday && Boolean(value);

  return (
    <div className={`flex flex-wrap items-center gap-2 select-none ${className}`}>
      {/* Today Chip */}
      <button
        type="button"
        onClick={() => onChange(todayStr)}
        className={`inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 text-body font-medium transition-all active:scale-95 ${
          isToday
            ? 'bg-accent text-accent-ink shadow-xs font-semibold'
            : 'bg-surface-2 text-ink hover:bg-line/70'
        }`}
      >
        {t('today')}
      </button>

      {/* Yesterday Chip */}
      <button
        type="button"
        onClick={() => onChange(yesterdayStr)}
        className={`inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 text-body font-medium transition-all active:scale-95 ${
          isYesterday
            ? 'bg-accent text-accent-ink shadow-xs font-semibold'
            : 'bg-surface-2 text-ink hover:bg-line/70'
        }`}
      >
        {t('yesterday')}
      </button>

      {/* Pick Day Chip with native date picker */}
      <label
        className={`relative inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-4 text-body font-medium transition-all active:scale-95 ${
          isCustom
            ? 'bg-accent text-accent-ink shadow-xs font-semibold'
            : 'bg-surface-2 text-ink hover:bg-line/70'
        }`}
      >
        <Calendar className="size-4 shrink-0" />
        <span>{isCustom ? value : t('pickDay')}</span>
        <input
          ref={fileInputRef}
          type="date"
          value={value}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          className="absolute inset-0 opacity-0 cursor-pointer text-base w-full h-full"
          style={{ fontSize: '16px' }} // Prevents iOS Safari zoom on focus
        />
      </label>
    </div>
  );
}

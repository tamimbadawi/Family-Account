'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PERIODS, periodLabel, shiftAnchor, type Period } from '@/lib/history/period';

export interface PeriodSwitcherProps {
  period: Period;
  anchor: string; // 'YYYY-MM-DD' inside the shown period
  onChange: (period: Period, anchor: string) => void;
}

/** ‹ October 2026 ▾ ›  — arrows step one day/week/month/year; the label picks which. */
export function PeriodSwitcher({ period, anchor, onChange }: PeriodSwitcherProps) {
  const t = useTranslations('history');
  const locale = useLocale();
  const arrow =
    'flex size-12 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 active:scale-95 cursor-pointer';

  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface p-1 shadow-card select-none">
      <button type="button" onClick={() => onChange(period, shiftAnchor(period, anchor, -1))} aria-label={t(`prev.${period}`)} className={arrow}>
        <ChevronLeft className="size-6 rtl:rotate-180" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('choosePeriod')}
            className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 transition-colors hover:bg-surface-2 cursor-pointer"
          >
            <span data-month-label className="truncate text-heading font-semibold tracking-tight text-ink tabular-nums">
              {periodLabel(period, anchor, locale)}
            </span>
            <ChevronDown className="size-5 shrink-0 text-ink-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-52 rounded-2xl p-1.5">
          {PERIODS.map((p) => (
            <DropdownMenuItem
              key={p}
              onSelect={() => onChange(p, anchor)}
              className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-body font-medium cursor-pointer"
            >
              <span className="flex-1">{t(`period.${p}`)}</span>
              {p === period && <Check className="size-5 shrink-0 text-accent" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <button type="button" onClick={() => onChange(period, shiftAnchor(period, anchor, 1))} aria-label={t(`next.${period}`)} className={arrow}>
        <ChevronRight className="size-6 rtl:rotate-180" />
      </button>
    </div>
  );
}

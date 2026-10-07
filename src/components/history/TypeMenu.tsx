'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight, Check, ChevronDown, ListFilter, TrendingDown, TrendingUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { HistoryType } from '@/lib/history/filters';

const OPTIONS: { value: HistoryType; key: string; icon: typeof ListFilter; tone: string }[] = [
  { value: 'all', key: 'all', icon: ListFilter, tone: 'text-ink' },
  { value: 'expense', key: 'expenses', icon: TrendingDown, tone: 'text-expense' },
  { value: 'income', key: 'incomes', icon: TrendingUp, tone: 'text-income' },
  { value: 'transfer', key: 'moves', icon: ArrowLeftRight, tone: 'text-accent' },
];

/** "All ▾" dropdown: which kind of entries History shows. */
export function TypeMenu({ value, onChange }: { value: HistoryType; onChange: (v: HistoryType) => void }) {
  const t = useTranslations('history');
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('showType')}
          className="flex h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-surface px-4 text-body font-semibold shadow-card transition-transform active:scale-[0.98] cursor-pointer select-none"
        >
          <span className={`flex min-w-0 items-center gap-2 ${current.tone}`}>
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{t(current.key)}</span>
          </span>
          <ChevronDown className="size-5 shrink-0 text-ink-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-2xl p-1.5">
        {OPTIONS.map((o) => {
          const OptionIcon = o.icon;
          return (
            <DropdownMenuItem
              key={o.value}
              onSelect={() => onChange(o.value)}
              className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-body font-medium cursor-pointer"
            >
              <OptionIcon className={`size-5 shrink-0 ${o.tone}`} />
              <span className="flex-1">{t(o.key)}</span>
              {o.value === value && <Check className="size-5 shrink-0 text-accent" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

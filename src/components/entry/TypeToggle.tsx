'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { EntryType } from '@/lib/data/types';

/** 'goal' is not a kind of entry: it is a move from a wallet into a savings goal, offered as its own choice. */
export type SheetType = EntryType | 'goal';

export interface TypeToggleProps {
  value: SheetType;
  onChange: (value: SheetType) => void;
  /** Offer "Goal" as a fourth choice (new entries only). */
  showGoal?: boolean;
  className?: string;
}

export function TypeToggle({ value, onChange, showGoal = false, className = '' }: TypeToggleProps) {
  const t = useTranslations('entry');

  const options: { type: SheetType; label: string }[] = [
    { type: 'expense', label: t('expense') },
    { type: 'income', label: t('income') },
    { type: 'transfer', label: t('transfer') },
    ...(showGoal ? [{ type: 'goal' as const, label: t('goal') }] : []),
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Entry type"
      className={`inline-flex h-12 w-full items-center justify-between rounded-2xl bg-surface-2 p-1 select-none ${className}`}
    >
      {options.map((opt) => {
        const isSelected = value === opt.type;

        let activeColor = 'text-ink';
        if (isSelected) {
          if (opt.type === 'expense') activeColor = 'text-expense';
          else if (opt.type === 'income') activeColor = 'text-income';
          else activeColor = 'text-accent';
        }

        return (
          <button
            key={opt.type}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.type)}
            className={`flex h-10 items-center justify-center rounded-xl text-body font-semibold whitespace-nowrap transition-all ${showGoal ? 'flex-auto px-2' : 'flex-1 px-3'} ${
              isSelected
                ? `bg-surface shadow-card ${activeColor}`
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

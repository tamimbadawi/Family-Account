'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { EntryType } from '@/lib/data/types';

export interface TypeToggleProps {
  value: EntryType;
  onChange: (value: EntryType) => void;
  className?: string;
}

export function TypeToggle({ value, onChange, className = '' }: TypeToggleProps) {
  const t = useTranslations('entry');

  const options: { type: EntryType; label: string }[] = [
    { type: 'expense', label: t('expense') },
    { type: 'income', label: t('income') },
    { type: 'transfer', label: t('transfer') },
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
            className={`flex h-10 flex-1 items-center justify-center rounded-xl px-3 text-body font-semibold transition-all ${
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

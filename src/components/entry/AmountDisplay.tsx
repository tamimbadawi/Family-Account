'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import type { EntryType } from '@/lib/data/types';

export interface AmountDisplayProps {
  value: string;
  type?: EntryType;
  placeholder?: string;
  className?: string;
}

export function AmountDisplay({
  value,
  type = 'expense',
  placeholder = '0',
  className = '',
}: AmountDisplayProps) {
  const locale = useLocale();
  const isAr = locale.startsWith('ar');
  const currency = isAr ? 'ج.م' : 'EGP';

  let colorClass = 'text-expense';
  if (type === 'income') colorClass = 'text-income';
  else if (type === 'transfer') colorClass = 'text-ink';

  // Format value with thousands separators while preserving typing state (dot, trailing zeros)
  const formatLive = (val: string) => {
    if (!val) return '';
    const parts = val.split('.');
    const intPart = parts[0];
    const decPart = parts.length > 1 ? parts[1] : null;

    const formattedInt = Number(intPart).toLocaleString('en-US'); // Western digits 0-9
    if (decPart !== null) {
      return `${formattedInt}.${decPart}`;
    }
    return formattedInt;
  };

  const displayStr = value ? formatLive(value) : placeholder;
  const isPlaceholder = !value;

  return (
    <div
      aria-label="Amount"
      className={`flex items-baseline justify-center gap-1.5 py-4 text-center select-none ${className}`}
    >
      <span
        data-amount
        className={`text-display font-semibold tabular-nums tracking-tight ${
          isPlaceholder ? 'text-ink-faint' : colorClass
        }`}
      >
        {displayStr}
      </span>
      <span className="text-caption font-medium text-ink-muted">
        {currency}
      </span>
    </div>
  );
}

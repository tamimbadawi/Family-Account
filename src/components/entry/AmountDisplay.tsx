'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { EntryType } from '@/lib/data/types';
import { formatExpression, hasOperator, previewValue } from '@/lib/format/expression';

export interface AmountDisplayProps {
  value: string;
  type?: EntryType;
  placeholder?: string;
  className?: string;
}

// Format value with thousands separators while preserving typing state (dot, trailing zeros)
function formatLive(val: string) {
  if (!val) return '';
  const parts = val.split('.');
  const intPart = parts[0];
  const decPart = parts.length > 1 ? parts[1] : null;

  const formattedInt = Number(intPart).toLocaleString('en-US'); // Western digits 0-9
  if (decPart !== null) {
    return `${formattedInt}.${decPart}`;
  }
  return formattedInt;
}

// Long expressions keep their newest part visible, like a phone calculator
const MAX_EXPRESSION_CHARS = 30;
function tailOf(expr: string) {
  if (expr.length <= MAX_EXPRESSION_CHARS) return expr;
  const tail = expr.slice(-MAX_EXPRESSION_CHARS);
  return '… ' + tail.slice(tail.indexOf(' ') + 1);
}

export function AmountDisplay({
  value,
  type = 'expense',
  placeholder = '0',
  className = '',
}: AmountDisplayProps) {
  const locale = useLocale();
  const t = useTranslations('entry');
  const isAr = locale.startsWith('ar');
  const currency = isAr ? 'ج.م' : 'EGP';

  let colorClass = 'text-expense';
  if (type === 'income') colorClass = 'text-income';
  else if (type === 'transfer') colorClass = 'text-ink';

  const isExpression = hasOperator(value);
  const result = isExpression ? previewValue(value) : null;

  let displayStr: string;
  if (!value) displayStr = placeholder;
  else if (!isExpression) displayStr = formatLive(value);
  else if (result === null) displayStr = '—';
  else displayStr = result.toLocaleString('en-US', { maximumFractionDigits: 2 });

  const isPlaceholder = !value;

  // Fixed min height so the optional expression line never pushes the pad down
  return (
    <div
      aria-label={t('amount')}
      className={`flex min-h-18 flex-col items-center justify-center text-center select-none ${className}`}
    >
      {isExpression && (
        <span
          dir="ltr"
          data-expression
          className="max-w-full whitespace-nowrap text-body text-ink-muted tabular-nums"
        >
          {tailOf(formatExpression(value))}
        </span>
      )}
      <div className={`flex items-baseline justify-center gap-1.5 ${isExpression ? '' : 'py-4'}`}>
        <span
          data-amount
          className={`text-display font-semibold tabular-nums tracking-tight ${
            isPlaceholder || (isExpression && result === null) ? 'text-ink-faint' : colorClass
          }`}
        >
          {displayStr}
        </span>
        <span className="text-caption font-medium text-ink-muted">{currency}</span>
      </div>
    </div>
  );
}

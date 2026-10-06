'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Delete, Divide, Minus, Plus, X } from 'lucide-react';
import { applyKey } from './amount-pad';

export interface AmountPadProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const OPERATOR_ICONS = {
  '/': { Icon: Divide, label: 'divide' },
  '*': { Icon: X, label: 'multiply' },
  '-': { Icon: Minus, label: 'minus' },
  '+': { Icon: Plus, label: 'plus' },
} as const;

type OperatorKey = keyof typeof OPERATOR_ICONS;

// 4 × 4: digits on the start side, operators in the inline-end column (÷ × − + top to bottom)
const KEYS = [
  '1', '2', '3', '/',
  '4', '5', '6', '*',
  '7', '8', '9', '-',
  '.', '0', 'backspace', '+',
];

export function AmountPad({ value, onChange, className = '' }: AmountPadProps) {
  const t = useTranslations('entry');

  const handleKeyClick = (key: string) => {
    onChange(applyKey(value, key));
  };

  return (
    <div
      role="group"
      aria-label={t('keypad')}
      className={`grid grid-cols-4 gap-2 select-none ${className}`}
    >
      {KEYS.map((key) => {
        const isBackspace = key === 'backspace';
        const op = key in OPERATOR_ICONS ? OPERATOR_ICONS[key as OperatorKey] : null;

        const base =
          'flex h-16 items-center justify-center rounded-2xl shadow-xs transition-transform active:scale-[0.97] focus:outline-none';
        const look = op
          ? 'bg-accent-soft text-accent active:bg-accent-soft/70'
          : 'bg-surface-2 text-display font-semibold text-ink active:bg-line/70';

        return (
          <button
            key={key}
            type="button"
            aria-label={isBackspace ? t('backspace') : op ? t(op.label) : key}
            onClick={() => handleKeyClick(key)}
            className={`${base} ${look}`}
          >
            {isBackspace ? (
              <Delete className="size-7 rtl:rotate-180" />
            ) : op ? (
              <op.Icon className="size-7" strokeWidth={2.5} />
            ) : (
              <span className="tabular-nums">{key}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

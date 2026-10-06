'use client';

import * as React from 'react';
import { Delete } from 'lucide-react';
import { applyKey } from './amount-pad';

export interface AmountPadProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function AmountPad({ value, onChange, className = '' }: AmountPadProps) {
  const handleKeyClick = (key: string) => {
    const next = applyKey(value, key);
    onChange(next);
  };

  const keys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '.', '0', 'backspace',
  ];

  return (
    <div
      role="group"
      aria-label="Amount keypad"
      className={`grid grid-cols-3 gap-2 select-none ${className}`}
    >
      {keys.map((key) => {
        const isBackspace = key === 'backspace';

        return (
          <button
            key={key}
            type="button"
            aria-label={isBackspace ? 'Backspace' : key}
            onClick={() => handleKeyClick(key)}
            className="flex h-16 items-center justify-center rounded-2xl bg-surface-2 text-display font-semibold text-ink shadow-xs transition-transform active:scale-[0.97] active:bg-line/70 focus:outline-none"
          >
            {isBackspace ? (
              <Delete className="size-7 rtl:rotate-180" />
            ) : (
              <span className="tabular-nums">{key}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

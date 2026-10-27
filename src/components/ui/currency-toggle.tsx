'use client';

import * as React from 'react';

export interface CurrencyToggleProps {
  currencies: string[];
  value: string;
  onChange: (currency: string) => void;
  className?: string;
}

/**
 * Clean segmented control for toggling between the family's 1 or 2 currencies.
 * Only renders when there are 2 or more distinct currencies.
 */
export function CurrencyToggle({
  currencies,
  value,
  onChange,
  className = '',
}: CurrencyToggleProps) {
  const distinct = React.useMemo(() => {
    return Array.from(new Set(currencies.filter(Boolean)));
  }, [currencies]);

  if (distinct.length <= 1) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Currency"
      className={`inline-flex items-center rounded-full bg-surface-2 p-0.5 text-caption font-semibold select-none ${className}`}
    >
      {distinct.map((cur) => {
        const active = cur === value;
        return (
          <button
            key={cur}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(cur)}
            className={`min-h-7 rounded-full px-2.5 py-0.5 text-caption font-semibold transition-all cursor-pointer ${
              active
                ? 'bg-surface text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {cur}
          </button>
        );
      })}
    </div>
  );
}

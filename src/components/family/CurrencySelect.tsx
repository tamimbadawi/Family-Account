'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { currencyChoices } from '@/lib/format';
import { cn } from '@/lib/utils';

interface CurrencySelectProps {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  /** Adds a first "none" choice with this label (value ''), for the optional second currency. */
  noneLabel?: string;
  /** A code that can't be picked here (the other currency). */
  exclude?: string;
  className?: string;
}

const subscribeNever = () => () => {};

/**
 * The family picks its own currencies. A native select opens the iPhone's wheel picker,
 * which older users already know; common currencies come first.
 */
export function CurrencySelect({ id, value, onChange, noneLabel, exclude, className }: CurrencySelectProps) {
  const locale = useLocale();
  // Currency names come from the phone's own Intl data, which differs from the server's: build the
  // list only after hydration (the server renders just the chosen code)
  const hydrated = React.useSyncExternalStore(subscribeNever, () => true, () => false);
  const choices = React.useMemo(
    () => (hydrated ? currencyChoices(locale) : value ? [{ code: value, name: value }] : []),
    [hydrated, locale, value]
  );

  return (
    <div className={cn('relative', className)}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 w-full cursor-pointer appearance-none truncate rounded-2xl bg-surface ps-4 pe-10 text-body text-ink shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {noneLabel !== undefined && <option value="">{noneLabel}</option>}
        {choices
          .filter((c) => c.code !== exclude)
          .map((c) => (
            <option key={c.code} value={c.code}>
              {c.name === c.code ? c.code : `${c.code} · ${c.name}`}
            </option>
          ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}

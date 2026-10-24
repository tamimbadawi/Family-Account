'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import type { EnrichedEntry } from '@/lib/data/types';
import { EntryRow } from '@/components/entry/EntryRow';
import { formatDay, money } from '@/lib/format';
import { totalsByCurrency } from '@/lib/money/groups';

export interface DayGroupProps {
  date: string; // 'YYYY-MM-DD'
  entries: EnrichedEntry[];
  filter?: 'all' | 'expense' | 'income';
  onEntryClick: (entry: EnrichedEntry) => void;
}

export function DayGroup({
  date,
  entries,
  filter = 'all',
  onEntryClick,
}: DayGroupProps) {
  const locale = useLocale();

  const expenseItems = entries
    .filter((e) => e.type === 'expense')
    .map((e) => ({ currency: e.accountCurrency || 'EGP', amount: e.amount }));

  const incomeItems = entries
    .filter((e) => e.type === 'income')
    .map((e) => ({ currency: e.accountCurrency || 'EGP', amount: e.amount }));

  const expenseTotals = totalsByCurrency(expenseItems);
  const incomeTotals = totalsByCurrency(incomeItems);

  const formatList = (totals: { currency: string; amount: number }[], prefix = '') =>
    totals.map((t) => `${prefix}${money(t.amount, locale, { currency: t.currency })}`).join(' + ');

  let formattedTotal = '';
  let totalClass = 'text-ink';

  if (filter === 'expense') {
    formattedTotal = formatList(expenseTotals);
  } else if (filter === 'income') {
    formattedTotal = formatList(incomeTotals, '+');
    totalClass = 'text-income';
  } else {
    if (expenseTotals.length > 0 && incomeTotals.length === 0) {
      formattedTotal = formatList(expenseTotals);
    } else if (incomeTotals.length > 0 && expenseTotals.length === 0) {
      formattedTotal = formatList(incomeTotals, '+');
      totalClass = 'text-income';
    } else if (expenseTotals.length > 0 && incomeTotals.length > 0) {
      formattedTotal = formatList(expenseTotals);
    } else {
      formattedTotal = '';
    }
  }

  const formattedDay = formatDay(date, locale);

  return (
    <section className="mb-4">
      {/* Sticky day header */}
      <div className="sticky top-0 z-10 flex items-center justify-between ps-4 pe-18 py-2 bg-canvas/95 backdrop-blur border-b border-line/40 select-none">
        <span className="text-caption font-semibold text-ink-muted">
          {formattedDay}
        </span>
        {formattedTotal && (
          <span className={`text-caption font-semibold tabular-nums ${totalClass}`}>
            {formattedTotal}
          </span>
        )}
      </div>

      {/* Day entries card/list */}
      <div className="ps-4 pe-18 bg-surface divide-y divide-line/30">
        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            onClick={() => onEntryClick(entry)}
          />
        ))}
      </div>
    </section>
  );
}

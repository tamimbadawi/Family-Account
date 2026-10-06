'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import type { EnrichedEntry } from '@/lib/data/types';
import { EntryRow } from '@/components/entry/EntryRow';
import { formatDay, money } from '@/lib/format';

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

  // Compute day total depending on active filter or entries
  const totalExpense = entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalIncome = entries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  let formattedTotal = '';
  let totalClass = 'text-ink';

  if (filter === 'expense') {
    formattedTotal = money(totalExpense, locale);
  } else if (filter === 'income') {
    formattedTotal = `+${money(totalIncome, locale)}`;
    totalClass = 'text-income';
  } else {
    // All filter: if there are expenses, show total expenses; if only income, show income
    if (totalExpense > 0 && totalIncome === 0) {
      formattedTotal = money(totalExpense, locale);
    } else if (totalIncome > 0 && totalExpense === 0) {
      formattedTotal = `+${money(totalIncome, locale)}`;
      totalClass = 'text-income';
    } else if (totalExpense > 0 && totalIncome > 0) {
      // Net or expenses: show expenses for day total
      formattedTotal = money(totalExpense, locale);
    } else {
      formattedTotal = '';
    }
  }

  const formattedDay = formatDay(date, locale);

  return (
    <section className="mb-4">
      {/* Sticky day header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-2.5 bg-canvas/95 backdrop-blur border-b border-line/40 select-none">
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
      <div className="px-5 bg-surface divide-y divide-line/30">
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

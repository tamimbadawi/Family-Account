'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { RecurrenceFrequency } from '@/lib/data/types';
import { dayOfWeek } from '@/lib/recurring/date';

export interface RecurrenceSummaryInput {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[] | null;
  startDate: string; // 'YYYY-MM-DD'
  dayOfMonth?: number;
  endDate?: string | null;
}

const utcDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Names of the weekdays 0 (Sunday) … 6 (Saturday) in the app language. */
export function useWeekdayNames(width: 'narrow' | 'short' | 'long' = 'short'): string[] {
  const locale = useLocale();
  return React.useMemo(() => {
    const format = new Intl.DateTimeFormat(locale.startsWith('ar') ? 'ar-EG' : 'en-EG', { weekday: width, timeZone: 'UTC' });
    // 1 January 2023 was a Sunday
    return Array.from({ length: 7 }, (_, d) => format.format(new Date(Date.UTC(2023, 0, 1 + d))));
  }, [locale, width]);
}

/** One plain sentence for a schedule: "Every 2 weeks on Mon, Thu, until 31 Dec 2026". */
export function useRecurrenceSummary(): (rule: RecurrenceSummaryInput) => string {
  const t = useTranslations('recurring');
  const locale = useLocale();
  const weekdays = useWeekdayNames('short');

  return React.useCallback(
    (rule) => {
      const intlLocale = locale.startsWith('ar') ? 'ar-EG' : 'en-EG';
      const date = (iso: string, options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(intlLocale, { ...options, numberingSystem: 'latn', timeZone: 'UTC' }).format(utcDate(iso));
      const count = Math.max(1, rule.interval);
      const n = String(count);

      let summary: string;
      if (rule.frequency === 'daily') {
        summary = t('everyDaily', { count, n });
      } else if (rule.frequency === 'weekly') {
        const days = rule.daysOfWeek?.length ? [...rule.daysOfWeek].sort((a, b) => a - b) : [dayOfWeek(rule.startDate)];
        const list = new Intl.ListFormat(intlLocale, { style: 'short', type: 'unit' }).format(days.map((d) => weekdays[d]));
        summary = t('everyWeekly', { count, n, days: list });
      } else if (rule.frequency === 'monthly') {
        summary = t('everyMonthly', { count, n, day: String(rule.dayOfMonth ?? Number(rule.startDate.slice(8))) });
      } else {
        summary = t('everyYearly', { count, n, date: date(rule.startDate, { day: 'numeric', month: 'long' }) });
      }

      return rule.endDate
        ? t('until', { summary, date: date(rule.endDate, { day: 'numeric', month: 'short', year: 'numeric' }) })
        : summary;
    },
    [t, locale, weekdays]
  );
}

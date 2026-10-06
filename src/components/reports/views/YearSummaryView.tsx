'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEntries } from '@/lib/data/provider';
import { calculateYearSummary } from '@/lib/reports/year-summary';
import { Card } from '@/components/ui/card';
import { money } from '@/lib/format';

export function YearSummaryView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const isRtl = locale.startsWith('ar');
  const [year, setYear] = React.useState(() => new Date().getFullYear());

  const entries = useEntries();

  const result = React.useMemo(() => {
    if (!entries) return null;
    return calculateYearSummary(entries, year, locale === 'ar' ? 'ar' : 'en');
  }, [entries, year, locale]);

  if (!result) return null;

  return (
    <div className="space-y-2 select-none">
      {/* Year Switcher */}
      <div className="flex items-center justify-between rounded-card bg-surface px-2 py-1 shadow-card border border-line/60">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          aria-label={t('previousMonth')}
          className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink active:scale-95 transition-all"
        >
          <ChevronLeft className="size-5 rtl:rotate-180" />
        </button>

        <span className="text-body font-bold text-ink tabular-nums">
          {year}
        </span>

        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          aria-label={t('nextMonth')}
          className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink active:scale-95 transition-all"
        >
          <ChevronRight className="size-5 rtl:rotate-180" />
        </button>
      </div>

      {/* 12-Month Bar Chart */}
      <Card className="rounded-card bg-surface p-3 shadow-card border border-line/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-body font-semibold text-ink">
            {t('library.yearFlow')}
          </span>
          <div className="flex items-center gap-3 text-caption font-medium">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-expense" />
              <span className="text-ink-muted">{t('spent')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-income" />
              <span className="text-ink-muted">{t('income')}</span>
            </div>
          </div>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={result.months}
              margin={{ top: 8, right: isRtl ? 0 : 4, left: isRtl ? 4 : 0, bottom: 0 }}
              barGap={2}
            >
              <XAxis
                dataKey="name"
                reversed={isRtl}
                stroke="var(--ink-muted)"
                tickLine={false}
                axisLine={{ stroke: 'var(--line)' }}
                tick={{ fill: 'var(--ink-muted)', fontSize: 15 }}
              />
              <YAxis
                orientation={isRtl ? 'right' : 'left'}
                stroke="var(--ink-muted)"
                tickLine={false}
                axisLine={false}
                tickCount={4}
                tick={{ fill: 'var(--ink-faint)', fontSize: 15 }}
                tickFormatter={(val: number) =>
                  money(val, locale, { compact: true, hideCurrency: true })
                }
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)', opacity: 0.5, radius: 8 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl bg-surface p-2.5 shadow-card border border-line text-ink">
                        <p className="text-caption font-semibold mb-1">{data.name}</p>
                        <div className="space-y-0.5 text-caption">
                          <p>
                            <span className="text-ink-muted">{t('spent')}: </span>
                            <span className="font-bold tabular-nums text-expense">
                              {money(data.expense, locale)}
                            </span>
                          </p>
                          <p>
                            <span className="text-ink-muted">{t('income')}: </span>
                            <span className="font-bold tabular-nums text-income">
                              {money(data.income, locale)}
                            </span>
                          </p>
                          <p>
                            <span className="text-ink-muted">{t('net')}: </span>
                            <span
                              className={`font-bold tabular-nums ${
                                data.net >= 0 ? 'text-ink' : 'text-expense'
                              }`}
                            >
                              {money(data.net, locale)}
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="expense" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="income" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Totals Summary Card */}
      <Card className="rounded-card bg-surface p-3.5 shadow-card border border-line/60">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-caption text-ink-muted block">
              {t('library.totalIncome')}
            </span>
            <span className="text-body font-bold tabular-nums text-income">
              {money(result.totalIncome, locale, { fractionDigits: 0 })}
            </span>
          </div>

          <div className="text-end">
            <span className="text-caption text-ink-muted block">
              {t('library.totalExpense')}
            </span>
            <span className="text-body font-bold tabular-nums text-expense">
              {money(result.totalExpense, locale, { fractionDigits: 0 })}
            </span>
          </div>

          <div className="pt-2 border-t border-line/40">
            <span className="text-caption text-ink-muted block">
              {t('library.totalSaved')}
            </span>
            <span
              className={`text-body font-bold tabular-nums ${
                result.totalSaved >= 0 ? 'text-ink' : 'text-expense'
              }`}
            >
              {money(result.totalSaved, locale, { fractionDigits: 0 })}
            </span>
          </div>

          <div className="pt-2 border-t border-line/40 text-end">
            <span className="text-caption text-ink-muted block">
              {t('library.monthlyAverage')}
            </span>
            <span className="text-body font-bold tabular-nums text-ink">
              {money(result.monthlyAverageExpense, locale, { fractionDigits: 0 })}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

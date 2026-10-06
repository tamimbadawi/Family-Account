'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSixMonthSummary } from '@/lib/data/provider';
import { Card } from '@/components/ui/card';
import { money } from '@/lib/format';
import { formatMonth, formatShortMonth } from '@/lib/reports/months';
import { useIsClient } from './useIsClient';

export interface SixMonthTrendsProps {
  selectedMonth: string;
  onSelectMonth?: (month: string) => void;
  className?: string;
}

export function SixMonthTrends({
  selectedMonth,
  onSelectMonth,
  className = '',
}: SixMonthTrendsProps) {
  const locale = useLocale();
  const t = useTranslations('reports');
  const isRtl = locale.startsWith('ar');
  const isClient = useIsClient();

  const summaries = useSixMonthSummary(selectedMonth);

  const chartData = React.useMemo(() => {
    if (!summaries) return [];
    return summaries.map((s) => ({
      month: s.month,
      name: formatShortMonth(s.month, locale),
      spent: s.expense,
      income: s.income,
      net: s.net,
      isSelected: s.month === selectedMonth,
    }));
  }, [summaries, selectedMonth, locale]);

  if (!isClient || !summaries) {
    return (
      <Card className={`rounded-card bg-surface p-5 shadow-card ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-28 rounded bg-surface-2 animate-pulse" />
          <div className="h-4 w-32 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="h-56 w-full rounded-xl bg-surface-2 animate-pulse" />
      </Card>
    );
  }

  return (
    <Card className={`rounded-card bg-surface p-3.5 shadow-card select-none gap-0 ${className}`}>
      {/* Header and Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-heading font-semibold text-ink">
          {t('lastSixMonths')}
        </h2>

        {/* Legend */}
        <div className="flex items-center gap-3 text-body font-medium">
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

      {/* Chart */}
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 10,
              right: isRtl ? 0 : 8,
              left: isRtl ? 8 : 0,
              bottom: 0,
            }}
            barGap={3}
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
                    <div className="rounded-xl bg-surface p-3 shadow-card border border-line text-ink">
                      <p className="text-caption font-semibold mb-1.5">
                        {formatMonth(data.month, locale)}
                      </p>
                      <div className="space-y-1 text-caption">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-ink-muted">{t('spent')}:</span>
                          <span className="font-bold tabular-nums text-expense">
                            {money(data.spent, locale)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-ink-muted">{t('income')}:</span>
                          <span className="font-bold tabular-nums text-income">
                            {money(data.income, locale)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 pt-1 border-t border-line font-medium">
                          <span className="text-ink-muted">{t('net')}:</span>
                          <span
                            className={`tabular-nums font-bold ${
                              data.net >= 0 ? 'text-ink' : 'text-expense'
                            }`}
                          >
                            {money(data.net, locale)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Spent Bars */}
            <Bar
              dataKey="spent"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              onClick={
                onSelectMonth
                  ? (_, index) => {
                      const item = chartData[index];
                      if (item) onSelectMonth(item.month);
                    }
                  : undefined
              }
              cursor={onSelectMonth ? 'pointer' : 'default'}
            >
              {chartData.map((entry) => (
                <Cell
                  key={`spent-${entry.month}`}
                  fill="var(--expense)"
                  fillOpacity={entry.isSelected ? 1 : 0.45}
                />
              ))}
            </Bar>

            {/* Income Bars */}
            <Bar
              dataKey="income"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              onClick={
                onSelectMonth
                  ? (_, index) => {
                      const item = chartData[index];
                      if (item) onSelectMonth(item.month);
                    }
                  : undefined
              }
              cursor={onSelectMonth ? 'pointer' : 'default'}
            >
              {chartData.map((entry) => (
                <Cell
                  key={`income-${entry.month}`}
                  fill="var(--income)"
                  fillOpacity={entry.isSelected ? 1 : 0.45}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

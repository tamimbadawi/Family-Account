'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryTotal } from '@/lib/data/types';
import { formatCenterTotal, money, pickName } from '@/lib/format';
import { useIsClient } from './useIsClient';

export const DONUT_PALETTE = [
  'var(--accent)',
  'var(--expense)',
  'var(--income)',
  'var(--warning)',
  'var(--transfer)',
];

export interface CategoryDonutProps {
  data: CategoryTotal[];
  total: number;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  height?: number;
  className?: string;
  currency?: string;
}

export function CategoryDonut({
  data,
  total,
  onSelect,
  selectedId,
  height = 112,
  className = '',
  currency,
}: CategoryDonutProps) {
  const locale = useLocale();
  const t = useTranslations('reports');
  const isClient = useIsClient();

  const center = React.useMemo(() => formatCenterTotal(total, locale, { currency }), [total, locale, currency]);

  const chartData = React.useMemo(() => {
    return data.map((item, index) => ({
      id: item.id,
      name: pickName({ name_ar: item.nameAr, name_en: item.nameEn }, locale) || item.id,
      value: item.total,
      percentage: item.percentage ?? 0,
      color: item.color || DONUT_PALETTE[index % DONUT_PALETTE.length],
    }));
  }, [data, locale]);

  if (!isClient) {
    return (
      <div
        style={{ height }}
        className={`relative flex w-full items-center justify-center ${className}`}
      >
        <div className="size-20 rounded-full border-4 border-surface-2 animate-pulse" />
      </div>
    );
  }

  if (chartData.length === 0 || total === 0) {
    return (
      <div
        style={{ height }}
        className={`flex flex-col items-center justify-center rounded-card bg-surface/50 p-2 text-center text-ink-muted ${className}`}
      >
        <div className="size-16 rounded-full border-2 border-dashed border-line flex items-center justify-center">
          <span className="text-caption text-ink-muted">{t('noExpenses')}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ height }}
      className={`relative flex w-full items-center justify-center select-none ${className}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="rounded-xl bg-surface px-3 py-1.5 shadow-card border border-line text-ink">
                    <p className="text-body font-semibold">{item.name}</p>
                    <p className="text-body font-bold tabular-nums text-expense">
                      {money(item.value, locale)}
                      <span className="ms-1.5 text-caption font-normal text-ink-muted">
                        ({item.percentage}%)
                      </span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="68%"
            outerRadius="90%"
            paddingAngle={2}
            dataKey="value"
            onClick={
              onSelect
                ? (_, index) => {
                    const item = chartData[index];
                    if (item) onSelect(item.id);
                  }
                : undefined
            }
            cursor={onSelect ? 'pointer' : 'default'}
          >
            {chartData.map((entry) => {
              const isSelected = selectedId === entry.id;
              return (
                <Cell
                  key={`cell-${entry.id}`}
                  fill={entry.color}
                  stroke={isSelected ? 'var(--ink)' : 'transparent'}
                  strokeWidth={isSelected ? 2 : 0}
                  className="transition-all duration-200 outline-none hover:opacity-90"
                />
              );
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Center Total: Stacked number and unit inside SVG */}
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-ink text-[17px] font-bold tabular-nums"
        >
          {center.value}
        </text>
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-ink-muted text-caption font-medium"
        >
          {center.unit}
        </text>
      </svg>
    </div>
  );
}

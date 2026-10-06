'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryTotal } from '@/lib/data/types';
import { money, pickName } from '@/lib/format';
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
}

function formatCenterTotal(total: number, locale: string) {
  const isAr = locale.startsWith('ar');
  if (total >= 1_000_000) {
    const num = (total / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return {
      value: num,
      unit: isAr ? 'مليون ج.م' : 'M EGP',
    };
  }
  if (total >= 1_000) {
    const num = (total / 1_000).toFixed(1).replace(/\.0$/, '');
    return {
      value: num,
      unit: isAr ? 'ألف ج.م' : 'k EGP',
    };
  }
  return {
    value: Math.round(total).toString(),
    unit: isAr ? 'ج.م' : 'EGP',
  };
}

export function CategoryDonut({
  data,
  total,
  onSelect,
  selectedId,
  height = 84,
  className = '',
}: CategoryDonutProps) {
  const locale = useLocale();
  const t = useTranslations('reports');
  const isClient = useIsClient();

  const center = React.useMemo(() => formatCenterTotal(total, locale), [total, locale]);

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
            innerRadius="64%"
            outerRadius="88%"
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

      {/* Center Total: Stacked number and unit to prevent clipping */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
        <span className="text-body font-bold tabular-nums text-ink leading-tight">
          {center.value}
        </span>
        <span className="text-caption font-medium text-ink-muted leading-none">
          {center.unit}
        </span>
      </div>
    </div>
  );
}

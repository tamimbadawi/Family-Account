'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Entries added per day over the last 30 days: one series, so no legend; the card title names it. */
export function DailyEntriesChart({ daily }: { daily: { day: string; entries: number }[] }) {
  const t = useTranslations('operator');
  const locale = useLocale();
  const isAr = locale.startsWith('ar');
  const dayLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', numberingSystem: 'latn' }),
    [isAr]
  );
  // Right-to-left reads the newest day on the left, like every other chart in the app
  const data = React.useMemo(() => {
    const rows = daily.map((d) => ({ ...d, label: dayLabel.format(new Date(`${d.day}T12:00:00`)) }));
    return isAr ? [...rows].reverse() : rows;
  }, [daily, dayLabel, isAr]);

  return (
    <div className="h-40 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap={2}>
          <XAxis
            dataKey="label"
            interval={6}
            padding={{ left: 16, right: 16 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--line)' }}
            tick={{ fill: 'var(--ink-muted)', fontSize: 13 }}
          />
          <YAxis hide allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)', opacity: 0.6, radius: 4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as { label: string; entries: number };
              return (
                <div className="rounded-xl border border-line bg-surface px-3 py-1.5 text-ink shadow-card">
                  <p className="text-caption text-ink-muted">{row.label}</p>
                  <p className="text-body font-semibold tabular-nums">{t('chartTooltip', { count: row.entries })}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="entries" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

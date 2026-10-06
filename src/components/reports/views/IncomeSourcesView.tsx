'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Layers } from 'lucide-react';
import { useEntries } from '@/lib/data/provider';
import { calculateIncomeSources } from '@/lib/reports/income-sources';
import { resolvePresetPeriod, type PresetPeriod } from '@/lib/reports/presets';
import { Card } from '@/components/ui/card';
import { money } from '@/lib/format';

export function IncomeSourcesView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [periodPreset, setPeriodPreset] = React.useState<PresetPeriod>('this-month');

  const entries = useEntries();

  const period = React.useMemo(() => {
    return resolvePresetPeriod(periodPreset);
  }, [periodPreset]);

  const result = React.useMemo(() => {
    if (!entries) return null;
    return calculateIncomeSources(entries, period, locale === 'ar' ? 'ar' : 'en');
  }, [entries, period, locale]);

  if (!result) return null;

  return (
    <div className="space-y-2 select-none">
      {/* Period Chips */}
      <div className="flex items-center gap-1.5 p-0.5">
        {[
          { id: 'this-month', key: 'thisMonth' },
          { id: 'last-6-months', key: 'last6' },
          { id: 'this-year', key: 'thisYear' },
        ].map((p) => {
          const isSelected = periodPreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodPreset(p.id as PresetPeriod)}
              className={`flex-1 h-8 rounded-full text-caption font-semibold transition-all active:scale-95 text-center px-1 whitespace-nowrap ${
                isSelected
                  ? 'bg-accent text-accent-ink shadow-xs'
                  : 'bg-surface-2 text-ink-muted hover:text-ink'
              }`}
            >
              {t(`periods.${p.key}`)}
            </button>
          );
        })}
      </div>

      {/* Donut Chart Card */}
      <Card className="rounded-card bg-surface p-3 shadow-card border border-line/60">
        <div className="flex items-center justify-between mb-1">
          <span className="text-body font-semibold text-ink">
            {t('library.incomeDistribution')}
          </span>
          <span className="text-body font-bold tabular-nums text-income">
            {money(result.totalIncome, locale, { fractionDigits: 0 })}
          </span>
        </div>

        {result.sources.length === 0 ? (
          <div className="py-8 text-center text-ink-muted">
            <Layers className="size-8 mx-auto text-ink-faint mb-2" />
            <p className="text-body font-medium">{t('emptyEntries')}</p>
          </div>
        ) : (
          <div className="relative h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={result.sources}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={56}
                  paddingAngle={3}
                >
                  {result.sources.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl bg-surface px-3 py-1.5 shadow-card border border-line text-ink">
                          <p className="text-caption font-semibold">{data.name}</p>
                          <p className="text-caption font-bold tabular-nums text-income">
                            {money(data.amount, locale)}
                            <span className="ms-1.5 text-ink-muted font-normal">
                              ({data.percentage}%)
                            </span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-body font-bold tabular-nums text-income leading-tight">
                {money(result.totalIncome, locale, { compact: true, hideCurrency: true })}
              </span>
              <span className="text-caption font-medium text-ink-muted leading-none">
                {locale.startsWith('ar') ? 'ج.م' : 'EGP'}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Sources List Card */}
      <Card className="rounded-card bg-surface p-3 shadow-card border border-line/60 divide-y divide-line/40">
        {result.sources.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                style={{ backgroundColor: s.color }}
                className="size-3 rounded-full shrink-0"
              />
              <div className="min-w-0">
                <span className="text-body font-semibold text-ink truncate block">
                  {s.name}
                </span>
                <span className="text-caption text-ink-muted tabular-nums block">
                  {s.percentage}% · {s.entriesCount} {t('dim.item')}
                </span>
              </div>
            </div>

            <span className="text-body font-bold tabular-nums text-income shrink-0">
              {money(s.amount, locale, { fractionDigits: 0 })}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

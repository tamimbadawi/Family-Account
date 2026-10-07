'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEntries, useWallets } from '@/lib/data/provider';
import { balanceOverTimeReport } from '@/lib/reports/wallet-reports';
import { formatMonth, getLastNMonths } from '@/lib/reports/months';
import { Card } from '@/components/ui/card';
import { money, pickName } from '@/lib/format';

export function BalanceOverTimeView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [periodMonths, setPeriodMonths] = React.useState<6 | 12>(6);
  const [activeWalletIds, setActiveWalletIds] = React.useState<string[]>([]);

  const wallets = useWallets();
  const entries = useEntries();

  const currentMonth = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const months = React.useMemo(() => {
    return getLastNMonths(currentMonth, periodMonths);
  }, [currentMonth, periodMonths]);

  const report = React.useMemo(() => {
    return balanceOverTimeReport(wallets ?? [], entries ?? [], months);
  }, [wallets, entries, months]);

  // If no specific wallets selected, show all by default
  const visibleWalletIds = React.useMemo(() => {
    if (activeWalletIds.length === 0) {
      return report.wallets.map((w) => w.id);
    }
    return activeWalletIds;
  }, [activeWalletIds, report.wallets]);

  const toggleWallet = (id: string) => {
    setActiveWalletIds((prev) => {
      if (prev.length === 0) {
        // Was showing all, now toggle just this one
        return [id];
      }
      if (prev.includes(id)) {
        const next = prev.filter((wId) => wId !== id);
        return next;
      }
      return [...prev, id];
    });
  };

  const showAll = () => setActiveWalletIds([]);

  return (
    <div className="space-y-1.5 select-none">
      {/* 1. Period Selector (6 vs 12 months) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-surface rounded-xl p-0.5 border border-line/40 shadow-sm">
          <button
            type="button"
            onClick={() => setPeriodMonths(6)}
            className={`px-2.5 py-1 rounded-lg text-caption font-semibold transition-all cursor-pointer ${
              periodMonths === 6
                ? 'bg-accent text-accent-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('library.last6Months')}
          </button>
          <button
            type="button"
            onClick={() => setPeriodMonths(12)}
            className={`px-2.5 py-1 rounded-lg text-caption font-semibold transition-all cursor-pointer ${
              periodMonths === 12
                ? 'bg-accent text-accent-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('library.last12Months')}
          </button>
        </div>

        {/* Total of latest month */}
        <div className="text-end">
          <span className="text-caption text-ink-muted block">
            {formatMonth(currentMonth, locale)}
          </span>
          <span className="text-body font-bold text-ink tabular-nums">
            {money(
              report.dataPoints[report.dataPoints.length - 1]?.total ?? 0,
              locale
            )}
          </span>
        </div>
      </div>

      {/* 2. Interactive Wallet Chips */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          type="button"
          onClick={showAll}
          className={`h-7 px-2.5 rounded-full text-caption font-medium border transition-all cursor-pointer ${
            activeWalletIds.length === 0
              ? 'bg-ink text-canvas border-ink shadow-sm'
              : 'bg-surface text-ink-muted border-line/50 hover:bg-surface-2'
          }`}
        >
          {t('library.toggleAll')}
        </button>

        {report.wallets.map((w) => {
          const isSelected = visibleWalletIds.includes(w.id);
          const name =
            pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale) ||
            w.nameEn ||
            '';

          return (
            <button
              key={w.id}
              type="button"
              onClick={() => toggleWallet(w.id)}
              className={`h-7 px-2 rounded-full text-caption font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-surface border-line shadow-sm text-ink font-semibold'
                  : 'bg-surface/50 border-line/30 text-ink-muted/60 opacity-60'
              }`}
            >
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: w.color }}
              />
              <span className="whitespace-nowrap">{name}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Multi-Line Chart Card */}
      <Card className="rounded-card bg-surface p-2 shadow-card border border-line/60">
        <div className="h-[115px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={report.dataPoints}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="month"
                stroke="var(--color-ink-muted)"
                tick={{ fontSize: 15, fill: 'var(--color-ink-muted)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => {
                  const m = String(val).slice(5);
                  return m;
                }}
              />
              <YAxis
                stroke="var(--color-ink-muted)"
                tick={{ fontSize: 15, fill: 'var(--color-ink-muted)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) =>
                  val >= 1000 ? `${Math.round(val / 1000)}k` : String(val)
                }
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-xl bg-surface/95 backdrop-blur p-2.5 shadow-lg border border-line text-caption space-y-1">
                      <div className="font-semibold text-ink">
                        {formatMonth(String(label), locale)}
                      </div>
                      {payload.map((entry) => {
                        const wMeta = report.wallets.find(
                          (w) => w.id === entry.dataKey
                        );
                        const labelName = wMeta
                          ? pickName(
                              { name_ar: wMeta.nameAr, name_en: wMeta.nameEn },
                              locale
                            )
                          : entry.name;
                        return (
                          <div
                            key={String(entry.dataKey)}
                            className="flex items-center justify-between gap-3 text-ink-muted"
                          >
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="truncate max-w-[100px]">
                              {labelName}
                            </span>
                            <span className="font-semibold text-ink tabular-nums">
                              {money(Number(entry.value), locale)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              {report.wallets.map((w) => {
                if (!visibleWalletIds.includes(w.id)) return null;
                return (
                  <Line
                    key={w.id}
                    type="monotone"
                    dataKey={w.id}
                    stroke={w.color}
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: w.color }}
                    activeDot={{ r: 4.5 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 4. Wallet Balances Summary List */}
      <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 overflow-hidden">
        {report.wallets.map((w) => {
          const isVisible = visibleWalletIds.includes(w.id);
          const name =
            pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale) ||
            w.nameEn ||
            '';

          return (
            <div
              key={w.id}
              className={`flex items-center justify-between py-1.5 px-3 select-none transition-opacity ${
                isVisible ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: w.color }}
                />
                <span className="text-body font-medium text-ink">
                  {name}
                </span>
              </div>
              <span className="text-body font-semibold tabular-nums text-ink">
                {money(w.finalBalance, locale)}
              </span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

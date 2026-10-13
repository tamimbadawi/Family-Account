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
import { balanceOverTimeReport, type BalanceOverTimeMode } from '@/lib/reports/wallet-reports';
import { formatMonth, getLastNMonths } from '@/lib/reports/months';
import { Card } from '@/components/ui/card';
import { money, pickName } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { historyHref } from '@/lib/history/link';

export function BalanceOverTimeView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const tMoney = useTranslations('money');
  const [mode, setMode] = React.useState<BalanceOverTimeMode>('spending');
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
    return balanceOverTimeReport(wallets ?? [], entries ?? [], months, mode);
  }, [wallets, entries, months, mode]);

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
        return [id];
      }
      if (prev.includes(id)) {
        return prev.filter((wId) => wId !== id);
      }
      return [...prev, id];
    });
  };

  const showAll = () => setActiveWalletIds([]);

  return (
    <div className="space-y-2 select-none">
      {/* 1. Two-way switch: Spending | Saving */}
      <div
        role="tablist"
        className="inline-flex h-14 w-full items-center rounded-2xl bg-surface-2 p-1 select-none"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'spending'}
          onClick={() => {
            setMode('spending');
            setActiveWalletIds([]);
          }}
          className={`flex h-12 flex-1 items-center justify-center rounded-xl text-body font-semibold transition-all cursor-pointer ${
            mode === 'spending'
              ? 'bg-surface shadow-card text-ink'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {tMoney('spending')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'saving'}
          onClick={() => {
            setMode('saving');
            setActiveWalletIds([]);
          }}
          className={`flex h-12 flex-1 items-center justify-center rounded-xl text-body font-semibold transition-all cursor-pointer ${
            mode === 'saving'
              ? 'bg-surface shadow-card text-ink'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {tMoney('saving')}
        </button>
      </div>

      {/* 2. Period Selector (6 vs 12 months) */}
      <div className="flex bg-surface rounded-xl p-0.5 border border-line/40 shadow-sm w-fit">
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

      {/* 3. One section / chart per currency */}
      {report.currencies.length === 0 || report.wallets.length === 0 ? (
        <Card className="rounded-card bg-surface p-4 text-center border border-line/60">
          <p className="text-body text-ink-muted">{t('noData')}</p>
        </Card>
      ) : (
        report.currencies.map((currReport) => {
          if (currReport.wallets.length === 0) return null;

          return (
            <div key={currReport.currency} className="space-y-2">
              {/* Header with currency and latest month total */}
              <div className="flex items-center justify-between gap-2 px-1">
                {report.currencies.length > 1 ? (
                  <span className="text-caption font-semibold text-ink-muted uppercase">
                    {currReport.currency}
                  </span>
                ) : (
                  <span />
                )}
                <div className="text-end">
                  <span className="text-caption text-ink-muted block">
                    {formatMonth(currentMonth, locale)}
                  </span>
                  <span className="text-body font-bold text-ink tabular-nums">
                    {money(currReport.finalTotal, locale, {
                      currency: currReport.currency,
                    })}
                  </span>
                </div>
              </div>

              {/* Interactive Wallet Chips */}
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

                {currReport.wallets.map((w) => {
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

              {/* Multi-Line Chart Card */}
              <Card className="rounded-card bg-surface p-2 shadow-card border border-line/60">
                <div className="h-[115px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={currReport.dataPoints}
                      margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="month"
                        stroke="var(--color-ink-muted)"
                        tick={{ fontSize: 15, fill: 'var(--color-ink-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => String(val).slice(5)}
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
                                const isTotal = entry.dataKey === 'total';
                                const wMeta = isTotal
                                  ? null
                                  : currReport.wallets.find((w) => w.id === entry.dataKey);
                                const labelName = isTotal
                                  ? t('total')
                                  : wMeta
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
                                      {money(Number(entry.value), locale, {
                                        currency: currReport.currency,
                                      })}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }}
                      />
                      {/* In Spending mode, show own total line when all wallets are visible */}
                      {mode === 'spending' && activeWalletIds.length === 0 && (
                        <Line
                          key="total"
                          type="monotone"
                          dataKey="total"
                          name={t('total')}
                          stroke="var(--color-ink-muted)"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                          dot={{ r: 2, fill: 'var(--color-ink-muted)' }}
                          activeDot={{ r: 4 }}
                        />
                      )}
                      {currReport.wallets.map((w) => {
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

              {/* Caption note under chart for Saving mode */}
              {mode === 'saving' && (
                <p className="text-caption text-ink-muted px-1">
                  {t('library.savingPutInNote')}
                </p>
              )}

              {/* Wallet Balances Summary List */}
              <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 overflow-hidden">
                {currReport.wallets.map((w) => {
                  const isVisible = visibleWalletIds.includes(w.id);
                  const name =
                    pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale) ||
                    w.nameEn ||
                    '';

                  return (
                    <Link
                      key={w.id}
                      href={historyHref({ walletId: w.id })}
                      className={`flex min-h-12 items-center justify-between py-1.5 px-3 select-none transition-opacity active:bg-surface-2 ${
                        isVisible ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: w.color }}
                        />
                        <span className="text-body font-medium text-ink truncate">
                          {name}
                        </span>
                      </div>
                      <span className="text-body font-semibold tabular-nums text-ink shrink-0 ps-2">
                        {money(w.finalBalance, locale, {
                          currency: currReport.currency,
                        })}
                      </span>
                    </Link>
                  );
                })}
              </Card>
            </div>
          );
        })
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { historyHref } from '@/lib/history/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useEntries, useInvestments, useWalletBalances, useWallets } from '@/lib/data/provider';
import { netWorthReport } from '@/lib/reports/wallet-reports';
import { Card } from '@/components/ui/card';
import { money, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';
import { useRouter } from '@/i18n/navigation';

export function NetWorthView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const tMoney = useTranslations('money');
  const tWallets = useTranslations('wallets');
  const router = useRouter();

  const wallets = useWallets();
  const balances = useWalletBalances();
  const entries = useEntries();
  const investments = useInvestments(false);

  const currentMonth = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const report = React.useMemo(() => {
    return netWorthReport(
      wallets ?? [],
      balances ?? [],
      entries ?? [],
      currentMonth,
      investments ?? []
    );
  }, [wallets, balances, entries, currentMonth, investments]);

  const isPositive = report.spendingChangeVsLastMonth > 0;
  const isNegative = report.spendingChangeVsLastMonth < 0;

  const spendingFormatted = React.useMemo(() => {
    if (report.spendingTotals.length === 0) return money(0, locale);
    return report.spendingTotals
      .map((t) => money(t.amount, locale, { currency: t.currency }))
      .join(' + ');
  }, [report.spendingTotals, locale]);

  const savedFormatted = React.useMemo(() => {
    if (report.savedTotals.length === 0) return money(0, locale);
    return report.savedTotals
      .map((t) => money(t.amount, locale, { currency: t.currency }))
      .join(' + ');
  }, [report.savedTotals, locale]);

  const groupHeadingKey = {
    spending: 'groupSpending',
    goal: 'groupGoals',
    investment: 'groupInvestments',
  } as const;

  return (
    <div className="space-y-2 select-none">
      {/* 1. Hero Card: To spend & Saved side by side */}
      <Card className="rounded-card bg-surface p-3 px-3.5 shadow-card border border-line/60">
        <div className="grid grid-cols-2 gap-3 divide-x divide-line/40 rtl:divide-x-reverse">
          {/* Left: To spend with change chip */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="text-caption font-medium text-ink-muted">
                {tMoney('toSpend')}
              </span>
              <div
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-caption font-semibold tabular-nums ${
                  isPositive
                    ? 'bg-income/12 text-income'
                    : isNegative
                    ? 'bg-expense/12 text-expense'
                    : 'bg-surface-2 text-ink-muted'
                }`}
              >
                {isPositive && <ArrowUpRight className="size-3 rtl:rotate-90" />}
                {isNegative && <ArrowDownRight className="size-3 rtl:rotate-90" />}
                {!isPositive && !isNegative && <Minus className="size-3" />}
                <span>
                  {isPositive ? '+' : ''}
                  {money(report.spendingChangeVsLastMonth, locale)} ({Math.abs(report.spendingChangePercentage)}%)
                </span>
              </div>
            </div>

            <div className="text-heading font-bold tabular-nums text-ink leading-tight">
              {spendingFormatted}
            </div>
          </div>

          {/* Right: Saved without change chip */}
          <div className="space-y-1 min-w-0 ps-3">
            <span className="text-caption font-medium text-ink-muted block">
              {tMoney('saved')}
            </span>

            <div className="text-heading font-bold tabular-nums text-ink leading-tight">
              {savedFormatted}
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Grouped Wallet Lists */}
      {report.groups.map((group) => {
        if (group.wallets.length === 0) return null;

        const heading = tMoney(groupHeadingKey[group.purpose]);
        const subtotal =
          group.totals.length > 0
            ? group.totals
                .map((t) => money(t.amount, locale, { currency: t.currency }))
                .join(' + ')
            : money(0, locale);

        return (
          <div key={group.purpose} className="space-y-1">
            <div className="flex items-center justify-between px-1 pt-1.5 pb-0.5">
              <span className="text-caption font-semibold text-ink-muted">
                {heading}
              </span>
              <span className="text-caption font-bold tabular-nums text-ink">
                {subtotal}
              </span>
            </div>

            <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 overflow-hidden">
              {group.wallets.map((w) => {
                const name =
                  pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale) ||
                  w.nameEn ||
                  '';

                const typeLabel =
                  w.purpose === 'investment'
                    ? tMoney('investments')
                    : w.purpose === 'goal'
                    ? tMoney('goals')
                    : w.type === 'cash'
                    ? tWallets('cash')
                    : tWallets('banks');

                return (
                  <div
                    key={w.id}
                    onClick={() => router.push(historyHref({ walletId: w.id }))}
                    className="flex items-center justify-between py-1.5 px-3 hover:bg-surface-2/40 active:bg-surface-2/60 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        style={{
                          backgroundColor: `${w.color || '#0F766E'}18`,
                          color: w.color || '#0F766E',
                        }}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full"
                      >
                        <CategoryIcon name={w.icon || 'wallet'} className="size-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-body font-semibold text-ink truncate">
                          {name}
                        </div>
                        <div className="text-caption text-ink-muted">
                          {typeLabel} ·{' '}
                          <span className="tabular-nums">{w.sharePercentage}%</span> {t('library.shareOfTotal')}
                        </div>
                      </div>
                    </div>

                    <div className="text-end shrink-0 ps-2.5">
                      <div className="text-body font-semibold tabular-nums text-ink">
                        {money(w.currentBalance, locale, { currency: w.currency })}
                      </div>
                      {w.changeVsLastMonth !== 0 && (
                        <div
                          className={`text-caption tabular-nums ${
                            w.changeVsLastMonth > 0
                              ? 'text-income'
                              : 'text-expense'
                          }`}
                        >
                          {w.changeVsLastMonth > 0 ? '+' : ''}
                          {money(w.changeVsLastMonth, locale, { currency: w.currency })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useEntries, useWalletBalances, useWallets } from '@/lib/data/provider';
import { netWorthReport } from '@/lib/reports/wallet-reports';
import { Card } from '@/components/ui/card';
import { money, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';
import { useRouter } from '@/i18n/navigation';

export function NetWorthView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const tWallets = useTranslations('wallets');
  const router = useRouter();

  const wallets = useWallets();
  const balances = useWalletBalances();
  const entries = useEntries();

  const currentMonth = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const report = React.useMemo(() => {
    return netWorthReport(wallets ?? [], balances ?? [], entries ?? [], currentMonth);
  }, [wallets, balances, entries, currentMonth]);

  const isPositive = report.changeVsLastMonth > 0;
  const isNegative = report.changeVsLastMonth < 0;

  return (
    <div className="space-y-3 select-none">
      {/* 1. Hero Card: Total Net Worth + Change vs Last Month */}
      <Card className="rounded-card bg-surface p-5 shadow-card border border-line/60">
        <div className="text-caption font-medium text-ink-muted">
          {t('library.totalNetWorth')}
        </div>
        <div className="mt-1 text-hero font-bold tabular-nums text-ink">
          {money(report.totalNetWorth, locale)}
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-semibold tabular-nums ${
              isPositive
                ? 'bg-income/12 text-income'
                : isNegative
                ? 'bg-expense/12 text-expense'
                : 'bg-surface-2 text-ink-muted'
            }`}
          >
            {isPositive && <ArrowUpRight className="size-3.5 rtl:rotate-90" />}
            {isNegative && <ArrowDownRight className="size-3.5 rtl:rotate-90" />}
            {!isPositive && !isNegative && <Minus className="size-3.5" />}
            <span>
              {isPositive ? '+' : ''}
              {money(report.changeVsLastMonth, locale)} ({Math.abs(report.changePercentage)}%)
            </span>
          </div>
          <span className="text-caption text-ink-muted">
            {t('library.vsLastMonth')}
          </span>
        </div>
      </Card>

      {/* 2. Wallet List */}
      <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 overflow-hidden">
        {report.wallets.map((w) => {
          const name =
            pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale) ||
            w.nameEn ||
            '';

          return (
            <div
              key={w.id}
              onClick={() => router.push(`/history?wallet=${w.id}`)}
              className="flex items-center justify-between p-3.5 hover:bg-surface-2/40 active:bg-surface-2/60 transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  style={{
                    backgroundColor: `${w.color || '#0F766E'}18`,
                    color: w.color || '#0F766E',
                  }}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full"
                >
                  <CategoryIcon name={w.icon || 'wallet'} className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-body font-semibold text-ink truncate">
                    {name}
                  </div>
                  <div className="text-caption text-ink-muted">
                    {w.type === 'cash' ? tWallets('cash') : tWallets('banks')} ·{' '}
                    <span className="tabular-nums">{w.sharePercentage}%</span> {t('library.shareOfTotal')}
                  </div>
                </div>
              </div>

              <div className="text-end shrink-0 ps-3">
                <div className="text-body font-semibold tabular-nums text-ink">
                  {money(w.currentBalance, locale)}
                </div>
                <div
                  className={`text-caption tabular-nums ${
                    w.changeVsLastMonth > 0
                      ? 'text-income'
                      : w.changeVsLastMonth < 0
                      ? 'text-expense'
                      : 'text-ink-muted'
                  }`}
                >
                  {w.changeVsLastMonth > 0 ? '+' : ''}
                  {money(w.changeVsLastMonth, locale)}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

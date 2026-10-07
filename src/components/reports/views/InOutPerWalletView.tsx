'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import { useEntries, useWallets } from '@/lib/data/provider';
import { inOutPerWalletReport } from '@/lib/reports/wallet-reports';
import { MonthSwitcher } from '../MonthSwitcher';
import { Card } from '@/components/ui/card';
import { money, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';

export function InOutPerWalletView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const wallets = useWallets();
  const entries = useEntries();

  const report = React.useMemo(() => {
    return inOutPerWalletReport(wallets ?? [], entries ?? [], month);
  }, [wallets, entries, month]);

  return (
    <div className="space-y-2.5 select-none">
      {/* 1. Month Switcher */}
      <Card className="rounded-card bg-surface p-1.5 shadow-card border border-line/60">
        <MonthSwitcher month={month} onMonthChange={setMonth} />
      </Card>

      {/* 2. Month Overview Header */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="rounded-card bg-surface p-2.5 shadow-card border border-line/60 text-center">
          <div className="text-caption text-ink-muted flex items-center justify-center gap-1">
            <ArrowDownLeft className="size-3 text-income" />
            <span>{t('library.moneyIn')}</span>
          </div>
          <div className="text-body font-bold text-income tabular-nums mt-0.5 truncate">
            +{money(report.totalIn, locale)}
          </div>
        </Card>

        <Card className="rounded-card bg-surface p-2.5 shadow-card border border-line/60 text-center">
          <div className="text-caption text-ink-muted flex items-center justify-center gap-1">
            <ArrowUpRight className="size-3 text-expense" />
            <span>{t('library.moneyOut')}</span>
          </div>
          <div className="text-body font-bold text-expense tabular-nums mt-0.5 truncate">
            {money(report.totalOut, locale)}
          </div>
        </Card>

        <Card className="rounded-card bg-surface p-2.5 shadow-card border border-line/60 text-center">
          <div className="text-caption text-ink-muted flex items-center justify-center gap-1">
            <ArrowLeftRight className="size-3 text-accent" />
            <span>{t('library.transfersTotal')}</span>
          </div>
          <div className="text-body font-bold text-ink tabular-nums mt-0.5 truncate">
            {money(report.totalTransfers, locale)}
          </div>
        </Card>
      </div>

      {/* 3. Wallet Breakdown List */}
      <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 overflow-hidden">
        {report.wallets.map((w) => {
          const name =
            pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale) ||
            w.nameEn ||
            '';

          const hasTransfers = w.transfersIn > 0 || w.transfersOut > 0;

          return (
            <div key={w.walletId} className="p-3 select-none space-y-1.5">
              {/* Row Header: Icon + Name + Net Change */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    style={{
                      backgroundColor: `${w.color || '#0F766E'}18`,
                      color: w.color || '#0F766E',
                    }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  >
                    <CategoryIcon name={w.icon || 'wallet'} className="size-4" />
                  </div>
                  <span className="text-body font-semibold text-ink truncate">
                    {name}
                  </span>
                </div>

                <div
                  className={`text-body font-bold tabular-nums ${
                    w.netChange > 0
                      ? 'text-income'
                      : w.netChange < 0
                      ? 'text-expense'
                      : 'text-ink-muted'
                  }`}
                >
                  {w.netChange > 0 ? '+' : ''}
                  {money(w.netChange, locale)}
                </div>
              </div>

              {/* Row Details: In, Out, Transfers */}
              <div className="flex items-center justify-between text-caption text-ink-muted ps-11">
                <div className="flex items-center gap-3">
                  <span>
                    {t('library.moneyIn')}:{' '}
                    <strong className="text-ink font-semibold tabular-nums">
                      {money(w.moneyIn, locale)}
                    </strong>
                  </span>
                  <span>
                    {t('library.moneyOut')}:{' '}
                    <strong className="text-ink font-semibold tabular-nums">
                      {money(w.moneyOut, locale)}
                    </strong>
                  </span>
                </div>

                {hasTransfers && (
                  <span className="tabular-nums">
                    ⇄ +{money(w.transfersIn, locale)} / -{money(w.transfersOut, locale)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

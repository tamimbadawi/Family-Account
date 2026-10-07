'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Banknote, ArrowRight } from 'lucide-react';
import { useEntries, useWallets } from '@/lib/data/provider';
import { cashWithdrawalsReport } from '@/lib/reports/wallet-reports';
import { MonthSwitcher } from '../MonthSwitcher';
import { Card } from '@/components/ui/card';
import { formatDay, money } from '@/lib/format';

export function CashWithdrawalsView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const wallets = useWallets();
  const entries = useEntries();

  const report = React.useMemo(() => {
    return cashWithdrawalsReport(wallets ?? [], entries ?? [], month);
  }, [wallets, entries, month]);

  return (
    <div className="space-y-2.5 select-none">
      {/* 1. Month Switcher */}
      <Card className="rounded-card bg-surface p-1.5 shadow-card border border-line/60">
        <MonthSwitcher month={month} onMonthChange={setMonth} />
      </Card>

      {/* 2. Month Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="rounded-card bg-surface p-2.5 shadow-card border border-line/60 text-center">
          <div className="text-caption text-ink-muted">
            {t('library.totalWithdrawn')}
          </div>
          <div className="text-body font-bold text-ink tabular-nums mt-0.5 truncate">
            {money(report.totalWithdrawn, locale)}
          </div>
        </Card>

        <Card className="rounded-card bg-surface p-2.5 shadow-card border border-line/60 text-center">
          <div className="text-caption text-ink-muted">
            {t('library.withdrawalsCount', { count: report.count })}
          </div>
          <div className="text-body font-bold text-ink tabular-nums mt-0.5">
            {report.count}
          </div>
        </Card>

        <Card className="rounded-card bg-surface p-2.5 shadow-card border border-line/60 text-center">
          <div className="text-caption text-ink-muted">
            {t('library.avgWithdrawal')}
          </div>
          <div className="text-body font-bold text-ink tabular-nums mt-0.5 truncate">
            {money(report.averageWithdrawal, locale)}
          </div>
        </Card>
      </div>

      {/* 3. Withdrawals List */}
      {report.withdrawals.length === 0 ? (
        <Card className="rounded-card bg-surface p-8 text-center shadow-card border border-line/60 space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted mb-2">
            <Banknote className="size-6 text-ink-faint" />
          </div>
          <h3 className="text-body font-semibold text-ink">
            {t('library.noWithdrawals')}
          </h3>
          <p className="text-caption text-ink-muted max-w-xs mx-auto">
            {t('library.noWithdrawalsDesc')}
          </p>
        </Card>
      ) : (
        <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 overflow-hidden max-h-[380px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {report.withdrawals.map((w) => {
            const fromName =
              (locale === 'ar' ? w.fromWalletNameAr : w.fromWalletNameEn) ||
              w.fromWalletNameEn ||
              '';
            const toName =
              (locale === 'ar' ? w.toWalletNameAr : w.toWalletNameEn) ||
              w.toWalletNameEn ||
              '';

            return (
              <div key={w.id} className="p-3.5 space-y-1 select-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-body font-semibold text-ink">
                    <span>{fromName}</span>
                    <ArrowRight className="size-4 text-ink-muted rtl:rotate-180" />
                    <span>{toName}</span>
                  </div>
                  <div className="text-body font-bold tabular-nums text-ink">
                    {money(w.amount, locale)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-caption text-ink-muted">
                  <span>{formatDay(w.occurredOn, locale)}</span>
                  <div className="flex items-center gap-1">
                    <span>{t('library.cashSpentSince')}:</span>
                    <strong className="text-expense font-semibold tabular-nums">
                      {money(w.cashSpentSince, locale)}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

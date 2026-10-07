'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { History, ArrowRight } from 'lucide-react';
import { useEntries, useWallets } from '@/lib/data/provider';
import { transfersLogReport } from '@/lib/reports/wallet-reports';
import { Card } from '@/components/ui/card';
import { formatDay, money, pickName } from '@/lib/format';

export function TransfersLogView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [selectedWalletId, setSelectedWalletId] = React.useState<string | undefined>(undefined);

  const wallets = useWallets();
  const entries = useEntries();

  const report = React.useMemo(() => {
    return transfersLogReport(wallets ?? [], entries ?? [], {
      walletId: selectedWalletId,
    });
  }, [wallets, entries, selectedWalletId]);

  return (
    <div className="space-y-2.5 select-none">
      {/* 1. Wallet Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setSelectedWalletId(undefined)}
          className={`h-9 px-3 rounded-full text-caption font-semibold shrink-0 transition-all cursor-pointer ${
            selectedWalletId === undefined
              ? 'bg-accent text-accent-ink shadow-sm'
              : 'bg-surface text-ink-muted border border-line/40 hover:bg-surface-2'
          }`}
        >
          {t('library.allWallets')}
        </button>

        {(wallets ?? []).map((w) => {
          const isSelected = selectedWalletId === w.id;
          const name =
            pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale) ||
            w.nameEn ||
            '';

          return (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedWalletId(w.id)}
              className={`h-9 px-3 rounded-full text-caption font-semibold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-accent text-accent-ink shadow-sm'
                  : 'bg-surface text-ink-muted border border-line/40 hover:bg-surface-2'
              }`}
            >
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: w.color || '#0F766E' }}
              />
              <span>{name}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Summary Card */}
      <Card className="rounded-card bg-surface p-3 shadow-card border border-line/60 flex items-center justify-between">
        <div>
          <span className="text-caption text-ink-muted block">
            {t('library.transfersTotal')}
          </span>
          <span className="text-body font-bold text-ink tabular-nums">
            {money(report.totalTransfers, locale)}
          </span>
        </div>
        <div className="text-end">
          <span className="text-caption text-ink-muted block">
            {t('history.entries', { count: report.count })}
          </span>
          <span className="text-body font-semibold text-ink tabular-nums">
            {report.count}
          </span>
        </div>
      </Card>

      {/* 3. Transfers List */}
      {report.transfers.length === 0 ? (
        <Card className="rounded-card bg-surface p-8 text-center shadow-card border border-line/60 space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted mb-2">
            <History className="size-6 text-ink-faint" />
          </div>
          <h3 className="text-body font-semibold text-ink">
            {t('library.noTransfers')}
          </h3>
          <p className="text-caption text-ink-muted max-w-xs mx-auto">
            {t('library.noTransfersDesc')}
          </p>
        </Card>
      ) : (
        <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 overflow-hidden max-h-[400px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {report.transfers.map((item) => {
            const fromName =
              (locale === 'ar' ? item.fromWalletNameAr : item.fromWalletNameEn) ||
              item.fromWalletNameEn ||
              '';
            const toName =
              (locale === 'ar' ? item.toWalletNameAr : item.toWalletNameEn) ||
              item.toWalletNameEn ||
              '';

            return (
              <div key={item.id} className="p-3.5 space-y-1 select-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-body font-semibold text-ink truncate">
                    <span>{fromName}</span>
                    <ArrowRight className="size-4 text-ink-muted rtl:rotate-180 shrink-0" />
                    <span>{toName}</span>
                  </div>
                  <div className="text-body font-bold tabular-nums text-ink shrink-0 ps-2">
                    {money(item.amount, locale)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-caption text-ink-muted">
                  <span>{formatDay(item.occurredOn, locale)}</span>
                  {item.note && (
                    <span className="truncate max-w-[150px] italic">
                      {item.note}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

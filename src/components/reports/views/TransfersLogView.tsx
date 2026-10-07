'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { History, ArrowRight } from 'lucide-react';
import { useEntries, useWallets } from '@/lib/data/provider';
import { transfersLogReport } from '@/lib/reports/wallet-reports';
import { Card } from '@/components/ui/card';
import { formatDay, money, pickName } from '@/lib/format';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

export function TransfersLogView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [selectedWalletId, setSelectedWalletId] = React.useState<string | undefined>(undefined);
  const [showAllSheet, setShowAllSheet] = React.useState(false);

  const wallets = useWallets();
  const entries = useEntries();

  const report = React.useMemo(() => {
    return transfersLogReport(wallets ?? [], entries ?? [], {
      walletId: selectedWalletId,
    });
  }, [wallets, entries, selectedWalletId]);

  const visibleTransfers = report.transfers.slice(0, 2);

  const renderTransferRow = (item: (typeof report.transfers)[number]) => {
    const fromName =
      (locale === 'ar' ? item.fromWalletNameAr : item.fromWalletNameEn) ||
      item.fromWalletNameEn ||
      '';
    const toName =
      (locale === 'ar' ? item.toWalletNameAr : item.toWalletNameEn) ||
      item.toWalletNameEn ||
      '';

    return (
      <div key={item.id} className="py-2.5 px-3.5 space-y-0.5 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-body font-semibold text-ink">
            <span>{fromName}</span>
            <ArrowRight className="size-4 text-ink-muted rtl:rotate-180 shrink-0" />
            <span>{toName}</span>
          </div>
          <div className="text-body font-bold tabular-nums text-ink shrink-0 ps-2 whitespace-nowrap">
            {money(item.amount, locale)}
          </div>
        </div>

        <div className="flex items-center justify-between text-caption text-ink-muted">
          <span>{formatDay(item.occurredOn, locale)}</span>
          {item.note && (
            <span className="italic max-w-[200px] text-end">
              {item.note}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 select-none">
      {/* 1. Wallet Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setSelectedWalletId(undefined)}
          className={`h-8 px-3 rounded-full text-caption font-semibold shrink-0 transition-all cursor-pointer ${
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
              className={`h-8 px-3 rounded-full text-caption font-semibold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-accent text-accent-ink shadow-sm'
                  : 'bg-surface text-ink-muted border border-line/40 hover:bg-surface-2'
              }`}
            >
              <span
                className={`size-2 rounded-full shrink-0 ${w.color ? '' : 'bg-accent'}`}
                style={w.color ? { backgroundColor: w.color } : undefined}
              />
              <span className="whitespace-nowrap">{name}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Summary Card */}
      <Card className="rounded-card bg-surface p-2.5 shadow-card border border-line/60 flex items-center justify-between">
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
        <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 overflow-hidden">
          {visibleTransfers.map(renderTransferRow)}

          {report.transfers.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllSheet(true)}
              className="w-full py-2.5 text-center text-caption font-semibold text-accent hover:bg-surface-2 transition-colors border-t border-line/40 cursor-pointer"
            >
              {t('library.seeAllTransfers')} ({report.transfers.length})
            </button>
          )}
        </Card>
      )}

      {/* All Transfers Drawer */}
      <Drawer open={showAllSheet} onOpenChange={setShowAllSheet}>
        <DrawerContent className="max-h-[85dvh] flex flex-col bg-surface text-ink">
          <DrawerHeader className="pb-3 border-b border-line shrink-0">
            <div className="flex items-center justify-between gap-3">
              <DrawerTitle className="text-heading font-bold text-ink">
                {t('library.transfersTotal')}
              </DrawerTitle>
              <span className="text-heading font-bold tabular-nums text-ink">
                {money(report.totalTransfers, locale)}
              </span>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-line/30 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {report.transfers.map(renderTransferRow)}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

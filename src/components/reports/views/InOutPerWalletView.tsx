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

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

export function InOutPerWalletView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showAllSheet, setShowAllSheet] = React.useState(false);

  const wallets = useWallets();
  const entries = useEntries();

  const report = React.useMemo(() => {
    return inOutPerWalletReport(wallets ?? [], entries ?? [], month);
  }, [wallets, entries, month]);

  const visibleWallets = report.wallets.slice(0, 2);

  const renderWalletRow = (w: (typeof report.wallets)[number]) => {
    const name =
      pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale) ||
      w.nameEn ||
      '';

    const hasTransfers = w.transfersIn > 0 || w.transfersOut > 0;

    return (
      <div key={w.walletId} className="py-1.5 px-3 select-none space-y-0.5">
        {/* Row Header: Icon + Name + Net Change */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div
              style={{
                backgroundColor: `${w.color || '#0F766E'}18`,
                color: w.color || '#0F766E',
              }}
              className="flex size-7.5 shrink-0 items-center justify-center rounded-full"
            >
              <CategoryIcon name={w.icon || 'wallet'} className="size-3.5" />
            </div>
            <span className="text-body font-semibold text-ink">
              {name}
            </span>
          </div>

          <div
            className={`text-body font-bold tabular-nums shrink-0 ps-2 whitespace-nowrap ${
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
        <div className="flex items-center justify-between text-caption text-ink-muted ps-9">
          <div className="flex items-center gap-2.5">
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
            <span className="tabular-nums shrink-0 ps-1">
              ⇄ +{money(w.transfersIn, locale)} / -{money(w.transfersOut, locale)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1.5 select-none">
      {/* 1. Month Switcher */}
      <Card className="rounded-card bg-surface p-1 shadow-card border border-line/60">
        <MonthSwitcher month={month} onMonthChange={setMonth} />
      </Card>

      {/* 2. Month Overview Header */}
      <div className="grid grid-cols-3 gap-1.5">
        <Card className="rounded-card bg-surface p-1.5 shadow-card border border-line/60 text-center">
          <div className="text-caption text-ink-muted flex items-center justify-center gap-1">
            <ArrowDownLeft className="size-3.5 text-income shrink-0" />
            <span className="whitespace-nowrap">{t('library.moneyIn')}</span>
          </div>
          <div className="text-body font-bold text-income tabular-nums mt-0.5 whitespace-nowrap">
            +{money(report.totalIn, locale)}
          </div>
        </Card>

        <Card className="rounded-card bg-surface p-1.5 shadow-card border border-line/60 text-center">
          <div className="text-caption text-ink-muted flex items-center justify-center gap-1">
            <ArrowUpRight className="size-3.5 text-expense shrink-0" />
            <span className="whitespace-nowrap">{t('library.moneyOut')}</span>
          </div>
          <div className="text-body font-bold text-expense tabular-nums mt-0.5 whitespace-nowrap">
            {money(report.totalOut, locale)}
          </div>
        </Card>

        <Card className="rounded-card bg-surface p-1.5 shadow-card border border-line/60 text-center">
          <div className="text-caption text-ink-muted flex items-center justify-center gap-1">
            <ArrowLeftRight className="size-3.5 text-accent shrink-0" />
            <span className="whitespace-nowrap">{t('library.transfersTotal')}</span>
          </div>
          <div className="text-body font-bold text-ink tabular-nums mt-0.5 whitespace-nowrap">
            {money(report.totalTransfers, locale)}
          </div>
        </Card>
      </div>

      {/* 3. Wallet Breakdown List */}
      <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 overflow-hidden">
        {visibleWallets.map(renderWalletRow)}

        {report.wallets.length > 2 && (
          <button
            type="button"
            onClick={() => setShowAllSheet(true)}
            className="w-full py-1.5 text-center text-caption font-semibold text-accent hover:bg-surface-2 transition-colors border-t border-line/40 cursor-pointer"
          >
            {t('library.seeAllWallets')} ({report.wallets.length})
          </button>
        )}
      </Card>

      {/* All Wallets Drawer */}
      <Drawer open={showAllSheet} onOpenChange={setShowAllSheet}>
        <DrawerContent className="max-h-[85dvh] flex flex-col bg-surface text-ink">
          <DrawerHeader className="pb-3 border-b border-line shrink-0">
            <div className="flex items-center justify-between gap-3">
              <DrawerTitle className="text-heading font-bold text-ink">
                {t('library.inOutPerWallet')}
              </DrawerTitle>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-line/30 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {report.wallets.map(renderWalletRow)}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

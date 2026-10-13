'use client';

import * as React from 'react';
import { historyHref } from '@/lib/history/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Banknote,
  Building2,
  ChevronRight,
  CreditCard,
  PiggyBank,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useInvestments, useWalletBalances } from '@/lib/data/provider';
import type { WalletBalance, WalletType } from '@/lib/data/types';
import { money, pickName } from '@/lib/format';
import { totalsByCurrency } from '@/lib/money/groups';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Card } from '@/components/ui/card';

export interface OurMoneySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function getWalletTypeIcon(type: WalletType) {
  switch (type) {
    case 'cash':
      return Banknote;
    case 'bank':
      return Building2;
    case 'card':
      return CreditCard;
    case 'wallet':
    default:
      return WalletIcon;
  }
}

export function OurMoneySheet({ open, onOpenChange }: OurMoneySheetProps) {
  const locale = useLocale();
  const t = useTranslations('wallets');
  const tMoney = useTranslations('money');
  const router = useRouter();
  const allWallets = useWalletBalances();
  const investments = useInvestments(false);

  const activeWallets = React.useMemo(() => {
    return (
      allWallets?.filter(
        (w) => !w.isArchived && (w.purpose ?? 'spending') === 'spending'
      ) ?? []
    );
  }, [allWallets]);

  const totalFormatted = React.useMemo(() => {
    const totals = totalsByCurrency(
      activeWallets.map((w) => ({ currency: w.currency, amount: w.balance }))
    );
    if (totals.length === 0) return money(0, locale);
    return totals
      .map((t) => money(t.amount, locale, { currency: t.currency }))
      .join(' + ');
  }, [activeWallets, locale]);

  const savedTotals = React.useMemo(() => {
    if (!allWallets || !investments) return '';
    const goalItems = allWallets
      .filter((w) => !w.isArchived && w.purpose === 'goal')
      .map((w) => ({ currency: w.currency, amount: w.balance }));
    const investmentItems = investments.map((i) => ({
      currency: i.currency,
      amount: i.worth,
    }));
    const totals = totalsByCurrency([...goalItems, ...investmentItems]);
    if (totals.length === 0) return money(0, locale);
    return totals
      .map((t) => money(t.amount, locale, { currency: t.currency }))
      .join(' + ');
  }, [allWallets, investments, locale]);

  const cashWallets = React.useMemo(() => {
    return activeWallets.filter((w) => w.type === 'cash');
  }, [activeWallets]);

  const bankWallets = React.useMemo(() => {
    return activeWallets.filter((w) => w.type !== 'cash');
  }, [activeWallets]);

  const handleWalletClick = (wallet: WalletBalance) => {
    onOpenChange(false);
    router.push(historyHref({ walletId: wallet.id }));
  };

  const renderWalletRow = (wallet: WalletBalance) => {
    const name =
      pickName({ name_ar: wallet.nameAr, name_en: wallet.nameEn }, locale) ||
      wallet.id;
    const Icon = getWalletTypeIcon(wallet.type);

    return (
      <button
        key={wallet.id}
        type="button"
        onClick={() => handleWalletClick(wallet)}
        className="flex h-14 w-full items-center justify-between gap-3 px-3.5 rounded-xl hover:bg-surface-2 active:bg-surface-2/80 transition-colors cursor-pointer text-start select-none"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink">
            <Icon className="size-5" />
          </div>
          <span className="text-body font-semibold text-ink truncate">
            {name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ps-2">
          <span
            className={`text-body font-bold tabular-nums ${
              wallet.balance >= 0 ? 'text-ink' : 'text-expense'
            }`}
          >
            {money(wallet.balance, locale, { currency: wallet.currency })}
          </span>
          <ChevronRight className="size-4 text-ink-muted rtl:rotate-180 shrink-0" />
        </div>
      </button>
    );
  };

  const shouldScroll = activeWallets.length > 5;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh] px-5 pb-8 select-none">
        <DrawerHeader className="px-0 pt-3 pb-2 text-center">
          <DrawerTitle className="text-caption font-semibold text-ink-muted uppercase tracking-wider text-center">
            {t('ourMoney')}
          </DrawerTitle>
        </DrawerHeader>

        {/* Hero Balance */}
        <div className="text-center py-2">
          <div className="text-hero font-bold tabular-nums text-ink leading-tight">
            {totalFormatted}
          </div>
          <span className="text-caption text-ink-muted">
            {tMoney('readyToSpend')}
          </span>
        </div>

        {/* Wallets Grouped List */}
        <div
          className={`space-y-3.5 pt-3 ${
            shouldScroll
              ? 'max-h-[50vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
              : ''
          }`}
        >
          {/* Cash Group */}
          {cashWallets.length > 0 && (
            <div className="space-y-1">
              <span className="text-caption font-semibold text-ink-muted px-1">
                {t('cash')}
              </span>
              <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 p-0 gap-0 overflow-hidden">
                {cashWallets.map(renderWalletRow)}
              </Card>
            </div>
          )}

          {/* Banks Group */}
          {bankWallets.length > 0 && (
            <div className="space-y-1">
              <span className="text-caption font-semibold text-ink-muted px-1">
                {t('banks')}
              </span>
              <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 p-0 gap-0 overflow-hidden">
                {bankWallets.map(renderWalletRow)}
              </Card>
            </div>
          )}

          {/* Saving shortcut row */}
          <div className="space-y-1">
            <span className="text-caption font-semibold text-ink-muted px-1">
              {tMoney('saving')}
            </span>
            <Card className="rounded-card bg-surface shadow-card border border-line/60 p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  router.push('/money?tab=saving');
                }}
                className="flex h-14 w-full items-center justify-between gap-3 px-3.5 rounded-xl hover:bg-surface-2 active:bg-surface-2/80 transition-colors cursor-pointer text-start select-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-income-soft text-income">
                    <PiggyBank className="size-5" />
                  </div>
                  <span className="text-body font-semibold text-ink truncate">
                    {tMoney('saving')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ps-2">
                  <span className="text-body font-bold tabular-nums text-ink">
                    {savedTotals}
                  </span>
                  <ChevronRight className="size-4 text-ink-muted rtl:rotate-180 shrink-0" />
                </div>
              </button>
            </Card>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

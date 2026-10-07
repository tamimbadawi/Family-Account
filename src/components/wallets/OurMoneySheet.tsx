'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Banknote,
  Building2,
  ChevronRight,
  CreditCard,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useWalletBalances } from '@/lib/data/provider';
import type { WalletBalance, WalletType } from '@/lib/data/types';
import { money, pickName } from '@/lib/format';
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
  const router = useRouter();
  const allWallets = useWalletBalances();

  const activeWallets = React.useMemo(() => {
    return allWallets?.filter((w) => !w.isArchived) ?? [];
  }, [allWallets]);

  const totalBalance = React.useMemo(() => {
    return activeWallets.reduce((sum, w) => sum + w.balance, 0);
  }, [activeWallets]);

  const cashWallets = React.useMemo(() => {
    return activeWallets.filter((w) => w.type === 'cash');
  }, [activeWallets]);

  const bankWallets = React.useMemo(() => {
    return activeWallets.filter((w) => w.type !== 'cash');
  }, [activeWallets]);

  const handleWalletClick = (wallet: WalletBalance) => {
    onOpenChange(false);
    router.push(`/history?wallet=${wallet.id}`);
  };

  const renderWalletRow = (wallet: WalletBalance) => {
    const name =
      pickName({ name_ar: wallet.nameAr, name_en: wallet.nameEn }, locale) ||
      wallet.id;
    const Icon = getWalletTypeIcon(wallet.type);
    const color = wallet.color || 'var(--accent)';

    return (
      <button
        key={wallet.id}
        type="button"
        onClick={() => handleWalletClick(wallet)}
        className="flex h-14 w-full items-center justify-between gap-3 px-3.5 rounded-xl hover:bg-surface-2 active:bg-surface-2/80 transition-colors cursor-pointer text-start"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            style={{
              backgroundColor: `${color}18`,
              color,
            }}
            className="flex size-10 shrink-0 items-center justify-center rounded-full"
          >
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
            {money(wallet.balance, locale)}
          </span>
          <ChevronRight className="size-4 text-ink-muted rtl:rotate-180 shrink-0" />
        </div>
      </button>
    );
  };

  const shouldScroll = activeWallets.length > 6;

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
            {money(totalBalance, locale)}
          </div>
          <span className="text-caption text-ink-muted">{t('total')}</span>
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export interface OurMoneyRowProps {
  className?: string;
  onClick?: () => void;
}

export function OurMoneyRow({ className = '', onClick }: OurMoneyRowProps) {
  const locale = useLocale();
  const t = useTranslations('wallets');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const wallets = useWalletBalances();

  const total = React.useMemo(() => {
    if (!wallets) return 0;
    return wallets.filter((w) => !w.isArchived).reduce((sum, w) => sum + w.balance, 0);
  }, [wallets]);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setSheetOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`flex h-14 w-full items-center justify-between gap-3 px-4 rounded-card bg-surface shadow-card border border-line/60 hover:bg-surface-2 active:bg-surface-2/80 transition-colors cursor-pointer select-none text-start ${className}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <WalletIcon className="size-5" />
          </div>
          <span className="text-body font-semibold text-ink truncate">
            {t('ourMoney')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ps-2">
          <span className="text-body font-bold tabular-nums text-ink">
            {money(total, locale)}
          </span>
          <ChevronRight className="size-5 text-ink-muted rtl:rotate-180 shrink-0" />
        </div>
      </button>

      <OurMoneySheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}

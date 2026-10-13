'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PiggyBank, Wallet as WalletIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useInvestments, useWalletBalances } from '@/lib/data/provider';
import { totalsByCurrency } from '@/lib/money/groups';
import { money } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

export function MoneyTiles() {
  const locale = useLocale();
  const t = useTranslations('money');
  const balances = useWalletBalances();
  const investments = useInvestments(false);

  const spendingFormatted = React.useMemo(() => {
    if (!balances) return null;
    const spendingItems = balances
      .filter((w) => !w.isArchived && (w.purpose ?? 'spending') === 'spending')
      .map((w) => ({ currency: w.currency, amount: w.balance }));
    const totals = totalsByCurrency(spendingItems);
    if (totals.length === 0) return money(0, locale);
    return totals.map((t) => money(t.amount, locale, { currency: t.currency })).join(' + ');
  }, [balances, locale]);

  const savedFormatted = React.useMemo(() => {
    if (!balances || !investments) return null;
    const goalItems = balances
      .filter((w) => !w.isArchived && w.purpose === 'goal')
      .map((w) => ({ currency: w.currency, amount: w.balance }));
    const investmentItems = investments.map((inv) => ({
      currency: inv.currency,
      amount: inv.worth,
    }));
    const totals = totalsByCurrency([...goalItems, ...investmentItems]);
    if (totals.length === 0) return money(0, locale);
    return totals.map((t) => money(t.amount, locale, { currency: t.currency })).join(' + ');
  }, [balances, investments, locale]);

  if (spendingFormatted === null || savedFormatted === null) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-16 rounded-card" />
        <Skeleton className="h-16 rounded-card" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Link
        href="/money?tab=spending"
        data-tour="money-to-spend"
        className="flex h-16 min-w-0 items-center gap-1 sm:gap-2 rounded-card bg-surface px-1.5 sm:px-3 shadow-card transition-transform active:scale-[0.98] select-none"
      >
        <div className="flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink">
          <WalletIcon className="size-4 sm:size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-caption text-ink-muted truncate leading-tight">{t('toSpend')}</div>
          <div className="text-body font-bold tabular-nums tracking-tight text-ink truncate leading-tight">{spendingFormatted}</div>
        </div>
      </Link>

      <Link
        href="/money?tab=saving"
        data-tour="money-saved"
        className="flex h-16 min-w-0 items-center gap-1 sm:gap-2 rounded-card bg-surface px-1.5 sm:px-3 shadow-card transition-transform active:scale-[0.98] select-none"
      >
        <div className="flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-2xl bg-income-soft text-income">
          <PiggyBank className="size-4 sm:size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-caption text-ink-muted truncate leading-tight">{t('saved')}</div>
          <div className="text-body font-bold tabular-nums tracking-tight text-ink truncate leading-tight">{savedFormatted}</div>
        </div>
      </Link>
    </div>
  );
}

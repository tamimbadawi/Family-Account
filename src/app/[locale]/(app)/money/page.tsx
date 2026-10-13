'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import {
  useInvestments,
  useSavingsGoals,
  useWalletBalances,
  useWallets,
} from '@/lib/data/provider';
import { totalsByCurrency } from '@/lib/money/groups';
import { money, pickName } from '@/lib/format';
import { historyHref } from '@/lib/history/link';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { getWalletTypeIcon } from '@/components/wallets/OurMoneySheet';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function MoneyContent() {
  const locale = useLocale();
  const t = useTranslations('money');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAdd } = useEntrySheet();

  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'saving' ? 'saving' : 'spending';

  const balances = useWalletBalances();
  const wallets = useWallets();
  const goals = useSavingsGoals(false);
  const investments = useInvestments(false);

  const isLoading = balances === undefined || goals === undefined || investments === undefined;

  // Spending totals and groups
  const { spendingTotals, cashWallets, bankWallets } = React.useMemo(() => {
    if (!balances) return { spendingTotals: [], cashWallets: [], bankWallets: [] };
    const spending = balances.filter(
      (w) => !w.isArchived && (w.purpose ?? 'spending') === 'spending'
    );
    const totals = totalsByCurrency(
      spending.map((w) => ({ currency: w.currency, amount: w.balance }))
    );
    const cash = spending.filter((w) => w.type === 'cash');
    const banks = spending.filter((w) => w.type !== 'cash');
    return { spendingTotals: totals, cashWallets: cash, bankWallets: banks };
  }, [balances]);

  // Saving totals
  const { savedTotals, goalsFormatted, investmentsFormatted } = React.useMemo(() => {
    if (!balances || !investments) {
      return { savedTotals: [], goalsFormatted: '', investmentsFormatted: '' };
    }
    const goalWallets = balances.filter((w) => !w.isArchived && w.purpose === 'goal');
    const goalTotals = totalsByCurrency(
      goalWallets.map((w) => ({ currency: w.currency, amount: w.balance }))
    );
    const investmentTotals = totalsByCurrency(
      investments.map((i) => ({ currency: i.currency, amount: i.worth }))
    );
    const combinedTotals = totalsByCurrency([
      ...goalWallets.map((w) => ({ currency: w.currency, amount: w.balance })),
      ...investments.map((i) => ({ currency: i.currency, amount: i.worth })),
    ]);

    const gFormatted =
      goalTotals.length > 0
        ? goalTotals.map((t) => money(t.amount, locale, { currency: t.currency })).join(' + ')
        : money(0, locale);

    const iFormatted =
      investmentTotals.length > 0
        ? investmentTotals.map((t) => money(t.amount, locale, { currency: t.currency })).join(' + ')
        : money(0, locale);

    return {
      savedTotals: combinedTotals,
      goalsFormatted: gFormatted,
      investmentsFormatted: iFormatted,
    };
  }, [balances, investments, locale]);

  const renderWalletRow = (wallet: (typeof cashWallets)[number]) => {
    const name =
      pickName({ name_ar: wallet.nameAr, name_en: wallet.nameEn }, locale) || wallet.id;
    const Icon = getWalletTypeIcon(wallet.type);

    return (
      <button
        key={wallet.id}
        type="button"
        onClick={() => router.push(historyHref({ walletId: wallet.id }))}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl hover:bg-surface-2 active:bg-surface-2/80 transition-colors cursor-pointer text-start select-none"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink">
            <Icon className="size-5" />
          </div>
          <span className="text-body font-semibold text-ink truncate">{name}</span>
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

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 shrink-0 flex items-center justify-between border-b border-line/30">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2 cursor-pointer"
            aria-label={t('back')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </Link>
          <h1 className="text-title font-bold text-ink leading-tight">{t('title')}</h1>
        </div>
      </div>

      {/* 2-part Segmented Control */}
      <div className="px-5 pt-3 pb-2 shrink-0">
        <div
          role="tablist"
          data-tour="money-tabs"
          className="inline-flex h-14 w-full items-center rounded-2xl bg-surface-2 p-1 select-none"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'spending'}
            onClick={() => router.replace('/money?tab=spending')}
            className={`flex h-12 flex-1 items-center justify-center rounded-xl text-body font-semibold transition-all ${
              activeTab === 'spending'
                ? 'bg-surface shadow-card text-ink'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('spending')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'saving'}
            onClick={() => router.replace('/money?tab=saving')}
            className={`flex h-12 flex-1 items-center justify-center rounded-xl text-body font-semibold transition-all ${
              activeTab === 'saving'
                ? 'bg-surface shadow-card text-ink'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('saving')}
          </button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <div className="space-y-2 text-center py-2">
              <Skeleton className="h-10 w-44 mx-auto" />
              <Skeleton className="h-4 w-28 mx-auto" />
            </div>
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
          </div>
        ) : activeTab === 'spending' ? (
          <>
            {/* Centre block */}
            <div className="text-center py-2">
              <div className="text-hero font-bold tabular-nums text-ink leading-tight">
                {spendingTotals.length > 0
                  ? money(spendingTotals[0].amount, locale, { currency: spendingTotals[0].currency })
                  : money(0, locale)}
              </div>
              {spendingTotals.length > 1 && (
                <div className="text-heading font-bold tabular-nums text-ink leading-tight mt-1">
                  {spendingTotals
                    .slice(1)
                    .map((t) => money(t.amount, locale, { currency: t.currency }))
                    .join(' + ')}
                </div>
              )}
              <span className="text-caption text-ink-muted mt-1 block">
                {t('readyToSpend')}
              </span>
            </div>

            {/* Cash Group */}
            {cashWallets.length > 0 && (
              <div className="space-y-1">
                <span className="text-caption font-semibold text-ink-muted px-1">
                  {t('cash')}
                </span>
                <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 p-0 overflow-hidden">
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
                <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 p-0 overflow-hidden">
                  {bankWallets.map(renderWalletRow)}
                </Card>
              </div>
            )}

            {/* Move to saving button */}
            <div className="pt-2">
              <Button
                variant="secondary"
                onClick={() => openAdd('transfer')}
                className="w-full h-12 text-body font-semibold"
              >
                {t('moveToSaving')}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Centre block */}
            <div className="text-center py-2">
              <div className="text-hero font-bold tabular-nums text-ink leading-tight">
                {savedTotals.length > 0
                  ? savedTotals
                      .map((t) => money(t.amount, locale, { currency: t.currency }))
                      .join(' + ')
                  : money(0, locale)}
              </div>
              <span className="text-caption text-ink-muted mt-1 block">
                {t('savedSplit', {
                  goals: goalsFormatted,
                  investments: investmentsFormatted,
                })}
              </span>
            </div>

            {/* Goals section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-body font-semibold text-ink">{t('goals')}</h2>
                <Link
                  href="/money/goals?new=1"
                  className="text-caption font-semibold text-accent hover:underline"
                >
                  + {t('newGoal')}
                </Link>
              </div>

              {!goals || goals.length === 0 ? (
                <div className="rounded-card bg-surface p-4 shadow-card text-center space-y-2 border border-line/60">
                  <p className="text-body text-ink-muted">{t('noGoals')}</p>
                  <Link
                    href="/money/goals?new=1"
                    className="inline-flex items-center gap-1 text-body font-semibold text-accent hover:underline"
                  >
                    + {t('newGoal')}
                  </Link>
                </div>
              ) : (
                <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 p-0 overflow-hidden">
                  {goals.map((goal) => {
                    const wallet = wallets?.find((w) => w.id === goal.walletId);
                    const isKeptInSpending = (wallet?.purpose ?? 'spending') === 'spending';
                    const walletName = wallet
                      ? pickName({ name_ar: wallet.nameAr, name_en: wallet.nameEn }, locale) ||
                        wallet.id
                      : '';
                    const goalCurrency = wallet?.currency ?? 'EGP';

                    return (
                      <Link
                        key={goal.id}
                        href="/money/goals"
                        className="flex min-h-16 w-full items-center gap-3 px-3.5 py-3 hover:bg-surface-2 active:bg-surface-2/80 transition-colors select-none text-start"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-income-soft text-income">
                          <CategoryIcon name={goal.icon ?? 'sparkles'} className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-body font-semibold text-ink truncate leading-tight">
                            {pickName({ name_ar: goal.nameAr, name_en: goal.nameEn }, locale)}
                          </div>
                          <div className="text-caption text-ink-muted tabular-nums truncate leading-tight">
                            {isKeptInSpending
                              ? t('keptInSpending', { wallet: walletName })
                              : t('goalProgress', {
                                  saved: money(goal.currentAmount, locale, {
                                    currency: goalCurrency,
                                  }),
                                  target: money(goal.targetAmount, locale, {
                                    currency: goalCurrency,
                                  }),
                                })}
                          </div>
                          <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-income rounded-full"
                              style={{ width: `${goal.barPercent}%` }}
                            />
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-ink-muted rtl:rotate-180 shrink-0" />
                      </Link>
                    );
                  })}
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MoneyPage() {
  return (
    <React.Suspense fallback={null}>
      <MoneyContent />
    </React.Suspense>
  );
}

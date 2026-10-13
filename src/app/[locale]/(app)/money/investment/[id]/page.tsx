'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, Minus, Plus, RefreshCw } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import {
  useEntries,
  useInvestments,
  useInvestmentValues,
  useRepository,
  useWalletBalances,
} from '@/lib/data/provider';
import { useSaveError } from '@/components/ui/use-save-error';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { AmountDisplay } from '@/components/entry/AmountDisplay';
import { AmountPad } from '@/components/entry/AmountPad';
import { CategoryIcon } from '@/components/ui/category-icon';
import { formatDmy } from '@/components/entry/DetailsRow';
import { formatGoalTargetDate } from '@/lib/goals/progress';
import { localISODate, money, normalizeDigits, pickName } from '@/lib/format';
import { toast } from 'sonner';
import { INVESTMENT_KIND_MAP } from '@/components/money/investment-kind';
import type { EnrichedEntry } from '@/lib/data/types';

interface InvestmentDetailPageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

export default function InvestmentDetailPage({ params }: InvestmentDetailPageProps) {
  const { id } = React.use(params);
  const locale = useLocale();
  const t = useTranslations('money');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const repo = useRepository();
  const saveError = useSaveError();
  const { openEdit } = useEntrySheet();

  const investments = useInvestments(false);
  const investment = investments?.find((i) => i.id === id);

  const values = useInvestmentValues(id) ?? [];
  const entries = useEntries({ accountId: id }) ?? [];
  const allWallets = useWalletBalances() ?? [];

  // Redirect if unknown id
  React.useEffect(() => {
    if (investments !== undefined && !investment) {
      router.replace('/money?tab=saving');
    }
  }, [investments, investment, router]);

  // Funding drawer state (Add money / Take out)
  const [fundingMode, setFundingMode] = React.useState<'add' | 'take' | null>(null);
  const [fundingWalletId, setFundingWalletId] = React.useState<string>('');
  const [fundingAmountStr, setFundingAmountStr] = React.useState<string>('');
  const [isFundingSubmitting, setIsFundingSubmitting] = React.useState(false);

  // Update value drawer state
  const [isUpdateValueOpen, setIsUpdateValueOpen] = React.useState(false);
  const [updateValueStr, setUpdateValueStr] = React.useState('');
  const [isUpdateSubmitting, setIsUpdateSubmitting] = React.useState(false);

  // Spending wallets in same currency
  const availableSpendingWallets = React.useMemo(() => {
    if (!investment) return [];
    return allWallets.filter(
      (w) => !w.isArchived && (w.purpose ?? 'spending') === 'spending' && w.currency === investment.currency
    );
  }, [allWallets, investment]);

  // Auto-pick first spending wallet
  React.useEffect(() => {
    if (fundingMode && !fundingWalletId && availableSpendingWallets.length > 0) {
      setFundingWalletId(availableSpendingWallets[0].id);
    }
  }, [fundingMode, fundingWalletId, availableSpendingWallets]);

  if (!investment) {
    return null;
  }

  const invName =
    pickName({ name_ar: investment.nameAr, name_en: investment.nameEn }, locale) || investment.id;
  const currency = investment.currency;
  const formattedMatures = formatGoalTargetDate(investment.maturesOn, locale);

  const parsedFundAmount = Number(normalizeDigits(fundingAmountStr).replace(/[,\s٬]/g, '')) || 0;
  const isTake = fundingMode === 'take';
  const overWorth = isTake && parsedFundAmount > investment.worth;

  const handleFund = async () => {
    if (!fundingWalletId || parsedFundAmount <= 0 || overWorth || isFundingSubmitting) return;

    try {
      setIsFundingSubmitting(true);
      const isAdd = fundingMode === 'add';

      const entry = await repo.addEntry({
        type: 'transfer',
        amount: parsedFundAmount,
        occurredOn: localISODate(),
        accountId: isAdd ? fundingWalletId : id,
        toAccountId: isAdd ? id : fundingWalletId,
      });

      setFundingMode(null);
      setFundingAmountStr('');

      const msg = isAdd ? t('addedTo', { name: invName }) : t('takenFrom', { name: invName });
      toast.success(msg, {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              await repo.softDeleteEntry(entry.id);
            } catch (err) {
              saveError(err);
            }
          },
        },
        duration: 6000,
      });
    } catch (err) {
      saveError(err);
    } finally {
      setIsFundingSubmitting(false);
    }
  };

  const parsedUpdateValue = updateValueStr.trim() === ''
    ? null
    : Number(normalizeDigits(updateValueStr).replace(/[,\s٬]/g, ''));

  const handleUpdateValue = async () => {
    if (parsedUpdateValue === null || isNaN(parsedUpdateValue) || isUpdateSubmitting) return;

    try {
      setIsUpdateSubmitting(true);
      const res = await repo.addInvestmentValue({
        accountId: id,
        value: parsedUpdateValue,
      });

      setIsUpdateValueOpen(false);
      setUpdateValueStr('');

      toast.success(t('valueUpdated'), {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              await repo.softDeleteInvestmentValue(res.id);
            } catch (err) {
              saveError(err);
            }
          },
        },
        duration: 6000,
      });
    } catch (err) {
      saveError(err);
    } finally {
      setIsUpdateSubmitting(false);
    }
  };

  const handleHide = async () => {
    try {
      await repo.archiveWallet(id, true);
      toast.success(t('hidden'), {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              await repo.archiveWallet(id, false);
            } catch (err) {
              saveError(err);
            }
          },
        },
        duration: 6000,
      });
      router.replace('/money?tab=saving');
    } catch (err) {
      saveError(err);
    }
  };

  // Merge history events: value updates, transfers in, transfers out
  interface HistoryItem {
    id: string;
    type: 'value' | 'transfer_in' | 'transfer_out';
    date: string;
    time: string;
    amount: number;
    title: string;
    entry?: EnrichedEntry;
  }

  const historyItems: HistoryItem[] = [
    ...values.map((v) => ({
      id: v.id,
      type: 'value' as const,
      date: v.valuedOn ? v.valuedOn.slice(0, 10) : v.createdAt.slice(0, 10),
      time: v.createdAt,
      amount: v.value,
      title: t('valueUpdated'),
    })),
    ...entries
      .filter((e) => e.type === 'transfer')
      .map((e) => {
        const isIn = e.toAccountId === id;
        const otherWalletName = isIn
          ? pickName({ name_ar: e.accountNameAr, name_en: e.accountNameEn }, locale) || ''
          : pickName({ name_ar: e.toAccountNameAr, name_en: e.toAccountNameEn }, locale) || '';
        return {
          id: e.id,
          type: isIn ? ('transfer_in' as const) : ('transfer_out' as const),
          date: e.occurredOn,
          time: e.createdAt,
          amount: isIn ? (e.toAmount ?? e.amount) : e.amount,
          title: t(isIn ? 'addedFrom' : 'takenTo', { wallet: otherWalletName }),
          entry: e,
        };
      }),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  return (
    <div className="flex flex-col h-full bg-canvas text-ink">
      {/* Top Header */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-line/40 shrink-0">
        <Link
          href="/money?tab=saving"
          className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2 active:bg-surface-2/80 transition-colors"
          aria-label={t('back')}
        >
          <ChevronLeft className="size-6 text-ink rtl:rotate-180" />
        </Link>
        <h1 className="text-body font-semibold text-ink truncate px-2 text-center flex-1">
          {invName}
        </h1>
        <div className="size-11" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-8 pt-4 space-y-4">
        {/* 1. Centred Worth Card */}
        <Card className="rounded-card bg-surface p-5 shadow-card border border-line/60 text-center space-y-1">
          <span className="text-caption text-ink-muted block">{t('worthNow')}</span>
          <div className="text-hero font-bold tabular-nums text-ink leading-tight">
            {money(investment.worth, locale, { currency })}
          </div>
          <div className="text-caption text-ink-muted">
            {investment.lastValuedOn
              ? t('checkedOn', { date: formatDmy(investment.lastValuedOn) })
              : t('notCheckedYet')}
            {investment.investmentKind === 'certificate' && formattedMatures && (
              <> · {t('endsOnLine', { date: formattedMatures })}</>
            )}
          </div>
        </Card>

        {/* 2. Two Small Cards Side by Side */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-card bg-surface p-4 shadow-card border border-line/60 space-y-1 text-start">
            <span className="text-caption text-ink-muted block leading-tight">{t('youPutIn')}</span>
            <span className="text-body font-bold tabular-nums text-ink block leading-tight">
              {money(Math.max(investment.putIn, 0), locale, { currency })}
            </span>
          </Card>
          <Card className="rounded-card bg-surface p-4 shadow-card border border-line/60 space-y-1 text-start">
            {investment.gain >= 0 ? (
              <>
                <span className="text-caption text-ink-muted block leading-tight">{t('grewBy')}</span>
                <span
                  className={`text-body font-bold tabular-nums block leading-tight ${
                    investment.gain > 0 ? 'text-income' : 'text-ink-muted'
                  }`}
                >
                  {money(investment.gain, locale, { currency })}
                </span>
              </>
            ) : (
              <>
                <span className="text-caption text-ink-muted block leading-tight">{t('wentDownBy')}</span>
                <span className="text-body font-bold tabular-nums text-expense block leading-tight">
                  {money(Math.abs(investment.gain), locale, { currency })}
                </span>
              </>
            )}
          </Card>
        </div>

        {/* 3. Three Equal Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setFundingMode('add');
              setFundingAmountStr('');
            }}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-surface-2 text-ink hover:bg-line/40 transition-transform active:scale-95 cursor-pointer text-center"
          >
            <Plus className="size-5 shrink-0" />
            <span className="text-caption font-semibold leading-tight line-clamp-1">
              {t('addMoney')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFundingMode('take');
              setFundingAmountStr('');
            }}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-surface-2 text-ink hover:bg-line/40 transition-transform active:scale-95 cursor-pointer text-center"
          >
            <Minus className="size-5 shrink-0" />
            <span className="text-caption font-semibold leading-tight line-clamp-1">
              {t('takeOut')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsUpdateValueOpen(true);
              setUpdateValueStr('');
            }}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-surface-2 text-ink hover:bg-line/40 transition-transform active:scale-95 cursor-pointer text-center"
          >
            <RefreshCw className="size-5 shrink-0" />
            <span className="text-caption font-semibold leading-tight line-clamp-1">
              {t('updateValue')}
            </span>
          </button>
        </div>

        {/* 4. What Happened History List */}
        <div className="space-y-2 pt-2">
          <h2 className="text-body font-semibold text-ink">{t('whatHappened')}</h2>

          <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 p-0 overflow-hidden">
            {historyItems.map((item) => {
              const isTransfer = item.type === 'transfer_in' || item.type === 'transfer_out';
              const Icon =
                item.type === 'value'
                  ? RefreshCw
                  : item.type === 'transfer_in'
                    ? Plus
                    : Minus;

              if (isTransfer && item.entry) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openEdit(item.entry!)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-start hover:bg-surface-2 active:bg-surface-2/80 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-body font-semibold text-ink leading-tight truncate">
                          {item.title}
                        </div>
                        <div className="text-caption text-ink-muted leading-tight">
                          {formatDmy(item.date)}
                        </div>
                      </div>
                    </div>
                    <span className="text-body font-bold tabular-nums text-ink shrink-0 ps-2">
                      {money(item.amount, locale, { currency })}
                    </span>
                  </button>
                );
              }

              return (
                <div
                  key={item.id}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-3.5 py-2.5 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-semibold text-ink leading-tight truncate">
                        {item.title}
                      </div>
                      <div className="text-caption text-ink-muted leading-tight">
                        {formatDmy(item.date)}
                      </div>
                    </div>
                  </div>
                  <span className="text-body font-bold tabular-nums text-ink shrink-0 ps-2">
                    {money(item.amount, locale, { currency })}
                  </span>
                </div>
              );
            })}

            {/* Opening Balance (startedWith) */}
            {investment.openingBalance > 0 && (
              <div className="flex min-h-14 w-full items-center justify-between gap-3 px-3.5 py-2.5 select-none">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
                    <CategoryIcon name="wallet" className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-semibold text-ink leading-tight truncate">
                      {t('startedWith')}
                    </div>
                  </div>
                </div>
                <span className="text-body font-bold tabular-nums text-ink shrink-0 ps-2">
                  {money(investment.openingBalance, locale, { currency })}
                </span>
              </div>
            )}
          </Card>
        </div>

        {/* 5. Hide Button at Bottom */}
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={handleHide}
            className="text-body font-semibold text-ink-muted hover:text-ink active:scale-95 transition-all cursor-pointer p-2"
          >
            {t('hide')}
          </button>
        </div>
      </div>

      {/* Funding Drawer (Add money / Take out) */}
      <Drawer
        open={fundingMode !== null}
        onOpenChange={(open) => !open && setFundingMode(null)}
      >
        <DrawerContent className="max-h-[92dvh]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] space-y-4">
            <DrawerHeader className="px-0 pt-4 pb-1">
              <DrawerTitle className="text-title font-bold text-ink text-start">
                {fundingMode === 'add' ? t('addMoney') : t('takeOut')}
              </DrawerTitle>
            </DrawerHeader>

            {/* Wallet chooser */}
            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-ink-muted">
                {t(fundingMode === 'add' ? 'takeFrom' : 'moveTo')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {availableSpendingWallets.map((w) => {
                  const isSelected = fundingWalletId === w.id;
                  const walletName = pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setFundingWalletId(w.id)}
                      className={`flex min-h-14 items-center gap-2 rounded-2xl px-3 py-2 text-start transition-transform active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-accent text-accent-ink'
                          : 'bg-surface-2 text-ink'
                      }`}
                    >
                      <CategoryIcon name={w.icon ?? 'wallet'} className="size-5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-semibold leading-tight break-words">
                          {walletName}
                        </span>
                        <span
                          className={`block text-caption tabular-nums leading-tight ${
                            isSelected ? '' : 'text-ink-muted'
                          }`}
                        >
                          {money(w.balance, locale, { currency: w.currency })}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount display & pad */}
            <div className="space-y-1.5">
              <AmountDisplay
                value={fundingAmountStr}
                type="transfer"
                currency={currency}
              />
              {overWorth && (
                <p className="text-caption text-expense font-semibold text-center">
                  {t('onlyHas', { amount: money(investment.worth, locale, { currency }) })}
                </p>
              )}
              <AmountPad value={fundingAmountStr} onChange={setFundingAmountStr} />
            </div>

            <Button
              type="button"
              onClick={handleFund}
              disabled={isFundingSubmitting || !fundingWalletId || parsedFundAmount <= 0 || overWorth}
              className="h-14 w-full rounded-2xl bg-accent text-body font-semibold text-accent-ink transition-transform active:scale-98 cursor-pointer disabled:opacity-40"
            >
              {tCommon('save')}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Update Value Drawer */}
      <Drawer
        open={isUpdateValueOpen}
        onOpenChange={(open) => !open && setIsUpdateValueOpen(false)}
      >
        <DrawerContent className="max-h-[92dvh]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] space-y-4">
            <DrawerHeader className="px-0 pt-4 pb-1">
              <DrawerTitle className="text-title font-bold text-ink text-start">
                {t('worthQuestion', { name: invName })}
              </DrawerTitle>
            </DrawerHeader>

            <div className="space-y-1.5">
              <AmountDisplay
                value={updateValueStr}
                type="transfer"
                currency={currency}
              />
              <AmountPad value={updateValueStr} onChange={setUpdateValueStr} />
            </div>

            <Button
              type="button"
              onClick={handleUpdateValue}
              disabled={isUpdateSubmitting || parsedUpdateValue === null || isNaN(parsedUpdateValue)}
              className="h-14 w-full rounded-2xl bg-accent text-body font-semibold text-accent-ink transition-transform active:scale-98 cursor-pointer disabled:opacity-40"
            >
              {tCommon('save')}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

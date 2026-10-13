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
import { localISODate, money, normalizeDigits, pickName, quantity } from '@/lib/format';
import { toast } from 'sonner';
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
  const rawWallets = useWalletBalances();

  // Redirect if unknown id
  React.useEffect(() => {
    if (investments !== undefined && !investment) {
      router.replace('/money?tab=saving');
    }
  }, [investments, investment, router]);

  const isUnit = Boolean(investment?.unit);

  // Funding drawer state (Add money / Take out)
  const [fundingMode, setFundingMode] = React.useState<'add' | 'take' | null>(null);
  const [fundingWalletId, setFundingWalletId] = React.useState<string>('');
  const [fundingAmountStr, setFundingAmountStr] = React.useState<string>('');
  const [fundingQuantityStr, setFundingQuantityStr] = React.useState<string>('');
  const [fundingActiveBox, setFundingActiveBox] = React.useState<'quantity' | 'amount'>('quantity');
  const [isFundingSubmitting, setIsFundingSubmitting] = React.useState(false);

  // Update price / value drawer state
  const [isUpdateValueOpen, setIsUpdateValueOpen] = React.useState(false);
  const [updateValueStr, setUpdateValueStr] = React.useState('');
  const [isUpdateSubmitting, setIsUpdateSubmitting] = React.useState(false);
  const [editingValue, setEditingValue] = React.useState<{ id: string; value: number } | null>(null);

  // Edit transfer drawer state (for unit investments)
  const [editingTransfer, setEditingTransfer] = React.useState<EnrichedEntry | null>(null);
  const [editTransferAmountStr, setEditTransferAmountStr] = React.useState('');
  const [editTransferQuantityStr, setEditTransferQuantityStr] = React.useState('');
  const [editTransferActiveBox, setEditTransferActiveBox] = React.useState<'quantity' | 'amount'>('quantity');
  const [isEditTransferSubmitting, setIsEditTransferSubmitting] = React.useState(false);

  // Track by quantity drawer state (for gold/stocks with unit null)
  const [isTrackByQuantityOpen, setIsTrackByQuantityOpen] = React.useState(false);
  const [trackQuantityStr, setTrackQuantityStr] = React.useState('');
  const [trackKarat, setTrackKarat] = React.useState<18 | 21 | 24>(21);
  const [isTrackSubmitting, setIsTrackSubmitting] = React.useState(false);

  // Spending wallets in same currency
  const availableSpendingWallets = React.useMemo(() => {
    if (!investment || !rawWallets) return [];
    return rawWallets.filter(
      (w) => !w.isArchived && (w.purpose ?? 'spending') === 'spending' && w.currency === investment.currency
    );
  }, [rawWallets, investment]);

  const selectedFundingWalletId = fundingWalletId || availableSpendingWallets[0]?.id || '';

  // Other gold holdings that will be updated on price update
  const otherMatchingGolds = React.useMemo(() => {
    if (!investment || investment.unit !== 'gram' || !investments) return [];
    return investments.filter(
      (i) =>
        i.id !== investment.id &&
        !i.isArchived &&
        i.purpose === 'investment' &&
        i.investmentKind === 'gold' &&
        i.unit === 'gram' &&
        i.karat === investment.karat &&
        (i.currency ?? 'EGP') === (investment.currency ?? 'EGP')
    );
  }, [investment, investments]);

  if (!investment) {
    return null;
  }

  const invName =
    pickName({ name_ar: investment.nameAr, name_en: investment.nameEn }, locale) || investment.id;
  const currency = investment.currency;
  const formattedMatures = formatGoalTargetDate(investment.maturesOn, locale);

  const parsedFundAmount = Number(normalizeDigits(fundingAmountStr).replace(/[,\s٬]/g, '')) || 0;
  const parsedFundQuantity = Number(normalizeDigits(fundingQuantityStr).replace(/[,\s٬]/g, '')) || 0;
  const isTake = fundingMode === 'take';
  const overWorth = !isUnit && isTake && parsedFundAmount > investment.worth;
  const overQuantity = isUnit && isTake && parsedFundQuantity > (investment.quantity ?? 0);

  const isFundingValid =
    Boolean(selectedFundingWalletId) &&
    parsedFundAmount > 0 &&
    (!isUnit || parsedFundQuantity > 0) &&
    !overWorth &&
    !overQuantity;

  const handleFund = async () => {
    if (!isFundingValid || isFundingSubmitting) return;

    try {
      setIsFundingSubmitting(true);
      const isAdd = fundingMode === 'add';

      const entry = await repo.addEntry({
        type: 'transfer',
        amount: parsedFundAmount,
        quantity: isUnit ? parsedFundQuantity : undefined,
        occurredOn: localISODate(),
        accountId: isAdd ? selectedFundingWalletId : id,
        toAccountId: isAdd ? id : selectedFundingWalletId,
      });

      setFundingMode(null);
      setFundingAmountStr('');
      setFundingQuantityStr('');
      setFundingWalletId('');

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

  const parsedUpdateValue =
    updateValueStr.trim() === ''
      ? null
      : Number(normalizeDigits(updateValueStr).replace(/[,\s٬]/g, ''));

  const handleUpdateValue = async () => {
    if (parsedUpdateValue === null || isNaN(parsedUpdateValue) || isUpdateSubmitting) return;

    if (isUnit) {
      if (editingValue) {
        // Tapping price row -> updates single row
        const { id: valueId, value: before } = editingValue;
        try {
          setIsUpdateSubmitting(true);
          await repo.updateInvestmentPrice(valueId, parsedUpdateValue);

          setIsUpdateValueOpen(false);
          setUpdateValueStr('');
          setEditingValue(null);

          toast.success(t('priceUpdated'), {
            action: {
              label: tCommon('undo'),
              onClick: async () => {
                try {
                  await repo.updateInvestmentPrice(valueId, before);
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
        return;
      }

      // Add investment price (cascades to same-karat/same-currency gold)
      try {
        setIsUpdateSubmitting(true);
        const writtenRows = await repo.addInvestmentPrice({
          accountId: id,
          unitPrice: parsedUpdateValue,
        });

        setIsUpdateValueOpen(false);
        setUpdateValueStr('');

        toast.success(t('priceUpdated'), {
          action: {
            label: tCommon('undo'),
            onClick: async () => {
              try {
                for (const row of writtenRows) {
                  await repo.softDeleteInvestmentValue(row.id);
                }
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
      return;
    }

    // Non-unit investment value update
    if (editingValue) {
      const { id: valueId, value: before } = editingValue;
      try {
        setIsUpdateSubmitting(true);
        await repo.updateInvestmentValue(valueId, parsedUpdateValue);

        setIsUpdateValueOpen(false);
        setUpdateValueStr('');
        setEditingValue(null);

        toast.success(t('valueChanged'), {
          action: {
            label: tCommon('undo'),
            onClick: async () => {
              try {
                await repo.updateInvestmentValue(valueId, before);
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
      return;
    }

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

  const handleRemoveValue = async () => {
    if (!editingValue || isUpdateSubmitting) return;
    const valueId = editingValue.id;

    try {
      setIsUpdateSubmitting(true);
      await repo.softDeleteInvestmentValue(valueId);

      setIsUpdateValueOpen(false);
      setUpdateValueStr('');
      setEditingValue(null);

      toast.success(t('valueRemoved'), {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              await repo.restoreInvestmentValue(valueId);
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

  const handleSaveEditTransfer = async () => {
    if (!editingTransfer || isEditTransferSubmitting) return;
    const cleanAmount = Number(normalizeDigits(editTransferAmountStr).replace(/[,\s٬]/g, '')) || 0;
    const cleanQuantity = Number(normalizeDigits(editTransferQuantityStr).replace(/[,\s٬]/g, '')) || 0;
    if (cleanAmount <= 0 || cleanQuantity <= 0) return;

    const beforeAmount = editingTransfer.amount;
    const beforeQuantity = editingTransfer.quantity;
    const entryId = editingTransfer.id;

    try {
      setIsEditTransferSubmitting(true);
      await repo.updateEntry(entryId, {
        amount: cleanAmount,
        quantity: cleanQuantity,
      });

      setEditingTransfer(null);

      toast.success(t('transferUpdated'), {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              await repo.updateEntry(entryId, {
                amount: beforeAmount,
                quantity: beforeQuantity,
              });
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
      setIsEditTransferSubmitting(false);
    }
  };

  const handleRemoveEditTransfer = async () => {
    if (!editingTransfer || isEditTransferSubmitting) return;
    const entryId = editingTransfer.id;

    try {
      setIsEditTransferSubmitting(true);
      await repo.softDeleteEntry(entryId);

      setEditingTransfer(null);

      toast.success(t('transferRemoved'), {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              await repo.restoreEntry(entryId);
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
      setIsEditTransferSubmitting(false);
    }
  };

  const handleTrackByQuantity = async () => {
    const cleanQty = Number(normalizeDigits(trackQuantityStr).replace(/[,\s٬]/g, '')) || 0;
    if (cleanQty <= 0 || isTrackSubmitting) return;

    try {
      setIsTrackSubmitting(true);
      const res = await repo.trackByQuantity(id, {
        quantity: cleanQty,
        karat: investment.investmentKind === 'gold' ? trackKarat : undefined,
      });

      setIsTrackByQuantityOpen(false);
      setTrackQuantityStr('');

      toast.success(t('valueChanged'), {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              await repo.updateWallet(id, {
                unit: null,
                karat: null,
                openingQuantity: null,
              });
              await repo.softDeleteInvestmentValue(res.value.id);
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
      setIsTrackSubmitting(false);
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
    unitPrice?: number | null;
    quantity?: number | null;
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
      unitPrice: v.unitPrice,
      title: isUnit ? t('priceUpdated') : t('valueUpdated'),
    })),
    ...entries
      .filter((e) => e.type === 'transfer')
      .map((e) => {
        const isIn = e.toAccountId === id;
        const otherWalletName = isIn
          ? pickName({ name_ar: e.accountNameAr, name_en: e.accountNameEn }, locale) || ''
          : pickName({ name_ar: e.toAccountNameAr, name_en: e.toAccountNameEn }, locale) || '';
        const baseTitle = t(isIn ? 'addedFrom' : 'takenTo', { wallet: otherWalletName });
        let title = baseTitle;
        if (isUnit && e.quantity != null) {
          const qtyFormatted = quantity(e.quantity, locale);
          const qtyStr =
            investment.unit === 'gram'
              ? t('gramsShort', { n: qtyFormatted })
              : t('sharesCount', { n: qtyFormatted });
          title = `${baseTitle} · ${qtyStr}`;
        }
        return {
          id: e.id,
          type: isIn ? ('transfer_in' as const) : ('transfer_out' as const),
          date: e.occurredOn,
          time: e.createdAt,
          amount: isIn ? (e.toAmount ?? e.amount) : e.amount,
          quantity: e.quantity,
          title,
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

          {/* Unit investment stats: "20 g · 21k · 4,800 per gram" */}
          {isUnit && (
            <div className="text-body font-semibold text-ink-muted tabular-nums">
              {investment.unit === 'gram' ? (
                <>
                  {t('gramsShort', { n: quantity(investment.quantity ?? 0, locale) })}
                  {investment.karat ? <> · {t('karatShort', { k: investment.karat })}</> : null}
                  {investment.unitPrice != null ? (
                    <> · {t('perGram', { amount: money(investment.unitPrice, locale, { currency }) })}</>
                  ) : null}
                </>
              ) : (
                <>
                  {t('sharesCount', { n: quantity(investment.quantity ?? 0, locale) })}
                  {investment.unitPrice != null ? (
                    <> · {t('perShare', { amount: money(investment.unitPrice, locale, { currency }) })}</>
                  ) : null}
                </>
              )}
            </div>
          )}

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
              setFundingQuantityStr('');
              setFundingActiveBox('quantity');
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
              setFundingQuantityStr('');
              setFundingActiveBox('quantity');
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
              setEditingValue(null);
              setIsUpdateValueOpen(true);
              setUpdateValueStr('');
            }}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-surface-2 text-ink hover:bg-line/40 transition-transform active:scale-95 cursor-pointer text-center"
          >
            <RefreshCw className="size-5 shrink-0" />
            <span className="text-caption font-semibold leading-tight line-clamp-1">
              {isUnit ? t('updatePrice') : t('updateValue')}
            </span>
          </button>
        </div>

        {/* Gold or stocks with unit null: quiet text button "Track by weight" / "Track by number of shares" */}
        {!isUnit && (investment.investmentKind === 'gold' || investment.investmentKind === 'stocks') && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => {
                setTrackQuantityStr('');
                setTrackKarat(21);
                setIsTrackByQuantityOpen(true);
              }}
              className="min-h-12 py-2 text-body font-semibold text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer"
            >
              {investment.investmentKind === 'gold' ? t('trackByWeight') : t('trackByShares')}
            </button>
          </div>
        )}

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
                    onClick={() => {
                      if (isUnit) {
                        setEditingTransfer(item.entry!);
                        setEditTransferQuantityStr(String(item.entry!.quantity ?? ''));
                        setEditTransferAmountStr(String(item.entry!.amount));
                        setEditTransferActiveBox('quantity');
                      } else {
                        openEdit(item.entry!);
                      }
                    }}
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

              // Value row
              const subtitlePerUnit =
                isUnit && item.unitPrice != null
                  ? investment.unit === 'gram'
                    ? t('perGram', { amount: money(item.unitPrice, locale, { currency }) })
                    : t('perShare', { amount: money(item.unitPrice, locale, { currency }) })
                  : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const priceOrVal = isUnit && item.unitPrice != null ? item.unitPrice : item.amount;
                    setEditingValue({ id: item.id, value: priceOrVal });
                    setUpdateValueStr(String(priceOrVal));
                    setIsUpdateValueOpen(true);
                  }}
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
                        {subtitlePerUnit ? <> · {subtitlePerUnit}</> : null}
                      </div>
                    </div>
                  </div>
                  <span className="text-body font-bold tabular-nums text-ink shrink-0 ps-2">
                    {money(item.amount, locale, { currency })}
                  </span>
                </button>
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
                  const isSelected = selectedFundingWalletId === w.id;
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

            {/* Inputs & AmountPad */}
            {isUnit ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Box 1: Quantity */}
                  <button
                    type="button"
                    onClick={() => setFundingActiveBox('quantity')}
                    className={`flex min-h-16 flex-col items-start justify-center rounded-2xl p-3 text-start transition-transform active:scale-98 cursor-pointer ${
                      fundingActiveBox === 'quantity'
                        ? 'bg-surface-2 ring-2 ring-accent'
                        : 'bg-surface-2/60 opacity-80'
                    }`}
                  >
                    <span className="text-caption font-semibold text-ink-muted leading-tight">
                      {fundingMode === 'add'
                        ? investment.unit === 'gram'
                          ? t('gramsBought')
                          : t('sharesBought')
                        : investment.unit === 'gram'
                          ? t('gramsSold')
                          : t('sharesSold')}
                    </span>
                    <span className="text-title font-bold tabular-nums text-ink">
                      {fundingQuantityStr ? (
                        <>
                          {fundingQuantityStr}
                          <span className="text-caption font-normal text-ink-muted ms-1">
                            {investment.unit === 'gram'
                              ? t('gramsShort', { n: '' }).trim()
                              : t('sharesCount', { n: '' }).trim()}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-muted font-normal">0</span>
                      )}
                    </span>
                  </button>

                  {/* Box 2: Amount */}
                  <button
                    type="button"
                    onClick={() => setFundingActiveBox('amount')}
                    className={`flex min-h-16 flex-col items-start justify-center rounded-2xl p-3 text-start transition-transform active:scale-98 cursor-pointer ${
                      fundingActiveBox === 'amount'
                        ? 'bg-surface-2 ring-2 ring-accent'
                        : 'bg-surface-2/60 opacity-80'
                    }`}
                  >
                    <span className="text-caption font-semibold text-ink-muted leading-tight">
                      {fundingMode === 'add' ? t('whatDidYouPay') : t('moneyReceived')}
                    </span>
                    <span className="text-title font-bold tabular-nums text-ink">
                      {fundingAmountStr ? (
                        <>
                          {fundingAmountStr}
                          <span className="text-caption font-normal text-ink-muted ms-1">
                            {currency}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-muted font-normal">0</span>
                      )}
                    </span>
                  </button>
                </div>

                {overQuantity && (
                  <p className="text-caption text-expense font-semibold text-center">
                    {investment.unit === 'gram'
                      ? t('onlyHaveGrams', { n: quantity(investment.quantity ?? 0, locale) })
                      : t('onlyHaveShares', { n: quantity(investment.quantity ?? 0, locale) })}
                  </p>
                )}

                <AmountPad
                  value={fundingActiveBox === 'quantity' ? fundingQuantityStr : fundingAmountStr}
                  onChange={(val) => {
                    if (fundingActiveBox === 'quantity') {
                      setFundingQuantityStr(val);
                    } else {
                      setFundingAmountStr(val);
                    }
                  }}
                />
              </div>
            ) : (
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
            )}

            <Button
              type="button"
              onClick={handleFund}
              disabled={isFundingSubmitting || !isFundingValid}
              className="h-14 w-full rounded-2xl bg-accent text-body font-semibold text-accent-ink transition-transform active:scale-98 cursor-pointer disabled:opacity-40"
            >
              {tCommon('save')}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Update Price / Value Drawer */}
      <Drawer
        open={isUpdateValueOpen}
        onOpenChange={(open) => !open && setIsUpdateValueOpen(false)}
      >
        <DrawerContent className="max-h-[92dvh]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] space-y-4">
            <DrawerHeader className="px-0 pt-4 pb-1">
              <DrawerTitle className="text-title font-bold text-ink text-start">
                {isUnit
                  ? editingValue
                    ? t('editValue')
                    : investment.unit === 'gram'
                      ? t('gramPriceQuestion', { k: investment.karat ?? 21 })
                      : t('sharePriceQuestion')
                  : editingValue
                    ? t('editValue')
                    : t('worthQuestion', { name: invName })}
              </DrawerTitle>
            </DrawerHeader>

            {/* If other gold of same karat and currency exists: show caption */}
            {isUnit && !editingValue && otherMatchingGolds.length > 0 && (
              <p className="text-caption text-ink-muted">
                {t('alsoUpdates', {
                  names: otherMatchingGolds
                    .map((i) => pickName({ name_ar: i.nameAr, name_en: i.nameEn }, locale))
                    .join(', '),
                })}
              </p>
            )}

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

            {editingValue && (
              <button
                type="button"
                onClick={handleRemoveValue}
                disabled={isUpdateSubmitting}
                className="min-h-12 w-full text-body font-semibold text-expense active:scale-95 transition-all cursor-pointer disabled:opacity-40"
              >
                {t('removeValue')}
              </button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Edit Transfer Drawer (Unit Investments) */}
      <Drawer
        open={editingTransfer !== null}
        onOpenChange={(open) => !open && setEditingTransfer(null)}
      >
        <DrawerContent className="max-h-[92dvh]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] space-y-4">
            <DrawerHeader className="px-0 pt-4 pb-1">
              <DrawerTitle className="text-title font-bold text-ink text-start">
                {t('changeTransfer')}
              </DrawerTitle>
            </DrawerHeader>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Box 1: Quantity */}
                <button
                  type="button"
                  onClick={() => setEditTransferActiveBox('quantity')}
                  className={`flex min-h-16 flex-col items-start justify-center rounded-2xl p-3 text-start transition-transform active:scale-98 cursor-pointer ${
                    editTransferActiveBox === 'quantity'
                      ? 'bg-surface-2 ring-2 ring-accent'
                      : 'bg-surface-2/60 opacity-80'
                  }`}
                >
                  <span className="text-caption font-semibold text-ink-muted leading-tight">
                    {investment.unit === 'gram' ? t('howManyGrams') : t('howManyShares')}
                  </span>
                  <span className="text-title font-bold tabular-nums text-ink">
                    {editTransferQuantityStr ? (
                      <>
                        {editTransferQuantityStr}
                        <span className="text-caption font-normal text-ink-muted ms-1">
                          {investment.unit === 'gram'
                            ? t('gramsShort', { n: '' }).trim()
                            : t('sharesCount', { n: '' }).trim()}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-muted font-normal">0</span>
                    )}
                  </span>
                </button>

                {/* Box 2: Amount */}
                <button
                  type="button"
                  onClick={() => setEditTransferActiveBox('amount')}
                  className={`flex min-h-16 flex-col items-start justify-center rounded-2xl p-3 text-start transition-transform active:scale-98 cursor-pointer ${
                    editTransferActiveBox === 'amount'
                      ? 'bg-surface-2 ring-2 ring-accent'
                      : 'bg-surface-2/60 opacity-80'
                  }`}
                >
                  <span className="text-caption font-semibold text-ink-muted leading-tight">
                    {t('whatDidYouPay')}
                  </span>
                  <span className="text-title font-bold tabular-nums text-ink">
                    {editTransferAmountStr ? (
                      <>
                        {editTransferAmountStr}
                        <span className="text-caption font-normal text-ink-muted ms-1">
                          {currency}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-muted font-normal">0</span>
                    )}
                  </span>
                </button>
              </div>

              <AmountPad
                value={editTransferActiveBox === 'quantity' ? editTransferQuantityStr : editTransferAmountStr}
                onChange={(val) => {
                  if (editTransferActiveBox === 'quantity') {
                    setEditTransferQuantityStr(val);
                  } else {
                    setEditTransferAmountStr(val);
                  }
                }}
              />
            </div>

            <Button
              type="button"
              onClick={handleSaveEditTransfer}
              disabled={
                isEditTransferSubmitting ||
                !editTransferAmountStr ||
                !editTransferQuantityStr ||
                Number(editTransferAmountStr) <= 0 ||
                Number(editTransferQuantityStr) <= 0
              }
              className="h-14 w-full rounded-2xl bg-accent text-body font-semibold text-accent-ink transition-transform active:scale-98 cursor-pointer disabled:opacity-40"
            >
              {tCommon('save')}
            </Button>

            <button
              type="button"
              onClick={handleRemoveEditTransfer}
              disabled={isEditTransferSubmitting}
              className="min-h-12 w-full text-body font-semibold text-expense active:scale-95 transition-all cursor-pointer disabled:opacity-40"
            >
              {t('removeTransfer')}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Track by Quantity Drawer (for gold/stocks with unit null) */}
      <Drawer
        open={isTrackByQuantityOpen}
        onOpenChange={(open) => !open && setIsTrackByQuantityOpen(false)}
      >
        <DrawerContent className="max-h-[92dvh]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] space-y-4">
            <DrawerHeader className="px-0 pt-4 pb-1">
              <DrawerTitle className="text-title font-bold text-ink text-start">
                {investment.investmentKind === 'gold' ? t('trackByWeight') : t('trackByShares')}
              </DrawerTitle>
            </DrawerHeader>

            {investment.investmentKind === 'gold' && (
              <div className="space-y-1.5">
                <label className="text-caption font-semibold text-ink-muted">
                  {t('karat')}
                </label>
                <div className="flex gap-2">
                  {([18, 21, 24] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTrackKarat(k)}
                      className={`flex-1 h-12 rounded-2xl text-body font-semibold transition-transform active:scale-95 cursor-pointer ${
                        trackKarat === k
                          ? 'bg-accent text-accent-ink ring-2 ring-accent'
                          : 'bg-surface-2 text-ink hover:bg-line/40'
                      }`}
                    >
                      {t('karatShort', { k })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-ink-muted">
                {investment.investmentKind === 'gold' ? t('howManyGrams') : t('howManyShares')}
              </label>
              <div className="flex min-h-16 items-center justify-center rounded-2xl bg-surface-2 p-3 text-center">
                <span className="text-title font-bold tabular-nums text-ink">
                  {trackQuantityStr || '0'}
                  <span className="text-caption font-normal text-ink-muted ms-1">
                    {investment.investmentKind === 'gold'
                      ? t('gramsShort', { n: '' }).trim()
                      : t('sharesCount', { n: '' }).trim()}
                  </span>
                </span>
              </div>
              <AmountPad value={trackQuantityStr} onChange={setTrackQuantityStr} />
            </div>

            <Button
              type="button"
              onClick={handleTrackByQuantity}
              disabled={
                isTrackSubmitting ||
                !trackQuantityStr ||
                Number(normalizeDigits(trackQuantityStr).replace(/[,\s٬]/g, '')) <= 0
              }
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


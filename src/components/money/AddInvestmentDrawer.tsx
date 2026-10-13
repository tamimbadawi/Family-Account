'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRestoreSheetAfterKeyboard } from '@/components/settings/useRestoreSheetAfterKeyboard';
import { useHousehold, useRepository, useWalletBalances } from '@/lib/data/provider';
import { useSaveError } from '@/components/ui/use-save-error';
import { AmountDisplay } from '@/components/entry/AmountDisplay';
import { AmountPad } from '@/components/entry/AmountPad';
import { FutureDateField } from '@/components/entry/DetailsRow';
import { CurrencySelect } from '@/components/family/CurrencySelect';
import { CategoryIcon } from '@/components/ui/category-icon';
import { localISODate, money, normalizeDigits, pickName } from '@/lib/format';
import type { InvestmentKind } from '@/lib/data/types';
import { INVESTMENT_KINDS, INVESTMENT_KIND_MAP } from './investment-kind';

interface AddInvestmentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddInvestmentDrawer({ open, onOpenChange }: AddInvestmentDrawerProps) {
  const t = useTranslations('money');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const repo = useRepository();
  const saveError = useSaveError();
  const household = useHousehold();
  const allWallets = useWalletBalances() ?? [];

  const currencies = household?.currencies ?? ['EGP'];
  const hasMultipleCurrencies = currencies.length > 1;

  const [selectedCurrency, setSelectedCurrency] = React.useState<string>(currencies[0] ?? 'EGP');
  const [kind, setKind] = React.useState<InvestmentKind>('gold');
  const [customName, setCustomName] = React.useState<string | null>(null);
  const [amountStr, setAmountStr] = React.useState('');
  const [quantityStr, setQuantityStr] = React.useState('');
  const [activeField, setActiveField] = React.useState<'quantity' | 'amount'>('quantity');
  const [knowsQuantity, setKnowsQuantity] = React.useState(true);
  const [karat, setKarat] = React.useState<18 | 21 | 24>(21);
  const [paidFrom, setPaidFrom] = React.useState<string>('alreadyHave');
  const [maturesOn, setMaturesOn] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const sheetRef = React.useRef<HTMLDivElement>(null);
  useRestoreSheetAfterKeyboard(sheetRef, open);

  const effectiveName = customName !== null ? customName : t(INVESTMENT_KIND_MAP[kind].messageKey);

  const handleKindSelect = (k: InvestmentKind) => {
    setKind(k);
    if (k === 'gold' || k === 'stocks') {
      setActiveField('quantity');
    }
  };

  const resetForm = () => {
    setKind('gold');
    setCustomName(null);
    setAmountStr('');
    setQuantityStr('');
    setActiveField('quantity');
    setKnowsQuantity(true);
    setKarat(21);
    setPaidFrom('alreadyHave');
    setMaturesOn('');
    setSelectedCurrency(currencies[0] ?? 'EGP');
    setIsSubmitting(false);
  };

  // Spending wallets matching selected currency
  const spendingWallets = allWallets.filter(
    (w) => (w.purpose ?? 'spending') === 'spending' && w.currency === selectedCurrency
  );

  const isUnitKind = (kind === 'gold' || kind === 'stocks') && knowsQuantity;
  const cleanAmount = Number(normalizeDigits(amountStr).replace(/[,\s٬]/g, '')) || 0;
  const cleanQuantity = Number(normalizeDigits(quantityStr).replace(/[,\s٬]/g, '')) || 0;
  const cleanName = effectiveName.trim();
  const isFormValid = cleanName.length > 0 && cleanAmount > 0 && (!isUnitKind || cleanQuantity > 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const id = crypto.randomUUID();
    const isAlreadyHave = paidFrom === 'alreadyHave';
    const maturesDate = kind === 'certificate' && maturesOn ? maturesOn : null;
    const unit = isUnitKind ? (kind === 'gold' ? 'gram' : 'share') : null;
    const unitKarat = isUnitKind && kind === 'gold' ? karat : null;
    const finalQuantity = isUnitKind ? cleanQuantity : null;

    try {
      setIsSubmitting(true);
      let transferEntryId: string | null = null;
      let firstPriceValueId: string | null = null;

      if (isAlreadyHave) {
        await repo.addWallet({
          id,
          purpose: 'investment',
          investmentKind: kind,
          type: 'wallet',
          nameEn: cleanName,
          nameAr: cleanName,
          openingBalance: cleanAmount,
          openingQuantity: finalQuantity,
          unit,
          karat: unitKarat,
          currency: selectedCurrency,
          maturesOn: maturesDate,
        });
      } else {
        await repo.addWallet({
          id,
          purpose: 'investment',
          investmentKind: kind,
          type: 'wallet',
          nameEn: cleanName,
          nameAr: cleanName,
          openingBalance: 0,
          openingQuantity: isUnitKind ? 0 : null,
          unit,
          karat: unitKarat,
          currency: selectedCurrency,
          maturesOn: maturesDate,
        });

        const entry = await repo.addEntry({
          type: 'transfer',
          amount: cleanAmount,
          quantity: finalQuantity,
          occurredOn: localISODate(),
          accountId: paidFrom,
          toAccountId: id,
        });
        transferEntryId = entry.id;
      }

      // If unit investment, write the first price row (unit_price = paid / quantity)
      if (isUnitKind && finalQuantity && finalQuantity > 0) {
        const unitPrice = Math.round((cleanAmount / finalQuantity) * 100) / 100;
        const val = await repo.addInvestmentValue({
          accountId: id,
          value: cleanAmount,
          unitPrice,
        });
        firstPriceValueId = val.id;
      }

      onOpenChange(false);
      resetForm();

      toast.success(t('addedTo', { name: cleanName }), {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              if (firstPriceValueId) {
                await repo.softDeleteInvestmentValue(firstPriceValueId);
              }
              if (transferEntryId) {
                await repo.softDeleteEntry(transferEntryId);
              }
              await repo.archiveWallet(id, true);
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
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs>
      <DrawerContent ref={sheetRef} className="max-h-[96dvh]">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom,0px),1rem)] space-y-3">
          <DrawerHeader className="px-0 pt-3 pb-0">
            <DrawerTitle className="text-title font-bold text-ink text-start">
              {t('addInvestment')}
            </DrawerTitle>
          </DrawerHeader>

          <form onSubmit={handleSave} className="space-y-2 [@media(min-height:740px)]:space-y-3">
            {/* 1. Kind selection & Currency */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-caption font-semibold text-ink-muted">
                  {t('kind')}
                </label>
                {hasMultipleCurrencies && (
                  <div className="w-28 shrink-0">
                    <CurrencySelect
                      value={selectedCurrency}
                      onChange={(c) => {
                        setSelectedCurrency(c);
                        setPaidFrom('alreadyHave');
                      }}
                      className="h-8 w-full rounded-lg bg-surface-2 px-2 text-caption font-semibold"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-6 gap-1">
                {INVESTMENT_KINDS.map((k) => {
                  const info = INVESTMENT_KIND_MAP[k];
                  const Icon = info.icon;
                  const isSelected = kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-label={t(info.messageKey)}
                      onClick={() => handleKindSelect(k)}
                      className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl p-1 transition-transform active:scale-95 cursor-pointer text-center ${
                        isSelected
                          ? 'bg-accent text-accent-ink ring-2 ring-accent'
                          : 'bg-surface-2 text-ink hover:bg-line/40'
                      }`}
                    >
                      <Icon className="size-4.5 shrink-0" />
                      <span className="text-[11px] font-semibold leading-tight line-clamp-1">
                        {t(info.messageKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Name & Karat on the same row */}
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  type="text"
                  required
                  value={effectiveName}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                  }}
                  className="h-10 rounded-xl bg-surface-2 text-body"
                />
              </div>
              {isUnitKind && kind === 'gold' && (
                <div className="flex gap-1 shrink-0">
                  {([18, 21, 24] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKarat(k)}
                      className={`h-10 min-w-10 px-2 rounded-xl text-caption font-semibold transition-transform active:scale-95 cursor-pointer ${
                        karat === k
                          ? 'bg-accent text-accent-ink ring-2 ring-accent'
                          : 'bg-surface-2 text-ink hover:bg-line/40'
                      }`}
                    >
                      {t('karatShort', { k })}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Number inputs & AmountPad */}
            {isUnitKind ? (
              <div className="space-y-1.5 [@media(min-height:740px)]:space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Box 1: Quantity */}
                  <button
                    type="button"
                    onClick={() => setActiveField('quantity')}
                    className={`flex min-h-12 flex-col items-start justify-center rounded-xl px-2.5 py-1.5 text-start transition-transform active:scale-98 cursor-pointer ${
                      activeField === 'quantity'
                        ? 'bg-surface-2 ring-2 ring-accent'
                        : 'bg-surface-2/60 opacity-80'
                    }`}
                  >
                    <span className="text-caption font-semibold text-ink-muted leading-tight">
                      {kind === 'gold' ? t('howManyGrams') : t('howManyShares')}
                    </span>
                    <span className="text-title font-bold tabular-nums text-ink leading-tight">
                      {quantityStr ? (
                        <>
                          {quantityStr}
                          <span className="text-caption font-normal text-ink-muted ms-1">
                            {kind === 'gold' ? t('gramsShort', { n: '' }).trim() : t('sharesCount', { n: '' }).trim()}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-muted font-normal">0</span>
                      )}
                    </span>
                  </button>

                  {/* Box 2: What did you pay */}
                  <button
                    type="button"
                    onClick={() => setActiveField('amount')}
                    className={`flex min-h-12 flex-col items-start justify-center rounded-xl px-2.5 py-1.5 text-start transition-transform active:scale-98 cursor-pointer ${
                      activeField === 'amount'
                        ? 'bg-surface-2 ring-2 ring-accent'
                        : 'bg-surface-2/60 opacity-80'
                    }`}
                  >
                    <span className="text-caption font-semibold text-ink-muted leading-tight">
                      {t('whatDidYouPay')}
                    </span>
                    <span className="text-title font-bold tabular-nums text-ink leading-tight">
                      {amountStr ? (
                        <>
                          {amountStr}
                          <span className="text-caption font-normal text-ink-muted ms-1">
                            {selectedCurrency}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-muted font-normal">0</span>
                      )}
                    </span>
                  </button>
                </div>

                {/* Per-unit price preview under boxes */}
                {cleanQuantity > 0 && cleanAmount > 0 && (
                  <p className="text-caption font-semibold text-ink-muted text-center tabular-nums py-0">
                    {kind === 'gold'
                      ? t('perGram', {
                          amount: money(Math.round((cleanAmount / cleanQuantity) * 100) / 100, locale, {
                            currency: selectedCurrency,
                          }),
                        })
                      : t('perShare', {
                          amount: money(Math.round((cleanAmount / cleanQuantity) * 100) / 100, locale, {
                            currency: selectedCurrency,
                          }),
                        })}
                  </p>
                )}

                <AmountPad
                  value={activeField === 'quantity' ? quantityStr : amountStr}
                  onChange={(val) => {
                    if (activeField === 'quantity') {
                      setQuantityStr(val);
                    } else {
                      setAmountStr(val);
                    }
                  }}
                />

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setKnowsQuantity(false)}
                    className="min-h-11 py-1 text-body text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                  >
                    {kind === 'gold' ? t('dontKnowWeight') : t('dontKnowShares')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <AmountDisplay
                  value={amountStr}
                  type="transfer"
                  currency={selectedCurrency}
                />
                <AmountPad value={amountStr} onChange={setAmountStr} />
                {(kind === 'gold' || kind === 'stocks') && (
                  <div className="flex justify-center pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setKnowsQuantity(true);
                        setActiveField('quantity');
                      }}
                      className="min-h-11 py-1 text-body text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                    >
                      {kind === 'gold' ? t('trackByWeight') : t('trackByShares')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 4. Paid from chooser */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t('paidFrom')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {/* "I already had it" button */}
                <button
                  type="button"
                  aria-pressed={paidFrom === 'alreadyHave'}
                  onClick={() => setPaidFrom('alreadyHave')}
                  className={`flex min-h-12 items-center gap-1.5 rounded-xl px-3 py-1.5 text-start transition-transform active:scale-95 cursor-pointer ${
                    paidFrom === 'alreadyHave'
                      ? 'bg-accent text-accent-ink'
                      : 'bg-surface-2 text-ink'
                  }`}
                >
                  <span className="text-body font-semibold leading-tight">
                    {t('alreadyHave')}
                  </span>
                </button>

                {/* Spending wallets */}
                {spendingWallets.map((w) => {
                  const isSelected = paidFrom === w.id;
                  const walletName = pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setPaidFrom(w.id)}
                      className={`flex min-h-12 items-center gap-2 rounded-xl px-3 py-1.5 text-start transition-transform active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-accent text-accent-ink'
                          : 'bg-surface-2 text-ink'
                      }`}
                    >
                      <CategoryIcon name={w.icon ?? 'wallet'} className="size-4.5 shrink-0" />
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-body font-semibold leading-tight">
                          {walletName}
                        </span>
                        <span
                          className={`text-caption tabular-nums leading-tight ${
                            isSelected ? '' : 'text-ink-muted'
                          }`}
                        >
                          {money(w.balance, locale, { currency: w.currency })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Ends on (only for certificate) */}
            {kind === 'certificate' && (
              <div className="space-y-1">
                <label className="text-caption font-semibold text-ink-muted">
                  {t('endsOn')} ({t('optional')})
                </label>
                <FutureDateField
                  value={maturesOn}
                  onChange={setMaturesOn}
                  label={t('endsOn')}
                  noneLabel={t('optional')}
                />
              </div>
            )}

            {/* 6. Primary Save button */}
            <Button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="h-14 w-full rounded-2xl bg-accent text-body font-semibold text-accent-ink transition-transform active:scale-98 cursor-pointer disabled:opacity-40"
            >
              {tCommon('save')}
            </Button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

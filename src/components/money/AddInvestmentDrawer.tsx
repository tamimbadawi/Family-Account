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
  const [name, setName] = React.useState('');
  const [isNameEdited, setIsNameEdited] = React.useState(false);
  const [amountStr, setAmountStr] = React.useState('');
  const [paidFrom, setPaidFrom] = React.useState<string>('alreadyHave');
  const [maturesOn, setMaturesOn] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const sheetRef = React.useRef<HTMLDivElement>(null);
  useRestoreSheetAfterKeyboard(sheetRef, open);

  // Initialize and follow kind label when untouched
  React.useEffect(() => {
    if (open && !isNameEdited) {
      setName(t(INVESTMENT_KIND_MAP[kind].messageKey));
    }
  }, [open, kind, isNameEdited, t]);

  const handleKindSelect = (k: InvestmentKind) => {
    setKind(k);
    if (!isNameEdited) {
      setName(t(INVESTMENT_KIND_MAP[k].messageKey));
    }
  };

  const resetForm = () => {
    setKind('gold');
    setName('');
    setIsNameEdited(false);
    setAmountStr('');
    setPaidFrom('alreadyHave');
    setMaturesOn('');
    setSelectedCurrency(currencies[0] ?? 'EGP');
    setIsSubmitting(false);
  };

  // Spending wallets matching selected currency
  const spendingWallets = allWallets.filter(
    (w) => (w.purpose ?? 'spending') === 'spending' && w.currency === selectedCurrency
  );

  const cleanAmount = Number(normalizeDigits(amountStr).replace(/[,\s٬]/g, '')) || 0;
  const isFormValid = name.trim().length > 0 && cleanAmount > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const id = crypto.randomUUID();
    const cleanName = name.trim();
    const isAlreadyHave = paidFrom === 'alreadyHave';
    const maturesDate = kind === 'certificate' && maturesOn ? maturesOn : null;

    try {
      setIsSubmitting(true);
      let transferEntryId: string | null = null;

      if (isAlreadyHave) {
        await repo.addWallet({
          id,
          purpose: 'investment',
          investmentKind: kind,
          type: 'wallet',
          nameEn: cleanName,
          nameAr: cleanName,
          openingBalance: cleanAmount,
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
          currency: selectedCurrency,
          maturesOn: maturesDate,
        });

        const entry = await repo.addEntry({
          type: 'transfer',
          amount: cleanAmount,
          occurredOn: localISODate(),
          accountId: paidFrom,
          toAccountId: id,
        });
        transferEntryId = entry.id;
      }

      onOpenChange(false);
      resetForm();

      toast.success(t('addedTo', { name: cleanName }), {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
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
      <DrawerContent ref={sheetRef} className="max-h-[92dvh]">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] space-y-4">
          <DrawerHeader className="px-0 pt-4 pb-1">
            <DrawerTitle className="text-title font-bold text-ink text-start">
              {t('addInvestment')}
            </DrawerTitle>
          </DrawerHeader>

          <form onSubmit={handleSave} className="space-y-4">
            {/* 1. Kind selection */}
            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-ink-muted">
                {t('kind')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {INVESTMENT_KINDS.map((k) => {
                  const info = INVESTMENT_KIND_MAP[k];
                  const Icon = info.icon;
                  const isSelected = kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleKindSelect(k)}
                      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl p-2 transition-transform active:scale-95 cursor-pointer text-center ${
                        isSelected
                          ? 'bg-accent text-accent-ink ring-2 ring-accent'
                          : 'bg-surface-2 text-ink hover:bg-line/40'
                      }`}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span className="text-caption font-semibold leading-tight line-clamp-1">
                        {t(info.messageKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Currency selector if family has multiple */}
            {hasMultipleCurrencies && (
              <div className="space-y-1">
                <label className="text-caption font-semibold text-ink-muted">
                  {tCommon('currency')}
                </label>
                <CurrencySelect
                  value={selectedCurrency}
                  onChange={(c) => {
                    setSelectedCurrency(c);
                    setPaidFrom('alreadyHave');
                  }}
                  className="h-12 w-full rounded-2xl bg-surface-2 px-3 text-body"
                />
              </div>
            )}

            {/* 2. Name field */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t('name')}
              </label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setIsNameEdited(true);
                }}
                className="h-12 rounded-2xl bg-surface-2 text-body"
              />
            </div>

            {/* 3. AmountDisplay + AmountPad */}
            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-ink-muted">
                {t('howMuch')}
              </label>
              <AmountDisplay
                value={amountStr}
                type="transfer"
                currency={selectedCurrency}
              />
              <AmountPad value={amountStr} onChange={setAmountStr} />
            </div>

            {/* 4. Paid from chooser */}
            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-ink-muted">
                {t('paidFrom')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* "I already had it" tile */}
                <button
                  type="button"
                  aria-pressed={paidFrom === 'alreadyHave'}
                  onClick={() => setPaidFrom('alreadyHave')}
                  className={`flex min-h-14 items-center gap-2 rounded-2xl px-3 py-2 text-start transition-transform active:scale-95 cursor-pointer ${
                    paidFrom === 'alreadyHave'
                      ? 'bg-accent text-accent-ink'
                      : 'bg-surface-2 text-ink'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold leading-tight">
                      {t('alreadyHave')}
                    </span>
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

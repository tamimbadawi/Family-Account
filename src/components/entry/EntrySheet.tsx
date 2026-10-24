'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type {
  Category,
  EnrichedEntry,
  EntryType,
  Item,
  Subcategory,
} from '@/lib/data/types';
import { useHousehold, useRepository, useSavingsGoals, useWallets } from '@/lib/data/provider';
import { Link } from '@/i18n/navigation';
import { useSaveError } from '@/components/ui/use-save-error';
import { validateEntry } from '@/lib/validation/entry';
import { generalItemFor } from '@/lib/data/general-item';
import { previewValue } from '@/lib/format/expression';
import { goalCheer } from '@/lib/goals/progress';
import { money, pickName } from '@/lib/format';
import { budgetPercent, messageVariant } from '@/lib/reports/budgets';
import { budgetWarningsForEntry } from '@/components/budgets/budget-warning';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

import { TypeToggle } from './TypeToggle';
import type { SheetType } from './TypeToggle';
import { AmountDisplay } from './AmountDisplay';
import { AmountPad } from './AmountPad';
import { CategoryRow } from './CategoryRow';
import { DateChip, GoalSelect, NoteChip, WalletSelect } from './DetailsRow';
import { ReceiptPhoto } from './ReceiptPhoto';
import { useEntrySheet } from './EntrySheetContext';
import { MONTHLY, RecurrencePicker } from './RecurrencePicker';
import type { RecurrenceConfig } from './RecurrencePicker';

function getLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface EntrySheetFormProps {
  mode: 'add' | 'edit';
  editingEntry: EnrichedEntry | null;
  initialType?: EntryType;
  initialRecurring?: boolean;
  initialGoalId?: string | null;
  onClose: () => void;
}

function EntrySheetForm({ mode, editingEntry, initialType, initialRecurring, initialGoalId, onClose }: EntrySheetFormProps) {
  const t = useTranslations('entry');
  const tCommon = useTranslations('common');
  const tBudgets = useTranslations('budgets');
  const tGoals = useTranslations('goals');
  const locale = useLocale();
  const repo = useRepository();
  const saveError = useSaveError();
  const wallets = useWallets();
  const goals = useSavingsGoals(false);

  // Initial values
  const defaultType = editingEntry ? editingEntry.type : initialGoalId ? 'transfer' : (initialType ?? 'expense');
  const defaultAmount = editingEntry ? String(editingEntry.amount) : '';
  const spendingWallets = React.useMemo(
    () => (wallets ?? []).filter((w) => !w.isArchived && (w.purpose ?? 'spending') === 'spending'),
    [wallets]
  );
  const defaultSpendingWallet = spendingWallets[0] ?? null;

  const defaultWalletId = editingEntry
    ? editingEntry.accountId
    : (defaultSpendingWallet?.id ?? null);
  const defaultToWalletId = editingEntry
    ? (editingEntry.toAccountId ?? null)
    : (wallets?.find((w) => !w.isArchived && w.id !== defaultSpendingWallet?.id)?.id ?? null);
  const defaultOccurredOn = editingEntry
    ? editingEntry.occurredOn
    : getLocalDateString(new Date());
  const defaultNote = editingEntry ? (editingEntry.note ?? '') : '';

  const defaultItem: Item | null = editingEntry && editingEntry.itemId
    ? {
        id: editingEntry.itemId,
        householdId: editingEntry.householdId,
        subcategoryId: editingEntry.subcategoryId ?? '',
        nameAr: editingEntry.itemNameAr ?? null,
        nameEn: editingEntry.itemNameEn ?? null,
        sortOrder: 0,
        isArchived: false,
        createdAt: editingEntry.createdAt,
        updatedAt: editingEntry.updatedAt ?? editingEntry.createdAt,
      }
    : null;

  // Form State
  const household = useHousehold();
  const householdCurrencies = React.useMemo(() => {
    return household?.currencies ?? (household?.currency ? [household.currency] : ['EGP']);
  }, [household]);

  const [type, setType] = React.useState<EntryType>(defaultType);
  const [amountStr, setAmountStr] = React.useState(defaultAmount);
  const [selectedWalletId, setSelectedWalletId] = React.useState<string | null>(defaultWalletId);
  const [selectedToWalletId, setSelectedToWalletId] = React.useState<string | null>(defaultToWalletId);
  const selectedWallet = wallets?.find((w) => w.id === selectedWalletId);
  const canChangeCurrency = householdCurrencies.length > 1;
  const currentCurrency = selectedWallet?.currency ?? householdCurrencies[0] ?? 'EGP';

  const handleToggleCurrency = async () => {
    if (householdCurrencies.length <= 1) return;
    const currentIndex = householdCurrencies.indexOf(currentCurrency);
    const nextIndex = (currentIndex + 1) % householdCurrencies.length;
    const targetCurrency = householdCurrencies[nextIndex]!;

    const matchingWallet = wallets?.find(
      (w) => !w.isArchived && (w.purpose ?? 'spending') === 'spending' && w.currency === targetCurrency
    );

    if (matchingWallet) {
      setSelectedWalletId(matchingWallet.id);
    } else {
      try {
        const created = await repo.addWallet({
          type: 'cash',
          nameAr: `كاش (${targetCurrency})`,
          nameEn: `Cash (${targetCurrency})`,
          icon: 'banknote',
          currency: targetCurrency,
          openingBalance: 0,
        });
        setSelectedWalletId(created.id);
      } catch (err) {
        saveError(err);
      }
    }
  };

  // "Goal": a move from a wallet into a savings goal's wallet. Saved as a normal transfer, so the books balance.
  const [isGoal, setIsGoal] = React.useState(Boolean(initialGoalId));
  const [goalId, setGoalId] = React.useState<string | null>(initialGoalId ?? null);
  const selectedGoal = isGoal ? (goals?.find((g) => g.id === goalId) ?? goals?.[0]) : undefined;
  // The money cannot come from the goal's own wallet
  const fromWalletId =
    isGoal && selectedGoal && selectedWalletId === selectedGoal.walletId
      ? (wallets?.find((w) => w.id !== selectedGoal.walletId)?.id ?? null)
      : selectedWalletId;
  const toWalletId = isGoal ? (selectedGoal?.walletId ?? null) : selectedToWalletId;
  // Moving money out of a goal's wallet gets a kind note (never a blocking question)
  const drainedGoal =
    !isGoal && type === 'transfer' ? goals?.find((g) => g.walletId === selectedWalletId) : undefined;
  // Money going into a goal's wallet (from "Goal" or a plain move) earns a kind word once saved
  const filledGoal = type === 'transfer' && !drainedGoal ? goals?.find((g) => g.walletId === toWalletId) : undefined;
  const goalName = (g: { nameAr: string | null; nameEn: string | null }) =>
    pickName({ name_ar: g.nameAr, name_en: g.nameEn }, locale);
  const savedMessage = () => {
    if (filledGoal) {
      const cheer = goalCheer(filledGoal.currentAmount, numericAmount, filledGoal.targetAmount);
      return tGoals(cheer.key, {
        name: goalName(filledGoal),
        percent: cheer.percent,
        amount: money(numericAmount, locale, { currency: selectedWallet?.currency }),
      });
    }
    if (drainedGoal) return tGoals('nudge', { name: goalName(drainedGoal) });
    return t('saved') + ' ✓';
  };

  // Move: picking the wallet that is already on the other side swaps the two
  const pickFromWallet = (id: string) => {
    if (id === selectedToWalletId) setSelectedToWalletId(selectedWalletId);
    setSelectedWalletId(id);
  };
  const pickToWallet = (id: string) => {
    if (id === selectedWalletId) setSelectedWalletId(selectedToWalletId);
    setSelectedToWalletId(id);
  };
  const swapWallets = () => {
    setSelectedWalletId(selectedToWalletId);
    setSelectedToWalletId(selectedWalletId);
  };
  const [occurredOn, setOccurredOn] = React.useState(defaultOccurredOn);
  const [note, setNote] = React.useState(defaultNote);
  const [selectedItem, setSelectedItem] = React.useState<Item | null>(defaultItem);

  // Wallets may still be loading at mount: once they arrive, preselect them for a new entry.
  // Only fills empty slots, so the user's choice and an edited entry's wallets are never replaced.
  if (!editingEntry && wallets && wallets.length > 0) {
    const spending = wallets.filter((w) => !w.isArchived && (w.purpose ?? 'spending') === 'spending');
    const mainCur = householdCurrencies[0];
    const preferredSpending = spending.find((w) => w.currency === mainCur) ?? spending[0];
    const firstSpendingId = preferredSpending?.id ?? null;
    const fromId = selectedWalletId ?? firstSpendingId;
    if (selectedWalletId === null && fromId) setSelectedWalletId(fromId);
    if (selectedToWalletId === null) {
      const other = wallets.find((w) => !w.isArchived && w.id !== fromId);
      if (other) setSelectedToWalletId(other.id);
    }
  }

  // Receipt photo: a new entry starts without one; an edited entry loads its stored photo
  const [photo, setPhoto] = React.useState<Blob | null>(null);
  const [originalPhoto, setOriginalPhoto] = React.useState<Blob | null>(null);
  const photoTouched = React.useRef(false);
  const editingId = editingEntry?.id;
  const editingPhotoPath = editingEntry?.photoPath;

  React.useEffect(() => {
    if (!editingId || !editingPhotoPath) return;
    let cancelled = false;
    repo.getEntryPhoto(editingId).then((blob) => {
      if (cancelled) return;
      setOriginalPhoto(blob);
      if (!photoTouched.current) setPhoto(blob);
    });
    return () => {
      cancelled = true;
    };
  }, [repo, editingId, editingPhotoPath]);

  const handlePhotoChange = (next: Blob | null) => {
    photoTouched.current = true;
    setPhoto(next);
  };

  const [isNoteOpen, setIsNoteOpen] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // null = does not repeat
  const [recurrence, setRecurrence] = React.useState<RecurrenceConfig | null>(initialRecurring ? MONTHLY : null);

  // When type changes, clear incompatible item (expense <-> income or transfer)
  const handleTypeChange = (next: SheetType) => {
    const newType: EntryType = next === 'goal' ? 'transfer' : next;
    setIsGoal(next === 'goal');
    if (newType !== type) {
      setType(newType);
      setSelectedItem(null);
    }
  };

  const handlePickCategoryItem = (item: Item) => {
    setSelectedItem(item);
  };

  // Validation
  // The pad may hold an expression ("120+85"); only its result is saved
  const amountResult = previewValue(amountStr);
  const numericAmount = amountResult ?? 0;
  const isInvalidAmount = amountStr !== '' && amountResult === null;
  const isTransfer = type === 'transfer';
  // Saving at a main category or group is fine: the entry goes under that level's general item
  const [path, setPath] = React.useState<{ category: Category | null; subcategory: Subcategory | null }>({
    category: null,
    subcategory: null,
  });
  const [breadcrumbSlot, setBreadcrumbSlot] = React.useState<HTMLDivElement | null>(null);
  const handlePathChange = React.useCallback(
    (category: Category | null, subcategory: Subcategory | null) => setPath({ category, subcategory }),
    []
  );
  const hasItem = Boolean(selectedItem) || Boolean(path.category);
  const hasWallets = isTransfer
    ? Boolean(fromWalletId && toWalletId && fromWalletId !== toWalletId)
    : Boolean(selectedWalletId);

  const canSave = numericAmount > 0 && hasWallets && (isTransfer || hasItem) && !isSubmitting;

  // Soft warning once an expense brings its budget to 80% or more this month (the fullest one only)
  const warnAboutBudget = async (entryId: string) => {
    try {
      const [worst] = await budgetWarningsForEntry(repo, entryId, locale);
      if (!worst) return;
      const { progress, label } = worst;
      const message =
        progress.level === 'over'
          ? tBudgets(`warnOver.${messageVariant()}`, { name: label, amount: money(-progress.remaining, locale, { fractionDigits: 0 }) })
          : tBudgets(`warnNear.${messageVariant()}`, { name: label, percent: String(budgetPercent(progress)) });
      toast.warning(message, { duration: 6000 });
    } catch (err) {
      console.error(err);
    }
  };

  const pendingIdRef = React.useRef<string | null>(null);
  const handleSave = async () => {
    if (!canSave) return;

    // At a category or group level: find (or create once) its general item
    let itemId = isTransfer ? null : (selectedItem?.id ?? null);
    if (!isTransfer && !itemId && path.category) {
      try {
        itemId = (await generalItemFor(repo, path.category, path.subcategory)).id;
      } catch (err) {
        saveError(err);
        return;
      }
    }

    const payload = {
      type,
      amount: numericAmount,
      occurredOn,
      accountId: (isTransfer ? fromWalletId : selectedWalletId)!,
      toAccountId: isTransfer ? toWalletId : null,
      itemId,
      note: note.trim() || null,
    };

    const validation = validateEntry(payload);
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? 'Validation failed');
      return;
    }

    try {
      setIsSubmitting(true);

      if (mode === 'add') {
        // Same id on every retry of this entry, so a save that reached the server is never duplicated
        pendingIdRef.current ??= crypto.randomUUID();
        let ruleId: string | null = null;

        if (recurrence !== null) {
          const rule = await repo.createRecurringRule({
            type,
            amount: numericAmount,
            startDate: occurredOn,
            frequency: recurrence.frequency,
            interval: recurrence.interval,
            daysOfWeek: recurrence.daysOfWeek.length > 0 ? recurrence.daysOfWeek : null,
            endDate: recurrence.endDate,
            accountId: (isTransfer ? fromWalletId : selectedWalletId)!,
            toAccountId: isTransfer ? toWalletId : null,
            itemId,
            note: note.trim() || null,
          });
          ruleId = rule.id;
        }

        const created = await repo.addEntry({
          ...payload,
          id: pendingIdRef.current,
          recurringRuleId: ruleId,
          recurringMonth: ruleId ? occurredOn.slice(0, 7) : null,
          recurringDate: ruleId ? occurredOn : null,
        });
        if (photo) await repo.setEntryPhoto(created.id, photo);

        setIsSuccess(true);
        setTimeout(() => {
          onClose();
          toast(savedMessage(), {
            action: {
              label: tCommon('undo'),
              onClick: async () => {
                await repo.softDeleteEntry(created.id);
                if (ruleId) await repo.archiveRecurringRule(ruleId, true);
                toast.info(t('deleted'));
              },
            },
            duration: 6000,
          });
          void warnAboutBudget(created.id);
        }, 300);
      } else if (mode === 'edit' && editingEntry) {
        const originalEntry = { ...editingEntry };
        const photoChanged = photo !== originalPhoto;
        const restorePhoto = originalPhoto;
        await repo.updateEntry(editingEntry.id, payload);
        if (photoChanged) {
          if (photo) await repo.setEntryPhoto(editingEntry.id, photo);
          else await repo.removeEntryPhoto(editingEntry.id);
        }

        setIsSuccess(true);
        setTimeout(() => {
          onClose();
          toast(t('updated') + ' ✓', {
            action: {
              label: tCommon('undo'),
              onClick: async () => {
                await repo.updateEntry(originalEntry.id, {
                  type: originalEntry.type,
                  amount: originalEntry.amount,
                  occurredOn: originalEntry.occurredOn,
                  accountId: originalEntry.accountId,
                  toAccountId: originalEntry.toAccountId,
                  itemId: originalEntry.itemId,
                  note: originalEntry.note,
                });
                if (photoChanged) {
                  if (restorePhoto) await repo.setEntryPhoto(originalEntry.id, restorePhoto);
                  else await repo.removeEntryPhoto(originalEntry.id);
                }
                toast.info(t('updated'));
              },
            },
            duration: 6000,
          });
          void warnAboutBudget(editingEntry.id);
        }, 300);
      }
    } catch (err) {
      saveError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEntry) return;

    try {
      const deletedId = editingEntry.id;
      await repo.softDeleteEntry(deletedId);
      onClose();
      toast(t('deleted') + ' ✓', {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            await repo.restoreEntry(deletedId);
            toast.info(t('saved'));
          },
        },
        duration: 6000,
      });
    } catch (err) {
      saveError(err);
    }
  };

  return (
    <div className="flex flex-col gap-2 [@media(min-height:740px)]:gap-3 px-5 pb-2 [@media(min-height:740px)]:pb-[max(1rem,env(safe-area-inset-bottom))] select-none">
      {/* One sheet that fits an iPhone screen: type, amount, category, pad, details, save */}
      <div data-tour="entry-type" className="rounded-2xl">
        <TypeToggle value={isGoal ? 'goal' : type} onChange={handleTypeChange} showGoal={mode === 'add'} />
      </div>

      {/* Amount, with the chosen main category (and group) beside it */}
      <div className="flex items-center gap-2">
        <AmountDisplay
          value={amountStr}
          type={type}
          currency={currentCurrency}
          canChangeCurrency={canChangeCurrency}
          onCurrencyChange={handleToggleCurrency}
          className="min-w-0 flex-1"
        />
        <div ref={setBreadcrumbSlot} className="flex max-w-[56%] shrink-0 empty:hidden" />
      </div>

      {isGoal ? (
        goals && goals.length === 0 ? (
          <Link
            href="/money/goals"
            onClick={onClose}
            className="flex min-h-12 items-center justify-center rounded-2xl bg-accent-soft px-4 text-center text-body font-semibold text-accent"
          >
            {t('createGoalFirst')}
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            {/* From a wallet (cash or a bank) into the chosen goal */}
            <WalletSelect
              label={t('from')}
              value={fromWalletId}
              onChange={setSelectedWalletId}
              exclude={selectedGoal?.walletId}
              grouped
            />
            <div className="flex size-12 shrink-0 items-center justify-center text-ink-muted">
              <ArrowRight className="size-5 rtl:rotate-180" />
            </div>
            <GoalSelect goals={goals ?? []} value={selectedGoal?.id ?? null} onChange={setGoalId} />
          </div>
        )
      ) : isTransfer ? (
        <div className="flex items-center gap-2">
          {/* Both pickers list every wallet: choosing the one already on the other side swaps them,
              so money can move bank → cash as easily as cash → bank */}
          <WalletSelect label={t('from')} value={selectedWalletId} onChange={pickFromWallet} grouped />
          <button
            type="button"
            onClick={swapWallets}
            aria-label={t('swapWallets')}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted transition-transform active:scale-90 cursor-pointer"
          >
            <ArrowRight className="size-5 rtl:rotate-180" />
          </button>
          <WalletSelect label={t('to')} value={selectedToWalletId} onChange={pickToWallet} grouped />
        </div>
      ) : (
        <div data-tour="entry-category" className="rounded-2xl">
        <CategoryRow
          kind={type === 'income' ? 'income' : 'expense'}
          selected={selectedItem}
          onPick={handlePickCategoryItem}
          onClear={() => setSelectedItem(null)}
          onPathChange={handlePathChange}
          breadcrumbSlot={breadcrumbSlot}
        />
        </div>
      )}

      <div data-tour="entry-amount" className="rounded-2xl">
        <AmountPad value={amountStr} onChange={setAmountStr} />
      </div>

      {/* Wallet · date · note on one line */}
      <div data-tour="entry-details" className="flex items-center gap-2 rounded-2xl">
        {isNoteOpen ? (
          <NoteChip value={note} onChange={setNote} isOpen onOpenChange={setIsNoteOpen} />
        ) : (
          <>
            {!isTransfer && (
              <WalletSelect label={t('wallet')} value={selectedWalletId} onChange={setSelectedWalletId} />
            )}
            <DateChip value={occurredOn} onChange={setOccurredOn} />
            <NoteChip value={note} onChange={setNote} isOpen={false} onOpenChange={setIsNoteOpen} />
          </>
        )}
      </div>

      {drainedGoal && !isNoteOpen ? (
        <p role="note" className="rounded-2xl bg-accent-soft px-3 py-2 text-caption text-ink leading-snug">
          {tGoals('takeNote', { name: goalName(drainedGoal) })}
        </p>
      ) : (
        mode === 'add' &&
        !isNoteOpen && <RecurrencePicker value={recurrence} onChange={setRecurrence} startDate={occurredOn} />
      )}

      <div data-tour="entry-save" className="flex gap-2 rounded-2xl">
        {/* Edit mode: Delete next to Save so the sheet still fits */}
        {mode === 'edit' && (
          <button
            type="button"
            onClick={handleDelete}
            aria-label={tCommon('delete')}
            className="flex size-12 [@media(min-height:740px)]:size-14 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger transition-transform active:scale-95 cursor-pointer"
          >
            <Trash2 className="size-6" />
          </button>
        )}
        {/* Receipt photo sits beside Save so the wallet/date/note labels keep their room */}
        <ReceiptPhoto photo={photo} onChange={handlePhotoChange} />
        <Button
          onClick={handleSave}
          disabled={!canSave}
          className="relative h-12 [@media(min-height:740px)]:h-14 flex-1 rounded-2xl text-heading font-semibold text-accent-ink overflow-hidden cursor-pointer"
        >
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="check"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center justify-center"
              >
                <Check className="size-7 stroke-[3]" />
              </motion.div>
            ) : (
              <motion.span
                key="label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {isInvalidAmount
                  ? t('invalidAmount')
                  : numericAmount > 0 && !isTransfer && !hasItem
                    ? t('chooseCategoryFirst')
                    : !isTransfer && !selectedItem && path.category
                      ? t('chooseSubOrSave')
                      : tCommon('save')}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}

/**
 * The drawer library pins a pixel height on the sheet while the iPhone keyboard is open (so the
 * field stays above the keyboard), but it does not always undo it when the keyboard closes —
 * e.g. after saving a new category the input disappears, and the sheet stayed short and low on
 * the screen. Once the keyboard is gone, hand the height back to the layout.
 */
function useRestoreSheetAfterKeyboard(sheetRef: React.RefObject<HTMLDivElement | null>, isOpen: boolean) {
  React.useEffect(() => {
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!isOpen || !viewport) return;

    let frame = 0;
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    let maxSeenHeight = viewport.height;

    const onResize = () => {
      cancelAnimationFrame(frame);
      // Run after the library's own resize handler has written its styles
      frame = requestAnimationFrame(() => {
        const sheet = sheetRef.current;
        if (!sheet) return;
        maxSeenHeight = Math.max(maxSeenHeight, viewport.height);
        const keyboardClosed = isAndroid
          ? maxSeenHeight - viewport.height < 100
          : window.innerHeight - viewport.height < 60;
        if (keyboardClosed) {
          sheet.style.removeProperty('height');
          sheet.style.removeProperty('bottom');
        }
      });
    };

    viewport.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', onResize);
    };
  }, [sheetRef, isOpen]);
}

// Tapping Undo on a toast, or Next in a guide, must not close the sheet
function keepOpenForToasts(e: { target: EventTarget | null; preventDefault: () => void }) {
  if (e.target instanceof Element && e.target.closest('[data-sonner-toaster], [data-tour-overlay]')) e.preventDefault();
}

export function EntrySheet() {
  const t = useTranslations('entry');
  const { isOpen, mode, editingEntry, initialType, initialRecurring, initialGoalId, close } = useEntrySheet();
  const sheetRef = React.useRef<HTMLDivElement>(null);
  useRestoreSheetAfterKeyboard(sheetRef, isOpen);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && close()} repositionInputs>
      <DrawerContent
        ref={sheetRef}
        className="max-h-[96dvh]"
        // Tapping Undo on a toast must not close the sheet
        onPointerDownOutside={keepOpenForToasts}
        onInteractOutside={keepOpenForToasts}
      >
        {/* Only this inner box may scroll: vaul hangs a 200%-tall strip under the sheet, which made the sheet itself
            scrollable, so tapping a lower chip slid the type toggle and amount out of view */}
        <div className="min-h-0 overflow-y-auto">
          <DrawerHeader className="px-4 pt-0.5 pb-1 [@media(min-height:740px)]:pt-1 [@media(min-height:740px)]:pb-2">
            <DrawerTitle className="text-title font-bold text-ink">
              {mode === 'edit' ? t('editTitle') : t('addTitle')}
            </DrawerTitle>
          </DrawerHeader>

          {isOpen && (
            <EntrySheetForm
              key={editingEntry?.id ?? `${initialType ?? 'new'}:${initialGoalId ?? ''}`}
              mode={mode}
              editingEntry={editingEntry}
              initialType={initialType}
              initialRecurring={initialRecurring}
              initialGoalId={initialGoalId}
              onClose={close}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

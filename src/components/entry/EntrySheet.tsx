'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type {
  EnrichedEntry,
  EntryType,
  Item,
} from '@/lib/data/types';
import { useRepository, useWallets } from '@/lib/data/provider';
import { validateEntry } from '@/lib/validation/entry';
import { money, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

import { TypeToggle } from './TypeToggle';
import { AmountDisplay } from './AmountDisplay';
import { AmountPad } from './AmountPad';
import { CategoryPicker } from './CategoryPicker';
import { WalletPicker } from './WalletPicker';
import { DateChips } from './DateChips';
import { NoteField } from './NoteField';
import { useEntrySheet } from './EntrySheetContext';

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
  onClose: () => void;
}

function EntrySheetForm({ mode, editingEntry, initialType, onClose }: EntrySheetFormProps) {
  const t = useTranslations('entry');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const repo = useRepository();
  const wallets = useWallets();

  // Initial values
  const defaultType = editingEntry ? editingEntry.type : (initialType ?? 'expense');
  const defaultAmount = editingEntry ? String(editingEntry.amount) : '';
  const defaultWalletId = editingEntry
    ? editingEntry.accountId
    : (wallets?.[0]?.id ?? null);
  const defaultToWalletId = editingEntry
    ? (editingEntry.toAccountId ?? null)
    : (wallets && wallets.length > 1 ? wallets[1].id : null);
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
  const [type, setType] = React.useState<EntryType>(defaultType);
  const [amountStr, setAmountStr] = React.useState(defaultAmount);
  const [selectedWalletId, setSelectedWalletId] = React.useState<string | null>(defaultWalletId);
  const [selectedToWalletId, setSelectedToWalletId] = React.useState<string | null>(defaultToWalletId);
  const [occurredOn, setOccurredOn] = React.useState(defaultOccurredOn);
  const [note, setNote] = React.useState(defaultNote);
  const [selectedItem, setSelectedItem] = React.useState<Item | null>(defaultItem);

  // Phase state: 1 = amount pad, 2 = category/details
  const [phase, setPhase] = React.useState<1 | 2>(mode === 'edit' ? 2 : 1);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // When type changes, clear incompatible item (expense <-> income or transfer)
  const handleTypeChange = (newType: EntryType) => {
    if (newType !== type) {
      setType(newType);
      setSelectedItem(null);
    }
  };

  const handlePickCategoryItem = (item: Item) => {
    setSelectedItem(item);
  };

  // Validation
  const numericAmount = parseFloat(amountStr) || 0;
  const isTransfer = type === 'transfer';
  const hasItem = Boolean(selectedItem);
  const hasWallets = isTransfer
    ? Boolean(selectedWalletId && selectedToWalletId && selectedWalletId !== selectedToWalletId)
    : Boolean(selectedWalletId);

  const canSave = numericAmount > 0 && hasWallets && (isTransfer || hasItem) && !isSubmitting;

  const handleSave = async () => {
    if (!canSave) return;

    const payload = {
      type,
      amount: numericAmount,
      occurredOn,
      accountId: selectedWalletId!,
      toAccountId: isTransfer ? selectedToWalletId : null,
      itemId: isTransfer ? null : selectedItem?.id ?? null,
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
        const created = await repo.addEntry(payload);

        setIsSuccess(true);
        setTimeout(() => {
          onClose();
          toast(t('saved') + ' ✓', {
            action: {
              label: tCommon('undo'),
              onClick: async () => {
                await repo.softDeleteEntry(created.id);
                toast.info(t('deleted'));
              },
            },
            duration: 6000,
          });
        }, 300);
      } else if (mode === 'edit' && editingEntry) {
        const originalEntry = { ...editingEntry };
        await repo.updateEntry(editingEntry.id, payload);

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
                toast.info(t('updated'));
              },
            },
            duration: 6000,
          });
        }, 300);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save');
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
      console.error(err);
      toast.error('Failed to delete');
    }
  };

  const selectedItemLabel = selectedItem
    ? pickName({ name_ar: selectedItem.nameAr, name_en: selectedItem.nameEn }, locale)
    : null;

  return (
    <div className="space-y-4 px-5 pb-8 select-none">
      {/* PHASE 1: TypeToggle + AmountDisplay + AmountPad + Next */}
      {phase === 1 && (
        <div className="space-y-4">
          {/* 1. TypeToggle */}
          <TypeToggle value={type} onChange={handleTypeChange} />

          {/* 2. AmountDisplay */}
          <AmountDisplay value={amountStr} type={type} />

          {/* 3. AmountPad (fills space) */}
          <div className="pt-2">
            <AmountPad value={amountStr} onChange={setAmountStr} />
          </div>

          {/* 4. Next Button */}
          <div className="pt-2 space-y-2">
            <Button
              type="button"
              onClick={() => setPhase(2)}
              disabled={numericAmount <= 0}
              className="w-full h-14 rounded-2xl text-heading font-semibold text-accent-ink shadow-xs cursor-pointer"
            >
              <span>{t('next')}</span>
            </Button>

            {mode === 'edit' && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl text-body font-semibold text-danger transition-colors hover:bg-danger/10 active:scale-98 cursor-pointer"
              >
                <Trash2 className="size-5" />
                <span>{tCommon('delete')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* PHASE 2: Amount Pill + Category/Wallets + Review Strip + Save */}
      {phase === 2 && (
        <div className="space-y-4">
          {/* 1. Small Amount Pill (tapping returns to Pad) */}
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={() => setPhase(1)}
              className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 shadow-xs transition-transform active:scale-95 hover:bg-surface-2/80 cursor-pointer"
            >
              <span
                className={`text-heading font-bold tabular-nums ${
                  type === 'income'
                    ? 'text-income'
                    : type === 'expense'
                    ? 'text-expense'
                    : 'text-ink'
                }`}
              >
                {money(numericAmount, locale)}
              </span>
              <span className="text-caption text-ink-muted">·</span>
              <span className="text-caption font-semibold text-accent">
                {t('editAmount')}
              </span>
            </button>
          </div>

          {/* 2. Step Area: CategoryPicker or Wallets */}
          {isTransfer ? (
            <div className="space-y-3 rounded-card bg-surface p-4 shadow-card">
              <div className="space-y-1.5">
                <span className="text-caption font-semibold text-ink-muted">{t('from')}</span>
                <WalletPicker
                  value={selectedWalletId}
                  onChange={setSelectedWalletId}
                  exclude={selectedToWalletId}
                />
              </div>
              <div className="space-y-1.5 pt-2 border-t border-line">
                <span className="text-caption font-semibold text-ink-muted">{t('to')}</span>
                <WalletPicker
                  value={selectedToWalletId}
                  onChange={setSelectedToWalletId}
                  exclude={selectedWalletId}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedItemLabel ? (
                <div className="flex items-center justify-between rounded-card bg-surface p-4 shadow-card">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <CategoryIcon className="size-5" />
                    </div>
                    <span className="truncate text-body font-semibold text-ink">
                      {selectedItemLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="shrink-0 text-caption font-semibold text-accent hover:underline ps-2 cursor-pointer"
                  >
                    {t('change')}
                  </button>
                </div>
              ) : (
                <div className="rounded-card bg-surface p-4 shadow-card">
                  <CategoryPicker
                    kind={type === 'income' ? 'income' : 'expense'}
                    onPick={handlePickCategoryItem}
                  />
                </div>
              )}
            </div>
          )}

          {/* 3. Review strip */}
          <div className="space-y-3 pt-1">
            {/* Wallet for expense/income */}
            {!isTransfer && (
              <div className="space-y-1.5">
                <span className="text-caption font-semibold text-ink-muted">{t('wallet')}</span>
                <WalletPicker
                  value={selectedWalletId}
                  onChange={setSelectedWalletId}
                />
              </div>
            )}

            {/* Date Chips */}
            <div className="space-y-1.5">
              <DateChips value={occurredOn} onChange={setOccurredOn} />
            </div>

            {/* Note Field */}
            <NoteField value={note} onChange={setNote} />
          </div>

          {/* 4. Save Button */}
          <div className="pt-2 space-y-2">
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="relative w-full h-14 rounded-2xl text-heading font-semibold text-accent-ink overflow-hidden cursor-pointer"
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
                    {tCommon('save')}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>

            {/* Edit mode: Delete button */}
            {mode === 'edit' && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl text-body font-semibold text-danger transition-colors hover:bg-danger/10 active:scale-98 cursor-pointer"
              >
                <Trash2 className="size-5" />
                <span>{tCommon('delete')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EntrySheet() {
  const t = useTranslations('entry');
  const { isOpen, mode, editingEntry, initialType, close } = useEntrySheet();

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && close()} repositionInputs>
      <DrawerContent className="max-h-[92dvh] overflow-y-auto">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-title font-bold text-ink">
            {mode === 'edit' ? t('editTitle') : t('addTitle')}
          </DrawerTitle>
        </DrawerHeader>

        {isOpen && (
          <EntrySheetForm
            key={editingEntry?.id ?? (initialType ?? 'new')}
            mode={mode}
            editingEntry={editingEntry}
            initialType={initialType}
            onClose={close}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

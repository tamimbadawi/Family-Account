'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type {
  EnrichedEntry,
  EntryType,
  Item,
} from '@/lib/data/types';
import { useRepository, useWallets } from '@/lib/data/provider';
import { validateEntry } from '@/lib/validation/entry';
import { previewValue } from '@/lib/format/expression';

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
import { CategoryRow } from './CategoryRow';
import { DateChip, NoteChip, WalletSelect } from './DetailsRow';
import { ReceiptPhoto } from './ReceiptPhoto';
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
    const fromId = selectedWalletId ?? wallets[0].id;
    if (selectedWalletId === null) setSelectedWalletId(fromId);
    if (selectedToWalletId === null) {
      const other = wallets.find((w) => w.id !== fromId);
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
  // The pad may hold an expression ("120+85"); only its result is saved
  const amountResult = previewValue(amountStr);
  const numericAmount = amountResult ?? 0;
  const isInvalidAmount = amountStr !== '' && amountResult === null;
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
        if (photo) await repo.setEntryPhoto(created.id, photo);

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

  return (
    <div className="flex flex-col gap-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] select-none">
      {/* One sheet that fits an iPhone screen: type, amount, category, pad, details, save */}
      <TypeToggle value={type} onChange={handleTypeChange} />

      <AmountDisplay value={amountStr} type={type} />

      {isTransfer ? (
        <div className="flex items-center gap-2">
          {/* Both pickers list every wallet: choosing the one already on the other side swaps them,
              so money can move bank → cash as easily as cash → bank */}
          <WalletSelect label={t('from')} value={selectedWalletId} onChange={pickFromWallet} />
          <button
            type="button"
            onClick={swapWallets}
            aria-label={t('swapWallets')}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted transition-transform active:scale-90 cursor-pointer"
          >
            <ArrowRight className="size-5 rtl:rotate-180" />
          </button>
          <WalletSelect label={t('to')} value={selectedToWalletId} onChange={pickToWallet} />
        </div>
      ) : (
        <CategoryRow
          kind={type === 'income' ? 'income' : 'expense'}
          selected={selectedItem}
          onPick={handlePickCategoryItem}
          onClear={() => setSelectedItem(null)}
        />
      )}

      <AmountPad value={amountStr} onChange={setAmountStr} />

      {/* Wallet · date · note on one line */}
      <div className="flex items-center gap-2">
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

      <div className="flex gap-2">
        {/* Edit mode: Delete next to Save so the sheet still fits */}
        {mode === 'edit' && (
          <button
            type="button"
            onClick={handleDelete}
            aria-label={tCommon('delete')}
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger transition-transform active:scale-95 cursor-pointer"
          >
            <Trash2 className="size-6" />
          </button>
        )}
        {/* Receipt photo sits beside Save so the wallet/date/note labels keep their room */}
        <ReceiptPhoto photo={photo} onChange={handlePhotoChange} />
        <Button
          onClick={handleSave}
          disabled={!canSave}
          className="relative h-14 flex-1 rounded-2xl text-heading font-semibold text-accent-ink overflow-hidden cursor-pointer"
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
                {isInvalidAmount ? t('invalidAmount') : tCommon('save')}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}

function keepOpenForToasts(e: { target: EventTarget | null; preventDefault: () => void }) {
  if (e.target instanceof Element && e.target.closest('[data-sonner-toaster]')) e.preventDefault();
}

export function EntrySheet() {
  const t = useTranslations('entry');
  const { isOpen, mode, editingEntry, initialType, close } = useEntrySheet();

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && close()} repositionInputs>
      <DrawerContent
        className="max-h-[96dvh]"
        // Tapping Undo on a toast must not close the sheet
        onPointerDownOutside={keepOpenForToasts}
        onInteractOutside={keepOpenForToasts}
      >
        {/* Only this inner box may scroll: vaul hangs a 200%-tall strip under the sheet, which made the sheet itself
            scrollable, so tapping a lower chip slid the type toggle and amount out of view */}
        <div className="min-h-0 overflow-y-auto">
          <DrawerHeader className="px-4 pt-1 pb-2">
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}

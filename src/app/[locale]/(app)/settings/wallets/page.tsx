'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Archive,
  ChevronLeft,
  Edit2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { useRepository, useWallets, useWalletBalances } from '@/lib/data/provider';
import type { Wallet, WalletType } from '@/lib/data/types';
import { money, normalizeDigits, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';
import { ColorIconPicker } from '@/components/settings/ColorIconPicker';
import { useRestoreSheetAfterKeyboard } from '@/components/settings/useRestoreSheetAfterKeyboard';
import { AmountPad } from '@/components/entry/AmountPad';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

const noopSubscribe = () => () => {};

function readBackHref() {
  const from = new URLSearchParams(window.location.search).get('from');
  // Internal paths only ("/x", never "//host").
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/settings';
}

export default function WalletManagerPage() {
  const locale = useLocale();
  const t = useTranslations('settings');
  const tWallets = useTranslations('wallets');
  const repo = useRepository();

  const [showArchived, setShowArchived] = React.useState(false);

  // Opened from a header wallet shortcut (?from=<path>): back returns there.
  const backHref = React.useSyncExternalStore(noopSubscribe, readBackHref, () => '/settings');
  const wallets = useWallets(showArchived);
  const balances = useWalletBalances();

  const balanceMap = React.useMemo(() => {
    const map = new Map<string, number>();
    balances?.forEach((b) => map.set(b.id, b.balance));
    return map;
  }, [balances]);

  // Modal state
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [editingWallet, setEditingWallet] = React.useState<Wallet | null>(null);

  // Update Balance modal state
  const [isUpdateOpen, setIsUpdateOpen] = React.useState(false);
  const walletSheetRef = React.useRef<HTMLDivElement>(null);
  useRestoreSheetAfterKeyboard(walletSheetRef, isDrawerOpen);
  const [updatingWallet, setUpdatingWallet] = React.useState<Wallet | null>(null);
  const [updateAmountStr, setUpdateAmountStr] = React.useState('0');

  // Form states
  const [nameAr, setNameAr] = React.useState('');
  const [nameEn, setNameEn] = React.useState('');
  const [walletType, setWalletType] = React.useState<WalletType>('cash');
  const [openingBalanceStr, setOpeningBalanceStr] = React.useState('0');
  const [color, setColor] = React.useState('#15803D');
  const [icon, setIcon] = React.useState('wallet');

  const openAdd = () => {
    setEditingWallet(null);
    setNameAr('');
    setNameEn('');
    setWalletType('cash');
    setOpeningBalanceStr('0');
    setColor('#15803D');
    setIcon('wallet');
    setIsDrawerOpen(true);
  };

  const openEdit = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setNameAr(wallet.nameAr || '');
    setNameEn(wallet.nameEn || '');
    setWalletType(wallet.type);
    setOpeningBalanceStr(String(wallet.openingBalance || 0));
    setColor(wallet.color || '#15803D');
    setIcon(wallet.icon || 'wallet');
    setIsDrawerOpen(true);
  };

  const openUpdateBalance = (wallet: Wallet, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setUpdatingWallet(wallet);
    const curr = balanceMap.get(wallet.id) ?? wallet.openingBalance;
    setUpdateAmountStr(curr > 0 ? String(curr) : '0');
    setIsUpdateOpen(true);
  };

  const handleSaveAdjustment = async () => {
    if (!updatingWallet) return;
    const newBal = parseFloat(normalizeDigits(updateAmountStr)) || 0;
    try {
      const entry = await repo.adjustWalletBalance(updatingWallet.id, newBal);
      setIsUpdateOpen(false);
      if (entry) {
        toast.success(tWallets('balanceUpdated'), {
          action: {
            label: tWallets('undo'),
            onClick: async () => {
              await repo.softDeleteEntry(entry.id);
              toast.info(tWallets('undone'));
            },
          },
          duration: 6000,
        });
      } else {
        toast.info(tWallets('balanceUpdated'));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update balance');
    }
  };

  const handleSave = async () => {
    if (!nameAr.trim() && !nameEn.trim()) return;

    const openingBalance = parseFloat(normalizeDigits(openingBalanceStr)) || 0;

    try {
      if (editingWallet) {
        await repo.updateWallet(editingWallet.id, {
          nameAr: nameAr.trim() || null,
          nameEn: nameEn.trim() || null,
          type: walletType,
          openingBalance,
          color,
          icon,
        });
      } else {
        await repo.addWallet({
          nameAr: nameAr.trim() || null,
          nameEn: nameEn.trim() || null,
          type: walletType,
          openingBalance,
          color,
          icon,
        });
      }

      toast.success(t('saved'));
      setIsDrawerOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save wallet');
    }
  };

  const handleArchiveToggle = async (wallet: Wallet) => {
    try {
      const willArchive = !wallet.isArchived;
      await repo.archiveWallet(wallet.id, willArchive);
      toast.success(willArchive ? t('archive') : t('unarchive'));
      setIsDrawerOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to change wallet archive state');
    }
  };

  const walletTypes: { value: WalletType; label: string }[] = [
    { value: 'cash', label: t('walletCash') },
    { value: 'bank', label: t('walletBank') },
    { value: 'card', label: t('walletCard') },
    { value: 'wallet', label: t('walletElectronic') },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
      {/* ONE Top Header: back chevron + large title */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 shrink-0 flex items-center justify-between border-b border-line/30 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={backHref}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2"
            aria-label={t('back')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </Link>
          <h1 className="text-title font-bold text-ink truncate">
            {t('wallets')}
          </h1>
        </div>
      </div>

      {/* Toolbar with full-width Switch row */}
      <div className="px-5 py-2 shrink-0">
        <div className="flex h-11 items-center justify-between px-4 bg-surface rounded-2xl border border-line/40 select-none">
          <span className="text-body font-medium text-ink">{t('showArchived')}</span>
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 px-5 pb-24 space-y-2">
        <button
          type="button"
          onClick={openAdd}
          className="w-full flex items-center gap-3 p-2.5 bg-surface rounded-card border-2 border-dashed border-line/60 hover:border-accent text-accent font-semibold transition-all active:scale-[0.99] cursor-pointer"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent/12 text-accent">
            <Plus className="size-5" />
          </div>
          <span className="text-body">{t('addWallet')}</span>
        </button>

        {!wallets && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-card" />
            ))}
          </div>
        )}

        {wallets && (
          <div className="bg-surface rounded-card border border-line/40 shadow-sm divide-y divide-line/30 overflow-hidden">
            {wallets.map((wallet) => {
              const name = pickName(
                { name_ar: wallet.nameAr, name_en: wallet.nameEn },
                locale
              );
              const currentBal = balanceMap.get(wallet.id) ?? wallet.openingBalance;
              return (
                <div
                  key={wallet.id}
                  className={`flex items-center justify-between p-2.5 hover:bg-surface-2/40 transition-colors select-none ${
                    wallet.isArchived ? 'opacity-50' : ''
                  }`}
                >
                  <div
                    onClick={() => openEdit(wallet)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div
                      style={{
                        backgroundColor: `${wallet.color || '#15803D'}18`,
                        color: wallet.color || '#15803D',
                      }}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full"
                    >
                      <CategoryIcon name={wallet.icon || 'wallet'} className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-semibold text-ink leading-snug">
                        {name}
                      </div>
                      <div className="text-caption text-ink-muted tabular-nums">
                        {money(currentBal, locale)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ps-2">
                    <button
                      type="button"
                      onClick={(e) => openUpdateBalance(wallet, e)}
                      className="h-9 px-3 rounded-full bg-accent/12 text-accent text-caption font-semibold hover:bg-accent/20 active:scale-95 transition-all cursor-pointer"
                    >
                      {tWallets('updateBalance')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(wallet)}
                      className="p-2 rounded-full hover:bg-surface-2 text-ink-muted transition-colors cursor-pointer"
                      aria-label={t('editWallet')}
                    >
                      <Edit2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} repositionInputs>
        <DrawerContent ref={walletSheetRef} className="max-h-[92dvh]">
          {/* Only this inner box may scroll — scrolling the sheet itself is swallowed by vaul on iPhone */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
          <DrawerHeader className="px-0 pt-4 pb-2">
            <DrawerTitle className="text-title font-bold text-ink text-start">
              {editingWallet ? t('editWallet') : t('addWallet')}
            </DrawerTitle>
          </DrawerHeader>

          <div className="space-y-4 pt-2">
            {/* Arabic Name */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t('nameAr')}
              </label>
              <input
                type="text"
                dir="rtl"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثال: البنك الأهلي"
                className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-line/50 text-body text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* English Name */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t('nameEn')}
              </label>
              <input
                type="text"
                dir="ltr"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. National Bank"
                className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-line/50 text-body text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Wallet Type */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t('walletType')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {walletTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setWalletType(type.value)}
                    className={`h-11 rounded-xl text-caption font-semibold transition-all cursor-pointer ${
                      walletType === type.value
                        ? 'bg-accent text-accent-ink shadow-sm'
                        : 'bg-surface-2 text-ink-muted hover:text-ink'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opening Balance */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t('openingBalance')} (EGP)
              </label>
              <input
                type="text"
                value={openingBalanceStr}
                onChange={(e) => setOpeningBalanceStr(e.target.value)}
                placeholder="0"
                className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-line/50 text-body font-mono text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Color & Icon Picker */}
            <ColorIconPicker
              selectedColor={color}
              selectedIcon={icon}
              onSelectColor={setColor}
              onSelectIcon={setIcon}
            />

            {/* Archive section */}
            {editingWallet && (
              <div className="pt-2 border-t border-line/40 space-y-2">
                <button
                  type="button"
                  onClick={() => handleArchiveToggle(editingWallet)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-surface-2 text-ink hover:bg-surface-2/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Archive className="size-5 text-ink-muted" />
                    <span className="text-body font-semibold">
                      {editingWallet.isArchived ? t('unarchive') : t('archive')}
                    </span>
                  </div>
                </button>
                <p className="text-caption text-ink-muted leading-tight px-1">
                  {t('archiveHint')}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 h-13 rounded-2xl bg-surface-2 text-ink font-semibold active:scale-95 transition-all cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!nameAr.trim() && !nameEn.trim()}
                className="flex-1 h-13 rounded-2xl bg-accent text-accent-ink font-semibold shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {t('save')}
              </button>
            </div>
          </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Update Balance Drawer */}
      <Drawer open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DrawerContent className="max-h-[92dvh] select-none">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
          <DrawerHeader className="px-0 pt-3 pb-1 text-center">
            <DrawerTitle className="text-body font-semibold text-ink">
              {updatingWallet &&
                tWallets('howMuchNow', {
                  wallet:
                    pickName(
                      { name_ar: updatingWallet.nameAr, name_en: updatingWallet.nameEn },
                      locale
                    ) || updatingWallet.id,
                })}
            </DrawerTitle>
          </DrawerHeader>

          <div className="py-2 text-center">
            <div className="text-display font-bold tabular-nums text-ink">
              {money(parseFloat(normalizeDigits(updateAmountStr)) || 0, locale)}
            </div>
            <span className="text-caption text-ink-muted">
              {tWallets('actualBalance')}
            </span>
          </div>

          <div className="py-2">
            <AmountPad value={updateAmountStr} onChange={setUpdateAmountStr} />
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={() => setIsUpdateOpen(false)}
              className="flex-1 h-13 rounded-2xl bg-surface-2 text-ink font-semibold active:scale-95 transition-all cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveAdjustment}
              className="flex-1 h-13 rounded-2xl bg-accent text-accent-ink font-semibold shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              {t('save')}
            </button>
          </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

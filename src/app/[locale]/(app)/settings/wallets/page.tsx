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
import { useRepository, useWallets } from '@/lib/data/provider';
import type { Wallet, WalletType } from '@/lib/data/types';
import { money, normalizeDigits, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';
import { ColorIconPicker } from '@/components/settings/ColorIconPicker';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';

export default function WalletManagerPage() {
  const locale = useLocale();
  const t = useTranslations('settings');
  const repo = useRepository();

  const [showArchived, setShowArchived] = React.useState(false);
  const wallets = useWallets(showArchived);

  // Modal state
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [editingWallet, setEditingWallet] = React.useState<Wallet | null>(null);

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
      {/* Header */}
      <div className="px-5 pt-2 pb-3 shrink-0 flex items-center justify-between border-b border-line/30 select-none">
        <Link
          href="/settings"
          className="flex items-center gap-1 text-accent font-semibold text-body hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="size-5 rtl:rotate-180" />
          <span>{t('back')}</span>
        </Link>
        <h2 className="text-heading font-semibold text-ink">
          {t('wallets')}
        </h2>
        <div className="w-12" aria-hidden="true" />
      </div>

      {/* Toolbar */}
      <div className="px-5 py-3 flex items-center justify-between shrink-0">
        <label className="flex items-center gap-2 text-caption text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="size-4 rounded accent-accent"
          />
          <span>{t('showArchived')}</span>
        </label>
      </div>

      {/* Main List */}
      <div className="flex-1 px-5 pb-24 space-y-2">
        <button
          type="button"
          onClick={openAdd}
          className="w-full flex items-center gap-3 p-3.5 bg-surface rounded-card border-2 border-dashed border-line/60 hover:border-accent text-accent font-semibold transition-all active:scale-[0.99] cursor-pointer"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
            <Plus className="size-5" />
          </div>
          <span className="text-body">{t('addWallet')}</span>
        </button>

        {!wallets && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-card" />
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
              return (
                <div
                  key={wallet.id}
                  onClick={() => openEdit(wallet)}
                  className={`flex items-center justify-between p-3.5 hover:bg-surface-2/40 active:bg-surface-2 transition-colors cursor-pointer select-none ${
                    wallet.isArchived ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={{
                        backgroundColor: `${wallet.color || '#15803D'}18`,
                        color: wallet.color || '#15803D',
                      }}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full"
                    >
                      <CategoryIcon name={wallet.icon || 'wallet'} className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-body font-semibold text-ink">
                        {name}
                      </div>
                      <div className="text-caption text-ink-muted">
                        <span>{t('openingBalance')}: </span>
                        <span className="tabular-nums font-medium text-ink">
                          {money(wallet.openingBalance, locale)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="p-2 rounded-full hover:bg-surface-2 text-ink-muted transition-colors"
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
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[92dvh] px-5 pb-8 overflow-y-auto">
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
        </DrawerContent>
      </Drawer>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { useWallets } from '@/lib/data/provider';
import { CategoryIcon } from '@/components/ui/category-icon';
import { pickName } from '@/lib/format';

export interface WalletPickerProps {
  value?: string | null;
  onChange: (walletId: string) => void;
  exclude?: string | null;
  className?: string;
}

export function WalletPicker({
  value,
  onChange,
  exclude,
  className = '',
}: WalletPickerProps) {
  const locale = useLocale();
  const wallets = useWallets();

  const availableWallets = React.useMemo(() => {
    if (!wallets) return [];
    return wallets.filter((w) => !exclude || w.id !== exclude);
  }, [wallets, exclude]);

  return (
    <div
      role="radiogroup"
      aria-label="Select wallet"
      className={`flex flex-wrap gap-2.5 select-none ${className}`}
    >
      {availableWallets.map((wallet) => {
        const isSelected = value === wallet.id;
        const name = pickName(
          { name_ar: wallet.nameAr, name_en: wallet.nameEn },
          locale
        );

        return (
          <button
            key={wallet.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(wallet.id)}
            className={`inline-flex min-h-[48px] items-center gap-2.5 rounded-2xl px-4 py-2 text-body font-semibold transition-all active:scale-95 ${
              isSelected
                ? 'bg-accent text-accent-ink shadow-card'
                : 'bg-surface-2 text-ink hover:bg-line/70'
            }`}
          >
            <CategoryIcon
              name={wallet.icon}
              className={`size-5 ${isSelected ? 'text-accent-ink' : 'text-accent'}`}
            />
            <span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Banknote, Building2, CreditCard, Wallet as WalletIcon } from 'lucide-react';
import { useWalletBalances } from '@/lib/data/provider';
import type { WalletType } from '@/lib/data/types';
import { Card } from '@/components/ui/card';
import { money, pickName } from '@/lib/format';

export interface WalletBalancesCardProps {
  className?: string;
}

function getWalletTypeIcon(type: WalletType) {
  switch (type) {
    case 'cash':
      return Banknote;
    case 'bank':
      return Building2;
    case 'card':
      return CreditCard;
    case 'wallet':
    default:
      return WalletIcon;
  }
}

export function WalletBalancesCard({ className = '' }: WalletBalancesCardProps) {
  const locale = useLocale();
  const t = useTranslations('reports');
  const wallets = useWalletBalances();

  return (
    <Card className={`rounded-card bg-surface p-3.5 shadow-card select-none gap-0 ${className}`}>
      <h2 className="text-heading font-semibold text-ink mb-2">
        {t('walletBalances')}
      </h2>

      {!wallets ? (
        <div className="space-y-2">
          <div className="h-10 rounded-xl bg-surface-2 animate-pulse" />
          <div className="h-10 rounded-xl bg-surface-2 animate-pulse" />
        </div>
      ) : wallets.length === 0 ? (
        <p className="text-body text-ink-muted text-center py-3">
          {t('noData')}
        </p>
      ) : (
        <div className="divide-y divide-line">
          {wallets.map((wallet) => {
            const name =
              pickName({ name_ar: wallet.nameAr, name_en: wallet.nameEn }, locale) ||
              wallet.id;
            const Icon = getWalletTypeIcon(wallet.type);
            const color = wallet.color || 'var(--accent)';

            return (
              <div
                key={wallet.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    style={{
                      backgroundColor: `${color}18`,
                      color: color,
                    }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full"
                  >
                    <Icon className="size-4" />
                  </div>
                  <span className="text-body font-semibold text-ink truncate">
                    {name}
                  </span>
                </div>

                <span
                  className={`text-body font-bold tabular-nums shrink-0 ps-2 ${
                    wallet.balance >= 0 ? 'text-ink' : 'text-expense'
                  }`}
                >
                  {money(wallet.balance, locale)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

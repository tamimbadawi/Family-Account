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

  const getTypeName = (type: WalletType) => {
    switch (type) {
      case 'cash':
        return t('cash');
      case 'bank':
        return t('bank');
      case 'card':
        return t('card');
      case 'wallet':
        return t('digitalWallet');
      default:
        return type;
    }
  };

  return (
    <Card className={`rounded-card bg-surface p-4 shadow-card select-none ${className}`}>
      <h2 className="text-caption font-bold text-ink mb-2">
        {t('walletBalances')}
      </h2>

      {!wallets ? (
        <div className="space-y-2">
          <div className="h-10 rounded-xl bg-surface-2 animate-pulse" />
          <div className="h-10 rounded-xl bg-surface-2 animate-pulse" />
        </div>
      ) : wallets.length === 0 ? (
        <p className="text-caption text-ink-muted text-center py-3">
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
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    style={{
                      backgroundColor: `${color}18`,
                      color: color,
                    }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full"
                  >
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-caption font-semibold text-ink leading-tight">
                      {name}
                    </p>
                    <p className="text-xs text-ink-muted leading-tight mt-0.5">
                      {getTypeName(wallet.type)}
                    </p>
                  </div>
                </div>

                <div className="text-end">
                  <span
                    className={`text-body font-bold tabular-nums ${
                      wallet.balance >= 0 ? 'text-ink' : 'text-expense'
                    }`}
                  >
                    {money(wallet.balance, locale)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

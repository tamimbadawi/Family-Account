'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Banknote, Building2, CreditCard, Wallet as WalletIcon } from 'lucide-react';
import { useInvestments, useWalletBalances } from '@/lib/data/provider';
import type { WalletType } from '@/lib/data/types';
import { Card } from '@/components/ui/card';
import { money, pickName } from '@/lib/format';
import { OurMoneySheet } from '@/components/wallets/OurMoneySheet';
import { CategoryIcon } from '@/components/ui/category-icon';

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
  const tMoney = useTranslations('money');
  const walletBalances = useWalletBalances();
  const investments = useInvestments(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  if (!walletBalances || investments === undefined) {
    return (
      <Card
        className={`rounded-card bg-surface p-3.5 shadow-card select-none gap-0 ${className}`}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-heading font-semibold text-ink">
            {t('walletBalances')}
          </h2>
          <span className="text-caption font-medium text-accent">
            {locale.startsWith('ar') ? 'عرض الكل' : 'View all'}
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-10 rounded-xl bg-surface-2 animate-pulse" />
          <div className="h-10 rounded-xl bg-surface-2 animate-pulse" />
        </div>
      </Card>
    );
  }

  const formatSubtotal = (items: { currency?: string; amount: number }[]) => {
    const byCurrency = new Map<string, number>();
    for (const item of items) {
      const cur = item.currency || 'EGP';
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + item.amount);
    }
    return [...byCurrency.entries()]
      .map(([cur, amount]) => money(amount, locale, { currency: cur || undefined }))
      .join(' + ');
  };

  const spending = walletBalances.filter(
    (w) => !w.isArchived && (w.purpose ?? 'spending') === 'spending'
  );
  const goal = walletBalances.filter(
    (w) => !w.isArchived && w.purpose === 'goal'
  );
  const investment = investments.filter((w) => !w.isArchived);

  const spendingRows = spending.map((w) => ({
    id: w.id,
    nameAr: w.nameAr,
    nameEn: w.nameEn,
    type: w.type,
    icon: w.icon,
    color: w.color,
    currency: w.currency,
    amount: w.balance,
  }));

  const goalRows = goal.map((w) => ({
    id: w.id,
    nameAr: w.nameAr,
    nameEn: w.nameEn,
    type: w.type,
    icon: w.icon,
    color: w.color,
    currency: w.currency,
    amount: w.balance,
  }));

  const investmentRows = investment.map((w) => ({
    id: w.id,
    nameAr: w.nameAr,
    nameEn: w.nameEn,
    type: w.type,
    icon: w.icon,
    color: w.color,
    currency: w.currency,
    amount: w.worth,
  }));

  const groups = [
    {
      key: 'spending',
      heading: tMoney('groupSpending'),
      subtotal: formatSubtotal(spendingRows),
      rows: spendingRows,
    },
    {
      key: 'goal',
      heading: tMoney('groupGoals'),
      subtotal: formatSubtotal(goalRows),
      rows: goalRows,
    },
    {
      key: 'investment',
      heading: tMoney('groupInvestments'),
      subtotal: formatSubtotal(investmentRows),
      rows: investmentRows,
    },
  ].filter((g) => g.rows.length > 0);

  return (
    <>
      <Card
        onClick={() => setSheetOpen(true)}
        className={`rounded-card bg-surface p-3.5 shadow-card select-none gap-0 cursor-pointer hover:bg-surface-2/40 transition-colors ${className}`}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-heading font-semibold text-ink">
            {t('walletBalances')}
          </h2>
          <span className="text-caption font-medium text-accent">
            {locale.startsWith('ar') ? 'عرض الكل' : 'View all'}
          </span>
        </div>

        {groups.length === 0 ? (
          <p className="text-body text-ink-muted text-center py-3">
            {t('noData')}
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group, groupIndex) => (
              <div
                key={group.key}
                className={groupIndex > 0 ? 'border-t border-line pt-2.5' : ''}
              >
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-caption font-semibold text-ink-muted">
                    {group.heading}
                  </span>
                  <span className="text-caption font-semibold tabular-nums text-ink-muted">
                    {group.subtotal}
                  </span>
                </div>
                <div className="divide-y divide-line">
                  {group.rows.map((row) => {
                    const name =
                      pickName({ name_ar: row.nameAr, name_en: row.nameEn }, locale) ||
                      row.id;
                    const Icon = getWalletTypeIcon(row.type);
                    const color = row.color || 'var(--accent)';

                    return (
                      <div
                        key={row.id}
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
                            {row.icon ? (
                              <CategoryIcon name={row.icon} className="size-4" />
                            ) : (
                              <Icon className="size-4" />
                            )}
                          </div>
                          <span className="text-body font-semibold text-ink truncate">
                            {name}
                          </span>
                        </div>

                        <span
                          className={`text-body font-bold tabular-nums shrink-0 ps-2 ${
                            row.amount >= 0 ? 'text-ink' : 'text-expense'
                          }`}
                        >
                          {money(row.amount, locale, { currency: row.currency })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <OurMoneySheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}

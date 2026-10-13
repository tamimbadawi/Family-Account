'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useInvestments, useWalletBalances } from '@/lib/data/provider';
import { Card } from '@/components/ui/card';
import { money } from '@/lib/format';

export interface WalletBalancesCardProps {
  className?: string;
}

export function WalletBalancesCard({ className = '' }: WalletBalancesCardProps) {
  const locale = useLocale();
  const t = useTranslations('reports');
  const tMoney = useTranslations('money');
  const walletBalances = useWalletBalances();
  const investments = useInvestments(false);

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
            {tMoney('viewAll')}
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-14 rounded-xl bg-surface-2 animate-pulse" />
          <div className="h-14 rounded-xl bg-surface-2 animate-pulse" />
        </div>
      </Card>
    );
  }

  /** Format per-currency subtotal, never crossing currencies. */
  const formatSubtotal = (items: { currency?: string; amount: number }[]) => {
    const byCurrency = new Map<string, number>();
    for (const item of items) {
      const cur = item.currency || 'EGP';
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + item.amount);
    }
    if (byCurrency.size === 0) return money(0, locale);
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

  const groups: { key: string; label: string; subtotal: string; href: string }[] = [];
  if (spending.length > 0) {
    groups.push({
      key: 'spending',
      label: tMoney('groupSpending'),
      subtotal: formatSubtotal(spending.map((w) => ({ currency: w.currency, amount: w.balance }))),
      href: '/money',
    });
  }
  if (goal.length > 0) {
    groups.push({
      key: 'goal',
      label: tMoney('groupGoals'),
      subtotal: formatSubtotal(goal.map((w) => ({ currency: w.currency, amount: w.balance }))),
      href: '/money?tab=saving',
    });
  }
  if (investment.length > 0) {
    groups.push({
      key: 'investment',
      label: tMoney('groupInvestments'),
      subtotal: formatSubtotal(investment.map((w) => ({ currency: w.currency, amount: w.worth }))),
      href: '/money?tab=saving',
    });
  }

  return (
    <Card
      className={`rounded-card bg-surface p-3.5 shadow-card select-none gap-0 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-heading font-semibold text-ink">
          {t('walletBalances')}
        </h2>
        <Link
          href="/money"
          className="text-caption font-medium text-accent"
        >
          {tMoney('viewAll')}
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="text-body text-ink-muted text-center py-3">
          {t('noData')}
        </p>
      ) : (
        <div className="divide-y divide-line">
          {groups.map((group) => (
            <Link
              key={group.key}
              href={group.href}
              className="flex min-h-14 items-center justify-between gap-3 py-2 transition-colors hover:bg-surface-2/40 active:bg-surface-2/60 -mx-1 px-1 rounded-xl"
            >
              <span className="text-body font-semibold text-ink">
                {group.label}
              </span>
              <div className="flex items-center gap-1 shrink-0 ps-2">
                <span className="text-body font-bold tabular-nums text-ink">
                  {group.subtotal}
                </span>
                <ChevronRight className="size-4 text-ink-muted rtl:rotate-180 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

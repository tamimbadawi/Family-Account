'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useEntries } from '@/lib/data/provider';
import type { EnrichedEntry, EnrichedSavingsGoal } from '@/lib/data/types';
import { money, pickName } from '@/lib/format';
import { formatDmy } from '@/components/entry/DetailsRow';

/** Everything that went into or came out of a goal's wallet, newest first. Tapping one opens it for editing. */
export function GoalEntries({
  goal,
  onOpenEntry,
}: {
  goal: EnrichedSavingsGoal;
  onOpenEntry: (entry: EnrichedEntry) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('goals');
  const entries = useEntries({ accountId: goal.walletId });

  if (entries === undefined) return null;
  if (entries.length === 0) {
    return <p className="py-8 text-center text-body text-ink-muted">{t('noEntriesYet')}</p>;
  }

  const sorted = [...entries].sort(
    (a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <div className="divide-y divide-line/40 rounded-card border border-line/40 bg-surface shadow-card">
      {sorted.map((entry) => {
        // Money comes in when the goal's wallet is the destination of a move, or money-in was recorded on it
        const isIn = entry.type === 'transfer' ? entry.toAccountId === goal.walletId : entry.type === 'income';
        const otherWallet =
          entry.type === 'transfer'
            ? isIn
              ? pickName({ name_ar: entry.accountNameAr, name_en: entry.accountNameEn }, locale)
              : pickName({ name_ar: entry.toAccountNameAr, name_en: entry.toAccountNameEn }, locale)
            : '';
        const title =
          entry.type === 'transfer'
            ? t(isIn ? 'addedFrom' : 'takenTo', { wallet: otherWallet })
            : pickName({ name_ar: entry.itemNameAr, name_en: entry.itemNameEn }, locale) ||
              pickName({ name_ar: entry.categoryNameAr, name_en: entry.categoryNameEn }, locale);
        // A move between two currencies arrives as its own amount
        const amount = entry.type === 'transfer' && isIn ? (entry.toAmount ?? entry.amount) : entry.amount;

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onOpenEntry(entry)}
            className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-start transition-colors active:bg-surface-2 cursor-pointer"
          >
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                isIn ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'
              }`}
            >
              {isIn ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold text-ink leading-tight break-words">{title}</div>
              <div dir="ltr" className="text-caption text-ink-muted tabular-nums leading-tight text-start">
                {formatDmy(entry.occurredOn)}
              </div>
            </div>
            <span className={`shrink-0 text-body font-bold tabular-nums ${isIn ? 'text-income' : 'text-expense'}`}>
              {isIn ? '+' : '−'}
              {money(amount, locale, { currency: entry.accountCurrency ?? undefined })}
            </span>
          </button>
        );
      })}
    </div>
  );
}

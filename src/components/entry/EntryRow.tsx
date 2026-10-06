'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { ArrowLeftRight } from 'lucide-react';
import type { EnrichedEntry } from '@/lib/data/types';
import { CategoryIcon } from '@/components/ui/category-icon';
import { money, pickName } from '@/lib/format';

export interface EntryRowProps {
  entry: EnrichedEntry;
  onClick?: () => void;
}

export function EntryRow({ entry, onClick }: EntryRowProps) {
  const locale = useLocale();

  const isTransfer = entry.type === 'transfer';
  const isIncome = entry.type === 'income';

  // Localised names
  const itemName = pickName(
    { name_ar: entry.itemNameAr, name_en: entry.itemNameEn },
    locale
  );
  const categoryName = pickName(
    { name_ar: entry.categoryNameAr, name_en: entry.categoryNameEn },
    locale
  );
  const walletName = pickName(
    { name_ar: entry.accountNameAr, name_en: entry.accountNameEn },
    locale
  );
  const toWalletName = pickName(
    { name_ar: entry.toAccountNameAr, name_en: entry.toAccountNameEn },
    locale
  );

  const title = itemName || categoryName || (isTransfer ? `${walletName} → ${toWalletName}` : '');
  const subtitle = isTransfer
    ? `${walletName} → ${toWalletName}`
    : categoryName && walletName
    ? `${categoryName} · ${walletName}`
    : categoryName || walletName;

  let amountClass = 'text-expense';
  let sign = '-';
  if (isIncome) {
    amountClass = 'text-income';
    sign = '+';
  } else if (isTransfer) {
    amountClass = 'text-transfer';
    sign = '';
  }

  // Tinted circle style
  let circleStyle: React.CSSProperties | undefined;
  let circleClass = 'bg-expense-soft text-expense';

  if (isIncome) {
    circleClass = 'bg-income-soft text-income';
  } else if (isTransfer) {
    circleClass = 'bg-surface-2 text-transfer';
  } else if (entry.categoryColor) {
    circleClass = '';
    circleStyle = {
      backgroundColor: `${entry.categoryColor}18`,
      color: entry.categoryColor,
    };
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className="flex min-h-[48px] items-center justify-between gap-3 py-2 transition-colors active:bg-surface-2/40 select-none cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          style={circleStyle}
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${circleClass}`}
        >
          {isTransfer ? (
            <ArrowLeftRight className="size-5" />
          ) : (
            <CategoryIcon name={entry.categoryIcon} className="size-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-body font-medium text-ink leading-snug">
            {title}
          </div>
          <div className="truncate text-caption text-ink-muted leading-tight">
            {subtitle}
          </div>
        </div>
      </div>

      <div className={`shrink-0 text-body font-bold tabular-nums ${amountClass}`}>
        {sign}
        {money(entry.amount, locale)}
      </div>
    </div>
  );
}

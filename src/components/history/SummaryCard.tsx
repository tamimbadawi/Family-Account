'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { money } from '@/lib/format';
import type { Period } from '@/lib/history/period';
import type { CategoryPick } from '@/lib/history/filters';
import type { HistorySummary } from '@/lib/history/summary';

/**
 * The total of what the list shows after a search or filter ("bread" → spent 1,240 this month, 18 times).
 * When it is all one item, a button opens that item's history card.
 */
export function SummaryCard({
  summary,
  period,
  onOpenItem,
}: {
  summary: HistorySummary;
  period: Period;
  onOpenItem?: (pick: CategoryPick) => void;
}) {
  const t = useTranslations('history');
  const locale = useLocale();
  const { spent, received, count, item } = summary;

  return (
    <div className="mx-5 mt-3 rounded-card bg-surface p-4 shadow-card select-none" data-history-summary aria-label={t('summaryLabel')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-caption text-ink-muted tabular-nums">
          {t(`times.${period}`, { count })}
        </div>
        {item && onOpenItem && (
          <button
            type="button"
            onClick={() => onOpenItem(item)}
            className="-my-3 -me-2 flex min-h-12 shrink-0 items-center gap-1 rounded-full px-2 text-caption font-semibold text-accent cursor-pointer active:scale-95 transition-transform"
          >
            <span>{t('seeHistory')}</span>
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
          </button>
        )}
      </div>

      <div className="mt-2 space-y-1">
        {(spent > 0 || received === 0) && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-body text-ink">{t('expenses')}</span>
            <span className="text-title font-bold tabular-nums text-expense">{money(spent, locale)}</span>
          </div>
        )}
        {received > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-body text-ink">{t('incomes')}</span>
            <span className={`${spent > 0 ? 'text-heading' : 'text-title'} font-bold tabular-nums text-income`}>
              +{money(received, locale)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

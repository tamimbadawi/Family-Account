'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { useEntries, useRepository } from '@/lib/data/provider';
import type { EnrichedEntry } from '@/lib/data/types';
import { formatDay, money, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecentlyDeletedPage() {
  const locale = useLocale();
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const repo = useRepository();

  const deletedEntries = useEntries({ onlyDeleted: true });
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  const handleRestore = async (entry: EnrichedEntry) => {
    try {
      setRestoringId(entry.id);
      await repo.restoreEntry(entry.id);
      toast.success(t('restored') + ' ✓', {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            await repo.softDeleteEntry(entry.id);
            toast.info(t('recentlyDeleted'));
          },
        },
        duration: 6000,
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to restore entry');
    } finally {
      setRestoringId(null);
    }
  };

  const isLoading = deletedEntries === undefined;
  const isEmpty = deletedEntries !== undefined && deletedEntries.length === 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
      {/* ONE Top Header: back chevron + large title */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 shrink-0 flex items-center justify-between border-b border-line/30 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/settings"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2"
            aria-label={t('back')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </Link>
          <h1 className="text-title font-bold text-ink truncate">
            {t('recentlyDeleted')}
          </h1>
        </div>
      </div>

      {/* Description header */}
      <div className="px-5 py-3 bg-surface-2/50 border-b border-line/20">
        <p className="text-caption text-ink-muted leading-relaxed">
          {t('recentlyDeletedDesc')}
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 px-5 py-4 pb-24">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3.5 bg-surface rounded-card border border-line/40"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-9 w-20 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-center select-none">
            <div className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-ink-muted mb-3">
              <Trash2 className="size-8 stroke-[1.5]" />
            </div>
            <h3 className="text-heading font-semibold text-ink mb-1">
              {t('noDeletedEntries')}
            </h3>
          </div>
        )}

        {!isLoading && !isEmpty && (
          <div className="space-y-3">
            {deletedEntries.map((entry) => {
              const isTransfer = entry.type === 'transfer';
              const isIncome = entry.type === 'income';

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

              const title =
                itemName ||
                categoryName ||
                (isTransfer ? `${walletName}` : '');

              let circleClass = 'bg-expense-soft text-expense';
              let circleStyle: React.CSSProperties | undefined;

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
                  key={entry.id}
                  className="flex items-center justify-between gap-3 p-3.5 bg-surface rounded-card border border-line/40 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={circleStyle}
                      className={`flex size-11 shrink-0 items-center justify-center rounded-full ${circleClass}`}
                    >
                      <CategoryIcon name={entry.categoryIcon} className="size-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-body font-semibold text-ink">
                        {title}
                      </div>
                      <div className="flex items-center gap-2 text-caption text-ink-muted">
                        <span>{formatDay(entry.occurredOn, locale)}</span>
                        <span>·</span>
                        <span className="tabular-nums font-medium text-ink">
                          {money(entry.amount, locale)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={restoringId === entry.id}
                    onClick={() => handleRestore(entry)}
                    className="flex shrink-0 items-center gap-1.5 h-10 px-3.5 rounded-xl bg-accent/15 text-accent font-semibold text-caption hover:bg-accent/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="size-4" />
                    <span>{t('restore')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

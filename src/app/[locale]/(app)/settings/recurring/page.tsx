'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, ChevronLeft, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { useRecurringRules, useRepository } from '@/lib/data/provider';
import { useSaveError } from '@/components/ui/use-save-error';
import type { EnrichedRecurringRule } from '@/lib/data/types';
import { money, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecurringSettingsPage() {
  const locale = useLocale();
  const t = useTranslations('recurring');
  const tCommon = useTranslations('common');
  const repo = useRepository();
  const saveError = useSaveError();

  const rules = useRecurringRules(false);
  const [stoppingId, setStoppingId] = React.useState<string | null>(null);

  const handleStop = async (rule: EnrichedRecurringRule) => {
    try {
      setStoppingId(rule.id);
      await repo.archiveRecurringRule(rule.id, true);
      toast(t('stopped') + ' ✓', {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              await repo.archiveRecurringRule(rule.id, false);
              toast.info(t('restored'));
            } catch (err) {
              saveError(err);
            }
          },
        },
        duration: 6000,
      });
    } catch (err) {
      saveError(err);
    } finally {
      setStoppingId(null);
    }
  };

  const isLoading = rules === undefined;
  const isEmpty = rules !== undefined && rules.length === 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
      {/* Top Header: back chevron + title & subtitle */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 shrink-0 flex items-center justify-between border-b border-line/30 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/settings"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2 cursor-pointer"
            aria-label={t('back')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-title font-bold text-ink leading-tight truncate">
              {t('title')}
            </h1>
            <p className="text-caption text-ink-muted leading-tight truncate">
              {t('subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-5 py-4 space-y-3 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)]">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center justify-between p-4 bg-surface rounded-card border border-line/40">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-2xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <Skeleton className="h-10 w-20 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center text-center p-8 mt-6 bg-surface rounded-card border border-line/40 shadow-card">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted/50 mb-3">
              <Repeat className="size-8" />
            </div>
            <h2 className="text-heading font-semibold text-ink mb-1">
              {t('emptyTitle')}
            </h2>
            <p className="text-body text-ink-muted max-w-xs leading-relaxed">
              {t('emptyDesc')}
            </p>
          </div>
        )}

        {!isLoading && !isEmpty && rules && (
          <div className="space-y-3">
            {rules.map((rule) => {
              const isTransfer = rule.type === 'transfer';
              const name = isTransfer
                ? t('fromTo', {
                    from: pickName({ name_ar: rule.accountNameAr, name_en: rule.accountNameEn }, locale),
                    to: pickName({ name_ar: rule.toAccountNameAr, name_en: rule.toAccountNameEn }, locale),
                  })
                : pickName(
                    {
                      name_ar: rule.itemNameAr ?? rule.categoryNameAr,
                      name_en: rule.itemNameEn ?? rule.categoryNameEn,
                    },
                    locale
                  );

              const dayText = t('dayOfMonth', { day: rule.dayOfMonth });
              const isStopping = stoppingId === rule.id;

              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-3 p-4 bg-surface rounded-card border border-line/40 shadow-card select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Icon */}
                    <div
                      className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: rule.categoryColor ? `${rule.categoryColor}18` : undefined,
                        color: rule.categoryColor ?? undefined,
                      }}
                    >
                      {isTransfer ? (
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-surface-2 text-ink">
                          <ArrowRight className="size-5 rtl:rotate-180" />
                        </div>
                      ) : (
                        <CategoryIcon name={rule.categoryIcon} className="size-5" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-semibold text-ink truncate leading-tight">
                        {name}
                      </div>
                      <div className="text-caption text-ink-muted leading-tight mt-0.5 truncate">
                        {dayText}
                        {rule.note ? ` · ${rule.note}` : ''}
                      </div>
                      <div className="text-body font-bold text-ink tabular-nums mt-1 leading-tight">
                        {money(rule.amount, locale)}
                      </div>
                    </div>
                  </div>

                  {/* Stop action button with tap target >= 48px */}
                  <button
                    type="button"
                    onClick={() => handleStop(rule)}
                    disabled={isStopping}
                    aria-label={`${t('stop')} ${name}`}
                    className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl bg-danger/10 px-3.5 py-2 text-body font-semibold text-danger transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {t('stop')}
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

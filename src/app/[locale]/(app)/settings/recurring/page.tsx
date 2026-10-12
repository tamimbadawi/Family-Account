'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, ChevronLeft, Plus, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { useRecurringRules, useRepository } from '@/lib/data/provider';
import { useSaveError } from '@/components/ui/use-save-error';
import type { EnrichedRecurringRule } from '@/lib/data/types';
import { money, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { useRecurrenceSummary } from '@/components/entry/useRecurrenceSummary';

export default function RecurringSettingsPage() {
  const locale = useLocale();
  const t = useTranslations('recurring');
  const tCommon = useTranslations('common');
  const repo = useRepository();
  const saveError = useSaveError();
  const { openAdd } = useEntrySheet();
  const summarize = useRecurrenceSummary();

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

  const handleAddNew = () => openAdd('expense', { initialRecurring: true });

  const isLoading = rules === undefined;
  const isEmpty = rules !== undefined && rules.length === 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
      {/* Top Header: back chevron + title & subtitle + New button */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 shrink-0 flex items-center justify-between border-b border-line/30 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/settings"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2 cursor-pointer"
            aria-label={t('back')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </Link>
          <h1 className="text-title font-bold text-ink leading-tight">
            {t('title')}
          </h1>
        </div>

        {/* + New button */}
        <button
          type="button"
          onClick={handleAddNew}
          aria-label={t('addNew')}
          className="flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-2xl bg-accent px-3.5 text-body font-semibold text-accent-ink transition-transform active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="size-5" />
          <span>{t('addNew')}</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-5 py-4 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)]">
        <p className="text-body text-ink-muted leading-relaxed">
          {t('subtitle')}
        </p>
        {isEmpty && (
          <div className="flex flex-col items-center text-center py-8 px-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent mb-3">
              <Repeat className="size-8" />
            </div>
            <h2 className="text-heading font-semibold text-ink mb-1">
              {t('emptyTitle')}
            </h2>
            <p className="text-body text-ink-muted max-w-xs leading-relaxed mb-5">
              {t('emptyDesc')}
            </p>
            <button
              type="button"
              onClick={handleAddNew}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-6 text-body font-semibold text-accent-ink transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="size-5" />
              {t('addRecurring')}
            </button>
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

              const scheduleText = summarize(rule);
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
                        {scheduleText}
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

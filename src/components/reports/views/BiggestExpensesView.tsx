'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Layers } from 'lucide-react';
import { useEntries } from '@/lib/data/provider';
import { calculateBiggestExpenses } from '@/lib/reports/biggest-expenses';
import { resolvePresetPeriod, type PresetPeriod } from '@/lib/reports/presets';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Card } from '@/components/ui/card';
import { money, pickName } from '@/lib/format';
import { CellEntriesSheet } from '../CellEntriesSheet';

export function BiggestExpensesView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const { openEdit } = useEntrySheet();
  const [periodPreset, setPeriodPreset] = React.useState<PresetPeriod>('this-month');
  const [showAllSheet, setShowAllSheet] = React.useState(false);

  const entries = useEntries();

  const period = React.useMemo(() => {
    return resolvePresetPeriod(periodPreset);
  }, [periodPreset]);

  const result = React.useMemo(() => {
    if (!entries) return null;
    return calculateBiggestExpenses(entries, period, 10);
  }, [entries, period]);

  if (!result) return null;

  const visibleEntries = result.entries.slice(0, 4);

  return (
    <div className="space-y-2 select-none">
      {/* Period Chips */}
      <div className="flex items-center gap-1.5 p-0.5">
        {[
          { id: 'this-month', key: 'thisMonth' },
          { id: 'last-6-months', key: 'last6' },
          { id: 'this-year', key: 'thisYear' },
        ].map((p) => {
          const isSelected = periodPreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodPreset(p.id as PresetPeriod)}
              className={`flex-1 h-8 rounded-full text-caption font-semibold transition-all active:scale-95 text-center px-1 whitespace-nowrap ${
                isSelected
                  ? 'bg-accent text-accent-ink shadow-xs'
                  : 'bg-surface-2 text-ink-muted hover:text-ink'
              }`}
            >
              {t(`periods.${p.key}`)}
            </button>
          );
        })}
      </div>

      {/* Summary Row */}
      <div className="flex items-center justify-between px-1">
        <span className="text-body font-semibold text-ink">
          {t('library.biggestExpenses')}
        </span>
        <span className="text-body font-bold tabular-nums text-expense">
          {money(result.totalAmount, locale, { fractionDigits: 0 })}
        </span>
      </div>

      {/* List Card - Fits on screen without scrolling */}
      <Card className="rounded-card bg-surface shadow-card border border-line/60 overflow-hidden p-0 gap-0">
        <div className="px-4 divide-y divide-line/40">
          {result.entries.length === 0 ? (
            <div className="py-12 text-center text-ink-muted">
              <Layers className="size-8 mx-auto text-ink-faint mb-2" />
              <p className="text-body font-medium">{t('emptyEntries')}</p>
            </div>
          ) : (
            visibleEntries.map((entry) => {
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
              const title = itemName || categoryName;
              const subtitle =
                categoryName && walletName
                  ? `${categoryName} · ${walletName}`
                  : categoryName || walletName;

              return (
                <div
                  key={entry.id}
                  onClick={() => openEdit(entry)}
                  className="flex items-center justify-between gap-3 py-2.5 cursor-pointer hover:bg-surface-2/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={
                        entry.categoryColor
                          ? {
                              backgroundColor: `${entry.categoryColor}18`,
                              color: entry.categoryColor,
                            }
                          : undefined
                      }
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-expense-soft text-expense"
                    >
                      <CategoryIcon name={entry.categoryIcon} className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-body font-medium text-ink block leading-snug">
                        {title}
                      </span>
                      <span className="text-caption text-ink-muted block leading-tight">
                        {subtitle}
                      </span>
                    </div>
                  </div>

                  <span className="text-body font-bold tabular-nums text-expense shrink-0">
                    -{money(entry.amount, locale, { fractionDigits: 0 })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {result.entries.length > 4 && (
          <button
            type="button"
            onClick={() => setShowAllSheet(true)}
            className="w-full py-2.5 text-center text-caption font-semibold text-accent hover:bg-surface-2 transition-colors border-t border-line/40"
          >
            {t('seeAllCategories')} ({result.entries.length})
          </button>
        )}
      </Card>

      {/* All Entries Drill-down Sheet */}
      <CellEntriesSheet
        open={showAllSheet}
        onOpenChange={setShowAllSheet}
        title={t('library.biggestExpenses')}
        subtitle={`${result.entries.length} ${t('dim.item')}`}
        total={result.totalAmount}
        entries={result.entries}
      />
    </div>
  );
}

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useCategories, useEntries } from '@/lib/data/provider';
import { monthlyAverages } from '@/lib/reports/planning';
import { getLastNMonths } from '@/lib/reports/months';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Card } from '@/components/ui/card';
import { money, pickName } from '@/lib/format';
import type { PivotEntry } from '@/lib/data/types';

export function MonthlyAveragesView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [periodMonthsCount, setPeriodMonthsCount] = React.useState<number>(6);

  const entries = useEntries();
  const categories = useCategories();

  const currentMonth = React.useMemo(() => new Date().toISOString().slice(0, 7), []);
  const months = React.useMemo(
    () => getLastNMonths(currentMonth, periodMonthsCount),
    [currentMonth, periodMonthsCount]
  );

  const pivotEntries: PivotEntry[] = React.useMemo(() => {
    if (!entries) return [];
    return entries.map((e) => ({
      id: e.id,
      type: e.type,
      amount: e.amount,
      occurredOn: e.occurredOn,
      month: e.occurredOn.slice(0, 7),
      week: '',
      categoryId: e.categoryId ?? null,
      categoryNameAr: e.categoryNameAr ?? null,
      categoryNameEn: e.categoryNameEn ?? null,
      categoryIcon: e.categoryIcon ?? null,
      categoryColor: e.categoryColor ?? null,
      subcategoryId: e.subcategoryId ?? null,
      subcategoryNameAr: e.subcategoryNameAr ?? null,
      subcategoryNameEn: e.subcategoryNameEn ?? null,
      itemId: e.itemId ?? null,
      itemNameAr: e.itemNameAr ?? null,
      itemNameEn: e.itemNameEn ?? null,
      accountId: e.accountId,
      accountNameAr: e.accountNameAr ?? null,
      accountNameEn: e.accountNameEn ?? null,
      createdById: e.createdBy ?? null,
      createdByName: e.createdByName ?? null,
    }));
  }, [entries]);

  const averages = React.useMemo(() => {
    if (!pivotEntries.length) return [];
    return monthlyAverages(pivotEntries, months);
  }, [pivotEntries, months]);

  const totalMonthlyAvg = React.useMemo(() => {
    return averages.reduce((sum, a) => sum + a.average, 0);
  }, [averages]);

  return (
    <div className="space-y-3 select-none">
      {/* Period Chips (3, 6, 12 months) */}
      <div className="flex items-center gap-1.5 p-0.5">
        {[
          { count: 3, labelKey: 'periods.last3' },
          { count: 6, labelKey: 'periods.last6' },
          { count: 12, labelKey: 'periods.thisYear' },
        ].map((p) => {
          const isSelected = periodMonthsCount === p.count;
          return (
            <button
              key={p.count}
              type="button"
              onClick={() => setPeriodMonthsCount(p.count)}
              className={`flex-1 h-8 rounded-full text-caption font-semibold transition-all active:scale-95 text-center px-1 whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-accent text-accent-ink shadow-xs'
                  : 'bg-surface-2 text-ink-muted hover:text-ink'
              }`}
            >
              {t(p.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Hero Card: Total Average Monthly Spend */}
      <Card className="rounded-card bg-surface p-4 shadow-card border border-line/60">
        <span className="text-caption font-medium text-ink-muted block">
          {t('library.monthlyAverage')}
        </span>
        <span className="text-title font-bold tabular-nums text-ink mt-0.5 block">
          {money(totalMonthlyAvg, locale, { fractionDigits: 0 })}
        </span>
      </Card>

      {/* Category List */}
      <div className="space-y-2.5">
        {averages.map((cat) => {
          const matchedCategory = categories?.find((c) => c.id === cat.id);
          const icon = matchedCategory?.icon ?? 'Layers';
          const name = pickName(
            { name_ar: cat.nameAr, name_en: cat.nameEn },
            locale
          ) || t('library.categoryDeepDive');
          const sharePercent = totalMonthlyAvg > 0 ? Math.round((cat.average / totalMonthlyAvg) * 100) : 0;

          return (
            <Card
              key={cat.id}
              className="rounded-card bg-surface p-3.5 shadow-card border border-line/60 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    style={
                      matchedCategory?.color
                        ? {
                            backgroundColor: `${matchedCategory.color}18`,
                            color: matchedCategory.color,
                          }
                        : undefined
                    }
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                  >
                    <CategoryIcon name={icon} className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-body font-semibold text-ink truncate block">
                      {name}
                    </span>
                    <span className="text-caption text-ink-muted tabular-nums block">
                      {t('library.min')}: {money(cat.min, locale, { fractionDigits: 0 })} · {t('library.max')}: {money(cat.max, locale, { fractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                <div className="text-end shrink-0">
                  <span className="text-body font-bold tabular-nums text-ink block">
                    {money(cat.average, locale, { fractionDigits: 0 })}
                  </span>
                  <span className="text-caption text-ink-muted tabular-nums block">
                    {sharePercent}% {t('library.shareOfTotal')}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                <div
                  style={{
                    width: `${Math.min(100, sharePercent)}%`,
                    ...(matchedCategory?.color ? { backgroundColor: matchedCategory.color } : {}),
                  }}
                  className={`h-full rounded-full transition-all ${matchedCategory?.color ? '' : 'bg-accent'}`}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

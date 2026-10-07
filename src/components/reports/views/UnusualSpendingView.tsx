'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, TrendingUp } from 'lucide-react';
import { useCategories, useEntries } from '@/lib/data/provider';
import { unusualSpending } from '@/lib/reports/planning';
import { MonthSwitcher } from '../MonthSwitcher';
import { Card } from '@/components/ui/card';
import { CategoryIcon } from '@/components/ui/category-icon';
import { money, pickName } from '@/lib/format';
import type { PivotEntry } from '@/lib/data/types';

export function UnusualSpendingView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0, 7));

  const entries = useEntries();
  const categories = useCategories();

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

  const unusual = React.useMemo(() => {
    if (!pivotEntries.length) return [];
    return unusualSpending(pivotEntries, month, { lookback: 6, threshold: 0.3, minAbove: 100 });
  }, [pivotEntries, month]);

  return (
    <div className="space-y-3 select-none">
      {/* Month Switcher */}
      <Card className="rounded-card bg-surface p-2 shadow-card border border-line/60">
        <MonthSwitcher month={month} onMonthChange={setMonth} />
      </Card>

      {/* Results */}
      {unusual.length === 0 ? (
        <Card className="rounded-card bg-surface p-8 text-center shadow-card border border-line/60 space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-income/12 text-income mb-2">
            <CheckCircle2 className="size-6" />
          </div>
          <h3 className="text-body font-bold text-ink">
            {t('library.noUnusual')}
          </h3>
          <p className="text-caption text-ink-muted max-w-xs mx-auto">
            {t('library.noUnusualDesc')}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {unusual.map((cat) => {
            const matchedCategory = categories?.find((c) => c.id === cat.id);
            const icon = matchedCategory?.icon ?? 'AlertCircle';
            const color = matchedCategory?.color ?? '#C2410C';
            const name = pickName(
              { name_ar: cat.nameAr, name_en: cat.nameEn },
              locale
            ) || cat.id;
            const percent = Math.round(cat.ratio * 100);

            return (
              <Card
                key={cat.id}
                className="rounded-card bg-surface p-4 shadow-card border border-line/60 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      style={{
                        backgroundColor: `${color}18`,
                        color: color,
                      }}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full"
                    >
                      <CategoryIcon name={icon} className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-body font-semibold text-ink truncate">
                        {name}
                      </h3>
                      <span className="text-caption text-ink-muted tabular-nums block mt-0.5">
                        {t('library.avg')}: {money(cat.average, locale, { fractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <span className="text-heading font-bold tabular-nums text-expense block">
                      {money(cat.thisMonth, locale, { fractionDigits: 0 })}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold bg-expense/12 text-expense mt-1">
                      <TrendingUp className="size-3" />
                      <span>{t('library.aboveAverage', { percent })}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-line/40 flex items-center justify-between text-caption text-ink-muted">
                  <span>{t('library.difference')}</span>
                  <span className="font-semibold tabular-nums text-expense">
                    +{money(cat.above, locale, { fractionDigits: 0 })}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

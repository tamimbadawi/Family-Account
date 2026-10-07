'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { User, Users } from 'lucide-react';
import { useCategories, useEntries } from '@/lib/data/provider';
import { whoSpentWhat } from '@/lib/reports/planning';
import { MonthSwitcher } from '../MonthSwitcher';
import { Card } from '@/components/ui/card';
import { CategoryIcon } from '@/components/ui/category-icon';
import { money, pickName } from '@/lib/format';
import type { PivotEntry } from '@/lib/data/types';

export function WhoSpentWhatView() {
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

  const people = React.useMemo(() => {
    if (!pivotEntries.length) return [];
    return whoSpentWhat(pivotEntries, [month]);
  }, [pivotEntries, month]);

  const totalExpense = React.useMemo(() => {
    return people.reduce((sum, p) => sum + p.total, 0);
  }, [people]);

  return (
    <div className="space-y-3 select-none">
      {/* Month Switcher */}
      <Card className="rounded-card bg-surface p-2 shadow-card border border-line/60">
        <MonthSwitcher month={month} onMonthChange={setMonth} />
      </Card>

      {/* Hero Card: Total Family Spend */}
      <Card className="rounded-card bg-surface p-4 shadow-card border border-line/60">
        <span className="text-caption font-medium text-ink-muted block">
          {t('library.totalExpense')}
        </span>
        <span className="text-title font-bold tabular-nums text-expense mt-0.5 block">
          {money(totalExpense, locale, { fractionDigits: 0 })}
        </span>
      </Card>

      {/* Member Cards */}
      {people.length === 0 ? (
        <Card className="rounded-card bg-surface p-8 text-center shadow-card border border-line/60">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted mb-2.5">
            <Users className="size-6 text-ink-faint" />
          </div>
          <p className="text-body font-medium text-ink-muted">
            {t('noExpenses')}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {people.map((person) => {
            const sharePercent = totalExpense > 0 ? Math.round((person.total / totalExpense) * 100) : 0;
            const displayName = person.name || person.id;

            return (
              <Card
                key={person.id}
                className="rounded-card bg-surface p-4 shadow-card border border-line/60 space-y-3"
              >
                {/* Person Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <User className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-body font-semibold text-ink truncate">
                        {displayName}
                      </h3>
                      <span className="text-caption text-ink-muted tabular-nums block">
                        {sharePercent}% {t('library.shareOfTotal')}
                      </span>
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <span className="text-heading font-bold tabular-nums text-ink block">
                      {money(person.total, locale, { fractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, sharePercent)}%` }}
                    className="h-full bg-accent rounded-full transition-all"
                  />
                </div>

                {/* Top Categories for this person */}
                {person.byCategory.length > 0 && (
                  <div className="pt-2 border-t border-line/40 space-y-1.5">
                    {person.byCategory.slice(0, 4).map((cat) => {
                      const matchedCategory = categories?.find((c) => c.id === cat.id);
                      const icon = matchedCategory?.icon ?? 'Layers';
                      const catName = pickName(
                        { name_ar: cat.nameAr, name_en: cat.nameEn },
                        locale
                      ) || cat.id;

                      return (
                        <div key={cat.id} className="flex items-center justify-between gap-2 py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              style={
                                matchedCategory?.color
                                  ? {
                                      backgroundColor: `${matchedCategory.color}18`,
                                      color: matchedCategory.color,
                                    }
                                  : undefined
                              }
                              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                            >
                              <CategoryIcon name={icon} className="size-3.5" />
                            </div>
                            <span className="text-caption font-medium text-ink truncate">
                              {catName}
                            </span>
                          </div>
                          <span className="text-caption font-bold tabular-nums text-ink shrink-0">
                            {money(cat.total, locale, { fractionDigits: 0 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

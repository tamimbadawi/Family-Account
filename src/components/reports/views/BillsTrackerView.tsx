'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Receipt, Zap } from 'lucide-react';
import { useEntries } from '@/lib/data/provider';
import { billsTracker } from '@/lib/reports/planning';
import { getLastNMonths, formatMonth } from '@/lib/reports/months';
import { MonthSwitcher } from '../MonthSwitcher';
import { Card } from '@/components/ui/card';
import { money, pickName } from '@/lib/format';
import type { PivotEntry } from '@/lib/data/types';

export function BillsTrackerView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [endMonth, setEndMonth] = React.useState(() => new Date().toISOString().slice(0, 7));

  const entries = useEntries();
  const months = React.useMemo(() => getLastNMonths(endMonth, 6), [endMonth]);

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

  const rows = React.useMemo(() => {
    if (!pivotEntries.length) return [];
    return billsTracker(pivotEntries, months, { threshold: 0.25 });
  }, [pivotEntries, months]);

  return (
    <div className="space-y-3 select-none">
      {/* Month Switcher (changes the 6-month window) */}
      <Card className="rounded-card bg-surface p-2 shadow-card border border-line/60">
        <MonthSwitcher month={endMonth} onMonthChange={setEndMonth} />
      </Card>

      {/* Bill Cards */}
      {rows.length === 0 ? (
        <Card className="rounded-card bg-surface p-8 text-center shadow-card border border-line/60">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted mb-2.5">
            <Receipt className="size-6 text-ink-faint" />
          </div>
          <p className="text-body font-medium text-ink-muted">
            {t('library.noBills')}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => {
            const name = pickName(
              { name_ar: row.nameAr, name_en: row.nameEn },
              locale
            ) || t('library.billsTracker');
            const latestIndex = row.values.length - 1;
            const latestValue = row.values[latestIndex] ?? 0;
            const hasJump = row.jumps.includes(latestIndex);
            const nonZero = row.values.filter((v) => v > 0);
            const avg = nonZero.length > 0
              ? Math.round((nonZero.reduce((a, b) => a + b, 0) / nonZero.length) * 100) / 100
              : 0;
            const maxVal = Math.max(...row.values, 1);

            return (
              <Card
                key={row.id}
                className="rounded-card bg-surface p-4 shadow-card border border-line/60 space-y-3"
              >
                {/* Header: Name + Latest Value + Jump Alert */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-body font-semibold text-ink truncate">
                        {name}
                      </h3>
                      {hasJump && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold bg-expense/12 text-expense shrink-0">
                          <Zap className="size-3 stroke-[2.5]" />
                          <span>{t('library.billsJumped')}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-caption text-ink-muted mt-0.5">
                      {t('library.avg')}: {money(avg, locale, { fractionDigits: 0 })}
                    </p>
                  </div>

                  <div className="text-end shrink-0">
                    <span className="text-heading font-bold tabular-nums text-ink block">
                      {money(latestValue, locale, { fractionDigits: 0 })}
                    </span>
                    <span className="text-caption text-ink-muted block mt-0.5">
                      {formatMonth(months[latestIndex], locale)}
                    </span>
                  </div>
                </div>

                {/* 6-Month Mini Bar Strip */}
                <div className="pt-1 border-t border-line/40">
                  <div className="grid grid-cols-6 gap-1.5 items-end h-16 pt-2">
                    {months.map((m, i) => {
                      const val = row.values[i];
                      const heightPercent = Math.max(10, Math.round((val / maxVal) * 100));
                      const isJump = row.jumps.includes(i);
                      const isLatest = i === latestIndex;

                      return (
                        <div key={m} className="flex flex-col items-center gap-1 h-full justify-end">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-md transition-all ${
                              isJump
                                ? 'bg-expense'
                                : isLatest
                                ? 'bg-accent'
                                : 'bg-surface-2'
                            }`}
                          />
                          <span className="text-caption tabular-nums text-ink-muted leading-none">
                            {m.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

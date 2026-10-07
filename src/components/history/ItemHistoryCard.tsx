'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { CategoryIcon } from '@/components/ui/category-icon';
import { useCategories, useEntries, useItems, useSubcategories } from '@/lib/data/provider';
import { money, pickName, shiftMonth } from '@/lib/format';
import { byMember, focusLevel, toListParams, type HistoryFilters } from '@/lib/history/filters';

const MONTHS = 6;

function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

/**
 * The history of one category, group or item (like the Reports drill-down): this month's total,
 * how often, the average, the change from last month, and six months of bars. Tapping a bar opens that month.
 */
export function ItemHistoryCard({
  filters,
  month,
  onMonthChange,
}: {
  filters: HistoryFilters;
  month: string;
  onMonthChange: (month: string) => void;
}) {
  const t = useTranslations('history');
  const locale = useLocale();
  const level = focusLevel(filters);

  const categories = useCategories();
  const groups = useSubcategories(filters.categoryId);
  const items = useItems(filters.subcategoryId);
  const category = categories?.find((c) => c.id === filters.categoryId);
  const target =
    level === 'item'
      ? items?.find((i) => i.id === filters.itemId)
      : level === 'subcategory'
        ? groups?.find((s) => s.id === filters.subcategoryId)
        : category;

  const first = shiftMonth(month, -(MONTHS - 1));
  const range = byMember(
    useEntries(toListParams(filters, { startDate: `${first}-01`, endDate: lastDayOf(month) })),
    filters.memberId
  );

  const months = React.useMemo(() => Array.from({ length: MONTHS }, (_, i) => shiftMonth(first, i)), [first]);
  const stats = React.useMemo(() => {
    const totals = new Map(months.map((m) => [m, { total: 0, count: 0 }]));
    for (const e of range ?? []) {
      if (e.type === 'transfer') continue;
      const bucket = totals.get(e.occurredOn.slice(0, 7));
      if (bucket) {
        bucket.total += e.amount;
        bucket.count += 1;
      }
    }
    return totals;
  }, [range, months]);

  if (!level || !target) return null;

  const isIncome = category?.kind === 'income';
  const tone = isIncome ? 'text-income' : 'text-expense';
  const barTone = isIncome ? 'bg-income' : 'bg-expense';
  const now = stats.get(month) ?? { total: 0, count: 0 };
  const before = stats.get(shiftMonth(month, -1)) ?? { total: 0, count: 0 };
  const max = Math.max(1, ...Array.from(stats.values(), (s) => s.total));
  const sixMonthTotal = Array.from(stats.values()).reduce((sum, s) => sum + s.total, 0);
  const activeMonths = Array.from(stats.values()).filter((s) => s.count > 0).length;
  const change = before.total > 0 ? Math.round(((now.total - before.total) / before.total) * 100) : null;
  const monthLabel = (m: string) =>
    new Intl.DateTimeFormat(locale.startsWith('ar') ? 'ar-EG' : 'en-EG', { month: 'short', numberingSystem: 'latn' }).format(
      new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1)
    );
  const name = pickName({ name_ar: target.nameAr, name_en: target.nameEn }, locale);
  const path =
    level === 'category'
      ? null
      : [category, level === 'item' ? groups?.find((s) => s.id === filters.subcategoryId) : null]
          .filter(Boolean)
          .map((r) => pickName({ name_ar: r!.nameAr, name_en: r!.nameEn }, locale))
          .join(' › ');

  return (
    <div className="mx-5 mt-3 rounded-card bg-surface p-4 shadow-card select-none" data-item-history>
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
          <CategoryIcon name={category?.icon} className="size-6" style={{ color: category?.color ?? undefined }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-heading font-bold text-ink">{name}</div>
          {path && <div className="truncate text-caption text-ink-muted">{path}</div>}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-caption text-ink-muted">{t('thisMonth')}</div>
          <div className={`text-title font-bold tabular-nums ${tone}`}>{money(now.total, locale)}</div>
        </div>
        {change !== null && change !== 0 && (
          <div
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-caption font-semibold tabular-nums ${
              change > 0 === !isIncome ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income'
            }`}
          >
            {change > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            {t('vsLastMonth', { percent: Math.abs(change) })}
          </div>
        )}
      </div>

      <div className="mt-1 text-caption text-ink-muted tabular-nums">
        {t('timesThisMonth', { count: now.count })}
        {activeMonths > 0 && ` · ${t('monthlyAverage', { amount: money(sixMonthTotal / activeMonths, locale) })}`}
      </div>

      {/* Six months: tap a bar to open that month */}
      <div className="mt-4 flex h-28 items-end gap-2" role="group" aria-label={t('sixMonths')}>
        {months.map((m) => {
          const s = stats.get(m)!;
          const selected = m === month;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onMonthChange(m)}
              aria-label={`${monthLabel(m)} ${money(s.total, locale)}`}
              aria-pressed={selected}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 cursor-pointer"
            >
              <span
                className={`w-full rounded-lg transition-all ${s.total > 0 ? barTone : 'bg-line'} ${selected ? 'opacity-100' : 'opacity-35'}`}
                style={{ height: `${Math.max(6, (s.total / max) * 72)}px` }}
              />
              <span className={`text-caption tabular-nums ${selected ? 'font-bold text-ink' : 'text-ink-muted'}`}>{monthLabel(m)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { CategoryIcon } from '@/components/ui/category-icon';
import { useCategories, useEntries, useItems, useSubcategories } from '@/lib/data/provider';
import { money, pickName } from '@/lib/format';
import { barLabel, bucketIndex, lastPeriods, type Period } from '@/lib/history/period';
import { applyFilters, pickLevel, singlePick, toListParams, type HistoryFilters } from '@/lib/history/filters';
import { useEntryAuthor } from '@/lib/auth/use-family-members';

const BARS = 6;

/**
 * The history of one category, group or item (like the Reports drill-down): this period's total,
 * how often, the usual amount, the change from the period before, and six bars. Tapping a bar opens that period.
 */
export function ItemHistoryCard({
  filters,
  period,
  anchor,
  onAnchorChange,
}: {
  filters: HistoryFilters;
  period: Period;
  anchor: string;
  onAnchorChange: (anchor: string) => void;
}) {
  const t = useTranslations('history');
  const locale = useLocale();
  const pick = singlePick(filters);
  const level = pick ? pickLevel(pick) : null;

  const categories = useCategories();
  const groups = useSubcategories(pick?.categoryId);
  const items = useItems(pick?.subcategoryId);
  const category = categories?.find((c) => c.id === pick?.categoryId);
  const target =
    level === 'item'
      ? items?.find((i) => i.id === pick?.itemId)
      : level === 'subcategory'
        ? groups?.find((s) => s.id === pick?.subcategoryId)
        : category;

  const authorOf = useEntryAuthor();
  const ranges = React.useMemo(() => lastPeriods(period, anchor, BARS), [period, anchor]);
  const entries = applyFilters(
    useEntries(toListParams(filters, { startDate: ranges[0].startDate, endDate: ranges[BARS - 1].endDate })),
    filters,
    authorOf
  );

  const buckets = React.useMemo(() => {
    const totals = ranges.map(() => ({ total: 0, count: 0 }));
    for (const e of entries ?? []) {
      if (e.type === 'transfer') continue;
      const i = bucketIndex(ranges, e.occurredOn);
      if (i >= 0) {
        totals[i].total += e.amount;
        totals[i].count += 1;
      }
    }
    return totals;
  }, [entries, ranges]);

  if (!level || !target) return null;

  const isIncome = category?.kind === 'income';
  const tone = isIncome ? 'text-income' : 'text-expense';
  const barTone = isIncome ? 'bg-income' : 'bg-expense';
  const now = buckets[BARS - 1];
  const before = buckets[BARS - 2];
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const allTotal = buckets.reduce((sum, b) => sum + b.total, 0);
  const activePeriods = buckets.filter((b) => b.count > 0).length;
  const change = before.total > 0 ? Math.round(((now.total - before.total) / before.total) * 100) : null;
  const name = pickName({ name_ar: target.nameAr, name_en: target.nameEn }, locale);
  const path =
    level === 'category'
      ? null
      : [category, level === 'item' ? groups?.find((s) => s.id === pick?.subcategoryId) : null]
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
          <div className="text-caption text-ink-muted">{t(`thisPeriod.${period}`)}</div>
          <div className={`text-title font-bold tabular-nums ${tone}`}>{money(now.total, locale)}</div>
        </div>
        {change !== null && change !== 0 && (
          <div
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-caption font-semibold tabular-nums ${
              change > 0 === !isIncome ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income'
            }`}
          >
            {change > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            {t(`vsPrevious.${period}`, { percent: Math.abs(change) })}
          </div>
        )}
      </div>

      <div className="mt-1 text-caption text-ink-muted tabular-nums">
        {t(`times.${period}`, { count: now.count })}
        {activePeriods > 0 && ` · ${t(`usually.${period}`, { amount: money(Math.round(allTotal / activePeriods), locale) })}`}
      </div>

      {/* Six periods: tap a bar to open that one */}
      <div className="mt-4 flex h-28 items-end gap-2" role="group" aria-label={t(`last6.${period}`)}>
        {ranges.map((r, i) => {
          const s = buckets[i];
          const selected = i === BARS - 1;
          const label = barLabel(period, r, locale);
          return (
            <button
              key={r.startDate}
              type="button"
              onClick={() => onAnchorChange(r.startDate)}
              aria-label={`${label} ${money(s.total, locale)}`}
              aria-pressed={selected}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 cursor-pointer"
            >
              <span
                className={`w-full rounded-lg transition-all ${s.total > 0 ? barTone : 'bg-line'} ${selected ? 'opacity-100' : 'opacity-35'}`}
                style={{ height: `${Math.max(6, (s.total / max) * 72)}px` }}
              />
              <span className={`text-caption tabular-nums ${selected ? 'font-bold text-ink' : 'text-ink-muted'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

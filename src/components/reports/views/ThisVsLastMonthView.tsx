'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Layers } from 'lucide-react';
import { useCategories, useEntries } from '@/lib/data/provider';
import { calculateThisVsLastMonth, type CategoryComparison } from '@/lib/reports/this-vs-last-month';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Card } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { money } from '@/lib/format';
import { MonthSwitcher } from '../MonthSwitcher';

export function ThisVsLastMonthView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0, 7));
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const entries = useEntries();
  const categories = useCategories();

  const result = React.useMemo(() => {
    if (!entries || !categories) return null;
    return calculateThisVsLastMonth(
      entries,
      categories,
      month,
      locale === 'ar' ? 'ar' : 'en'
    );
  }, [entries, categories, month, locale]);

  if (!result) return null;

  const top3 = result.categories.slice(0, 3);
  const hasMore = result.categories.length > 3;

  const renderCategoryRow = (cat: CategoryComparison) => (
    <div key={cat.id} className="flex items-center justify-between gap-3 py-2">
      {/* Icon + Name */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          style={{
            backgroundColor: `${cat.color || 'var(--accent)'}18`,
            color: cat.color || 'var(--accent)',
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
        >
          <CategoryIcon name={cat.icon} className="size-4" />
        </div>
        <div className="min-w-0">
          <span className="text-body font-semibold text-ink truncate block">
            {cat.name}
          </span>
          <span className="text-caption text-ink-muted tabular-nums block">
            {t('library.lastMonth')}: {money(cat.lastMonthAmount, locale, { fractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Amount + Change pill */}
      <div className="text-end shrink-0">
        <span className="text-body font-bold tabular-nums text-ink block">
          {money(cat.thisMonthAmount, locale, { fractionDigits: 0 })}
        </span>
        <div
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-caption font-semibold ${
            cat.diffAmount > 0
              ? 'bg-expense/12 text-expense'
              : cat.diffAmount < 0
              ? 'bg-income/12 text-income'
              : 'bg-surface-2 text-ink-muted'
          }`}
        >
          {cat.diffAmount > 0 ? (
            <ArrowUpRight className="size-3 shrink-0" />
          ) : cat.diffAmount < 0 ? (
            <ArrowDownRight className="size-3 shrink-0" />
          ) : null}
          <span className="tabular-nums">
            {cat.diffAmount > 0 ? `+${cat.diffPercent}%` : `${cat.diffPercent}%`}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-2 select-none">
      {/* Month Switcher */}
      <MonthSwitcher month={month} onMonthChange={setMonth} />

      {/* Hero Comparison Card */}
      <Card className="rounded-card bg-surface p-3.5 shadow-card border border-line/60">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-caption text-ink-muted block">
              {t('library.thisMonth')}
            </span>
            <span className="text-display font-bold tabular-nums text-ink leading-tight">
              {money(result.thisMonthTotal, locale, { fractionDigits: 0 })}
            </span>
          </div>

          <div className="text-end">
            <span className="text-caption text-ink-muted block">
              {t('library.difference')}
            </span>
            <div
              className={`inline-flex items-center gap-1 text-heading font-bold tabular-nums ${
                result.totalDiffAmount > 0 ? 'text-expense' : 'text-income'
              }`}
            >
              {result.totalDiffAmount > 0 ? (
                <ArrowUpRight className="size-4" />
              ) : (
                <ArrowDownRight className="size-4" />
              )}
              <span>
                {result.totalDiffAmount > 0 ? `+${result.totalDiffPercent}%` : `${result.totalDiffPercent}%`}
              </span>
            </div>
            <span className="text-caption text-ink-muted tabular-nums block">
              {money(Math.abs(result.totalDiffAmount), locale, { fractionDigits: 0 })}
            </span>
          </div>
        </div>
      </Card>

      {/* Top Categories List Card */}
      <Card className="rounded-card bg-surface p-3 shadow-card border border-line/60 divide-y divide-line/40">
        {result.categories.length === 0 ? (
          <div className="py-8 text-center text-ink-muted">
            <Layers className="size-7 mx-auto text-ink-faint mb-1.5" />
            <p className="text-body font-medium">{t('emptyEntries')}</p>
          </div>
        ) : (
          top3.map(renderCategoryRow)
        )}

        {hasMore && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 py-1 text-body font-semibold text-accent hover:underline active:scale-95 transition-all"
            >
              <span>{t('seeAllCategories')}</span>
              <span className="text-caption text-accent/80 tabular-nums">
                ({result.categories.length})
              </span>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </button>
          </div>
        )}
      </Card>

      {/* See All Categories Drawer */}
      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent className="max-h-[85dvh] flex flex-col bg-surface text-ink">
          <DrawerHeader className="pb-3 border-b border-line shrink-0">
            <DrawerTitle className="text-heading font-bold text-ink">
              {t('seeAllCategories')}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-line [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {result.categories.map(renderCategoryRow)}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

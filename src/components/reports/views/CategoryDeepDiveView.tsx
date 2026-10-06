'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronRight, Layers } from 'lucide-react';
import {
  useCategories,
  useEntries,
  useItems,
  useSubcategories,
} from '@/lib/data/provider';
import { calculateCategoryDeepDive } from '@/lib/reports/category-deep-dive';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Card } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { money } from '@/lib/format';
import { MonthSwitcher } from '../MonthSwitcher';

export function CategoryDeepDiveView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const isRtl = locale.startsWith('ar');

  const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0, 7));
  const [selectedCatId, setSelectedCatId] = React.useState<string | null>(null);
  const [showAllSheet, setShowAllSheet] = React.useState(false);

  const entries = useEntries();
  const categories = useCategories();
  const subcategories = useSubcategories();
  const items = useItems();

  const expenseCategories = React.useMemo(() => {
    return categories?.filter((c) => c.kind === 'expense' && !c.isArchived) ?? [];
  }, [categories]);

  const activeCatId = selectedCatId || expenseCategories[0]?.id;

  const result = React.useMemo(() => {
    if (!entries || !activeCatId || !categories || !subcategories || !items) {
      return null;
    }
    return calculateCategoryDeepDive(
      entries,
      activeCatId,
      month,
      categories,
      subcategories,
      items,
      locale === 'ar' ? 'ar' : 'en'
    );
  }, [entries, activeCatId, month, categories, subcategories, items, locale]);

  if (!result) return null;

  const visibleSubcategories = result.subcategories.slice(0, 2);

  return (
    <div className="space-y-2 select-none">
      {/* Month Switcher */}
      <MonthSwitcher month={month} onMonthChange={setMonth} />

      {/* Category Selection Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-0.5">
        {expenseCategories.map((cat) => {
          const isSelected = cat.id === activeCatId;
          const name = locale.startsWith('ar')
            ? cat.nameAr || cat.nameEn
            : cat.nameEn || cat.nameAr;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCatId(cat.id)}
              className={`flex shrink-0 items-center gap-1.5 h-8 px-2.5 rounded-full text-caption font-semibold transition-all active:scale-95 ${
                isSelected
                  ? 'bg-accent text-accent-ink shadow-xs'
                  : 'bg-surface text-ink border border-line/70 hover:bg-surface-2'
              }`}
            >
              <CategoryIcon name={cat.icon} className="size-3.5" />
              <span>{name}</span>
            </button>
          );
        })}
      </div>

      {/* 12-Month Trend Chart Card */}
      <Card className="rounded-card bg-surface p-3 shadow-card border border-line/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-body font-semibold text-ink">
              {result.categoryName}
            </span>
            <span className="text-caption text-ink-muted block">
              {t('library.monthlyAvg')}: {money(result.averageMonthly, locale, { fractionDigits: 0 })}
            </span>
          </div>

          <div className="text-end">
            <span className="text-body font-bold tabular-nums text-expense">
              {money(result.currentMonthTotal, locale, { fractionDigits: 0 })}
            </span>
            <span className="text-caption text-ink-muted block">
              {t('library.thisMonth')}
            </span>
          </div>
        </div>

        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={result.trend12Months}
              margin={{ top: 6, right: isRtl ? 0 : 4, left: isRtl ? 4 : 0, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                reversed={isRtl}
                stroke="var(--ink-muted)"
                tickLine={false}
                axisLine={{ stroke: 'var(--line)' }}
                tick={{ fill: 'var(--ink-muted)', fontSize: 15 }}
              />
              <YAxis
                orientation={isRtl ? 'right' : 'left'}
                stroke="var(--ink-muted)"
                tickLine={false}
                axisLine={false}
                tickCount={3}
                tick={{ fill: 'var(--ink-faint)', fontSize: 15 }}
                tickFormatter={(val: number) =>
                  money(val, locale, { compact: true, hideCurrency: true })
                }
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl bg-surface px-3 py-1.5 shadow-card border border-line text-ink">
                        <p className="text-caption font-semibold">{data.name}</p>
                        <p className="text-caption font-bold tabular-nums text-expense">
                          {money(data.amount, locale)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={result.averageMonthly}
                stroke="var(--ink-muted)"
                strokeDasharray="3 3"
              />
              <Bar
                dataKey="amount"
                fill={result.color || 'var(--accent)'}
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Subcategories Breakdown Card */}
      <Card className="rounded-card bg-surface p-3 shadow-card border border-line/60 divide-y divide-line/40">
        <span className="text-body font-semibold text-ink pb-1 block">
          {t('library.subcategoriesBreakdown')}
        </span>

        {result.subcategories.length === 0 ? (
          <div className="py-6 text-center text-ink-muted">
            <Layers className="size-6 mx-auto text-ink-faint mb-1" />
            <p className="text-caption font-medium">{t('emptyEntries')}</p>
          </div>
        ) : (
          <>
            {visibleSubcategories.map((sub) => (
              <div
                key={sub.id}
                onClick={() => setShowAllSheet(true)}
                className="flex items-center justify-between py-2 cursor-pointer hover:bg-surface-2/40 transition-colors"
              >
                <div>
                  <span className="text-body font-semibold text-ink block">
                    {sub.name}
                  </span>
                  <span className="text-caption text-ink-muted block">
                    {sub.items.length} {t('dim.item')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-body font-bold tabular-nums text-expense">
                    {money(sub.amount, locale, { fractionDigits: 0 })}
                  </span>
                  <ChevronRight className="size-4 text-ink-faint rtl:rotate-180" />
                </div>
              </div>
            ))}

            {result.subcategories.length > 2 && (
              <button
                type="button"
                onClick={() => setShowAllSheet(true)}
                className="w-full py-2.5 text-center text-caption font-semibold text-accent hover:bg-surface-2 transition-colors border-t border-line/40 block"
              >
                {t('seeAllCategories')} ({result.subcategories.length})
              </button>
            )}
          </>
        )}
      </Card>

      {/* Subcategories & Items Detail Sheet */}
      <Drawer open={showAllSheet} onOpenChange={setShowAllSheet}>
        <DrawerContent className="max-h-[85dvh] flex flex-col bg-surface text-ink">
          <DrawerHeader className="pb-3 border-b border-line shrink-0">
            <DrawerTitle className="text-heading font-bold text-ink truncate">
              {result.categoryName} · {t('library.subcategoriesBreakdown')}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-line [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-3">
            {result.subcategories.map((sub) => (
              <div key={sub.id} className="pt-3 first:pt-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-body font-bold text-ink">
                    {sub.name}
                  </span>
                  <span className="text-body font-bold tabular-nums text-expense">
                    {money(sub.amount, locale, { fractionDigits: 0 })}
                  </span>
                </div>

                {sub.items.length > 0 && (
                  <div className="ps-2.5 space-y-1 border-s-2 border-line">
                    {sub.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-body text-ink"
                      >
                        <span className="text-ink-muted">{it.name}</span>
                        <span className="tabular-nums font-semibold text-ink">
                          {money(it.amount, locale, { fractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

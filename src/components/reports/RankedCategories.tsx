'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, Layers } from 'lucide-react';
import { useCategoryTotals } from '@/lib/data/provider';
import type { CategoryKind, CategoryLevel, CategoryTotal } from '@/lib/data/types';
import { CategoryIcon } from '@/components/ui/category-icon';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { money, pickName } from '@/lib/format';
import { DONUT_PALETTE } from './CategoryDonut';

export interface RankedCategoriesProps {
  month: string;
  kind?: CategoryKind;
  onDataLoaded?: (data: CategoryTotal[], total: number) => void;
  className?: string;
}

export function RankedCategories({
  month,
  kind = 'expense',
  onDataLoaded,
  className = '',
}: RankedCategoriesProps) {
  const locale = useLocale();
  const t = useTranslations('reports');

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [drill, setDrill] = React.useState<{
    level: CategoryLevel;
    categoryId?: string;
    categoryName?: string;
    categoryIcon?: string | null;
    categoryColor?: string | null;
    subcategoryId?: string;
    subcategoryName?: string;
  }>({
    level: 'category',
  });

  // Query root categories for main card
  const rootTotals = useCategoryTotals(month, kind, 'category');

  // Query drilled-down data for sheet
  const parentId =
    drill.level === 'subcategory'
      ? drill.categoryId
      : drill.level === 'item'
      ? drill.subcategoryId
      : undefined;

  const sheetTotals = useCategoryTotals(month, kind, drill.level, parentId);

  // Notify parent of root totals for donut
  React.useEffect(() => {
    if (rootTotals) {
      const grandTotal = rootTotals.reduce((sum, item) => sum + item.total, 0);
      onDataLoaded?.(rootTotals, grandTotal);
    }
  }, [rootTotals, onDataLoaded]);

  const top4 = React.useMemo(() => {
    if (!rootTotals) return [];
    return rootTotals.slice(0, 4);
  }, [rootTotals]);

  const handleOpenSheetForCategory = (item: CategoryTotal) => {
    const itemName = pickName({ name_ar: item.nameAr, name_en: item.nameEn }, locale) || item.id;
    setDrill({
      level: 'subcategory',
      categoryId: item.id,
      categoryName: itemName,
      categoryIcon: item.icon,
      categoryColor: item.color,
    });
    setSheetOpen(true);
  };

  const handleOpenAllSheet = () => {
    setDrill({ level: 'category' });
    setSheetOpen(true);
  };

  const handleSheetRowClick = (item: CategoryTotal) => {
    const itemName = pickName({ name_ar: item.nameAr, name_en: item.nameEn }, locale) || item.id;

    if (drill.level === 'category') {
      setDrill({
        level: 'subcategory',
        categoryId: item.id,
        categoryName: itemName,
        categoryIcon: item.icon,
        categoryColor: item.color,
      });
    } else if (drill.level === 'subcategory') {
      setDrill((prev) => ({
        ...prev,
        level: 'item',
        subcategoryId: item.id,
        subcategoryName: itemName,
      }));
    }
  };

  return (
    <div className={`select-none ${className}`}>
      {/* Top 4 Categories Card */}
      {!rootTotals ? (
        <div className="space-y-2 rounded-card bg-surface p-3.5 shadow-card animate-pulse">
          <div className="h-6 rounded bg-surface-2" />
          <div className="h-6 rounded bg-surface-2" />
          <div className="h-6 rounded bg-surface-2" />
        </div>
      ) : top4.length === 0 ? (
        <div className="rounded-card bg-surface p-4 text-center text-ink-muted shadow-card">
          <p className="text-caption">{t('noExpenses')}</p>
        </div>
      ) : (
        <div className="rounded-card bg-surface px-3 py-1 shadow-card divide-y divide-line">
          {top4.map((item, index) => {
            const name = pickName({ name_ar: item.nameAr, name_en: item.nameEn }, locale) || item.id;
            const color = item.color || DONUT_PALETTE[index % DONUT_PALETTE.length];

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenSheetForCategory(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenSheetForCategory(item);
                  }
                }}
                className="flex items-center justify-between gap-2 py-1.5 cursor-pointer hover:bg-surface-2/40 -mx-1.5 px-1.5 rounded-lg transition-colors active:scale-[0.99]"
              >
                {/* Category Icon */}
                <div
                  style={{
                    backgroundColor: `${color}18`,
                    color: color,
                  }}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full"
                >
                  <CategoryIcon name={item.icon} className="size-3.5" />
                </div>

                {/* Category Name - No ellipsis on default names */}
                <span className="text-caption font-semibold text-ink whitespace-nowrap shrink-0">
                  {name}
                </span>

                {/* Flexible Progress Bar */}
                <div className="flex flex-1 items-center gap-1.5 min-w-8">
                  <div className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(item.percentage ?? 0, 100)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <span className="text-xs text-ink-muted tabular-nums shrink-0">
                    {item.percentage}%
                  </span>
                </div>

                {/* Amount */}
                <span className="text-caption font-bold tabular-nums text-expense shrink-0">
                  {money(item.total, locale)}
                </span>
              </div>
            );
          })}

          {/* See All Row */}
          <button
            type="button"
            onClick={handleOpenAllSheet}
            className="flex w-full items-center justify-center gap-1 py-1.5 text-xs font-semibold text-accent hover:underline active:scale-95 transition-all"
          >
            <span>{t('seeAllCategories')}</span>
            {rootTotals.length > 4 && (
              <span className="text-xs text-accent/80 tabular-nums">
                ({rootTotals.length})
              </span>
            )}
            <ChevronRight className="size-3.5 rtl:rotate-180" />
          </button>
        </div>
      )}

      {/* Full Categories Drill-Down Sheet */}
      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent className="max-h-[88dvh] flex flex-col bg-surface text-ink">
          <DrawerHeader className="pb-2 border-b border-line shrink-0">
            <div className="flex items-center justify-between">
              {/* Breadcrumb Trail */}
              <div className="flex flex-wrap items-center gap-1.5 text-caption font-semibold">
                {drill.level === 'category' ? (
                  <DrawerTitle className="text-heading font-bold text-ink">
                    {t('allCategories')}
                  </DrawerTitle>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setDrill({ level: 'category' })}
                      className="text-accent hover:underline flex items-center gap-1"
                    >
                      <span>{t('allCategories')}</span>
                    </button>

                    <ChevronRight className="size-3.5 text-ink-muted rtl:rotate-180" />

                    {drill.level === 'subcategory' ? (
                      <span className="text-ink font-bold">
                        {drill.categoryName}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setDrill((prev) => ({
                              level: 'subcategory',
                              categoryId: prev.categoryId,
                              categoryName: prev.categoryName,
                              categoryIcon: prev.categoryIcon,
                              categoryColor: prev.categoryColor,
                            }))
                          }
                          className="text-accent hover:underline"
                        >
                          {drill.categoryName}
                        </button>
                        <ChevronRight className="size-3.5 text-ink-muted rtl:rotate-180" />
                        <span className="text-ink font-bold">
                          {drill.subcategoryName}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>

              {drill.level !== 'category' && (
                <span className="text-caption text-ink-muted">
                  {drill.level === 'subcategory' ? t('subcategories') : t('items')}
                </span>
              )}
            </div>
          </DrawerHeader>

          {/* Sheet List Content */}
          <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-line">
            {!sheetTotals ? (
              <div className="space-y-3 py-4 animate-pulse">
                <div className="h-10 rounded-xl bg-surface-2" />
                <div className="h-10 rounded-xl bg-surface-2" />
                <div className="h-10 rounded-xl bg-surface-2" />
              </div>
            ) : sheetTotals.length === 0 ? (
              <div className="py-12 text-center text-ink-muted">
                <Layers className="size-8 mx-auto text-ink-faint mb-2" />
                <p className="text-caption">{t('noData')}</p>
              </div>
            ) : (
              sheetTotals.map((item, index) => {
                const name =
                  pickName({ name_ar: item.nameAr, name_en: item.nameEn }, locale) ||
                  item.id;
                const color =
                  item.color ||
                  drill.categoryColor ||
                  DONUT_PALETTE[index % DONUT_PALETTE.length];
                const iconName = item.icon || drill.categoryIcon;
                const isClickable = drill.level !== 'item';

                return (
                  <div
                    key={item.id}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={isClickable ? () => handleSheetRowClick(item) : undefined}
                    onKeyDown={
                      isClickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSheetRowClick(item);
                            }
                          }
                        : undefined
                    }
                    className={`flex items-center justify-between gap-3 py-3 transition-colors ${
                      isClickable
                        ? 'cursor-pointer hover:bg-surface-2/40 -mx-2 px-2 rounded-xl active:scale-[0.99]'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        style={{
                          backgroundColor: `${color}18`,
                          color: color,
                        }}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full"
                      >
                        <CategoryIcon name={iconName} className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-body font-semibold text-ink truncate block">
                          {name}
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-surface-2 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(item.percentage ?? 0, 100)}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                          <span className="text-caption text-ink-muted tabular-nums">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-body font-bold tabular-nums text-expense">
                        {money(item.total, locale)}
                      </span>
                      {isClickable && (
                        <ChevronRight className="size-4 text-ink-faint rtl:rotate-180" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

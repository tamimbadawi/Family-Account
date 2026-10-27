'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, Layers, ListChecks, Search, X } from 'lucide-react';
import { useCategoryTotals, useEntries } from '@/lib/data/provider';
import type { CategoryKind, CategoryLevel, CategoryTotal } from '@/lib/data/types';
import { CategoryIcon } from '@/components/ui/category-icon';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { joinPath, money, pickName } from '@/lib/format';
import { useRouter } from '@/i18n/navigation';
import { historyHref } from '@/lib/history/link';
import { searchCategoryTotals, type CategorySearchHit } from '@/lib/reports/category-search';
import { DONUT_PALETTE } from './CategoryDonut';

export interface RankedCategoriesProps {
  month: string;
  kind?: CategoryKind;
  currency?: string;
  onDataLoaded?: (data: CategoryTotal[], total: number) => void;
  className?: string;
}

export function RankedCategories({
  month,
  kind = 'expense',
  currency,
  onDataLoaded,
  className = '',
}: RankedCategoriesProps) {
  const locale = useLocale();
  const t = useTranslations('reports');
  const router = useRouter();

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
  const rootTotals = useCategoryTotals(month, kind, 'category', undefined, currency);

  // Query drilled-down data for sheet
  const parentId =
    drill.level === 'subcategory'
      ? drill.categoryId
      : drill.level === 'item'
      ? drill.subcategoryId
      : undefined;

  const sheetTotals = useCategoryTotals(month, kind, drill.level, parentId, currency);

  // Search inside "All categories": find a category, group or item by name, with its total this month
  const [query, setQuery] = React.useState('');
  const monthEntries = useEntries({ month, type: kind });
  const searching = drill.level === 'category' && query.trim() !== '';
  const hits = React.useMemo(
    () => (searching ? searchCategoryTotals(monthEntries, query, kind) : []),
    [searching, monthEntries, query, kind]
  );

  // Notify parent of root totals for donut
  React.useEffect(() => {
    if (rootTotals) {
      const grandTotal = rootTotals.reduce((sum, item) => sum + item.total, 0);
      onDataLoaded?.(rootTotals, grandTotal);
    }
  }, [rootTotals, onDataLoaded]);

  // Show top 3 categories per DESIGN.md and user instruction
  const top3 = React.useMemo(() => {
    if (!rootTotals) return [];
    return rootTotals.slice(0, 3);
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

  const handleHitClick = (hit: CategorySearchHit) => {
    const name = pickName({ name_ar: hit.nameAr, name_en: hit.nameEn }, locale) || hit.id;
    const categoryName = pickName({ name_ar: hit.pathAr[0] ?? null, name_en: hit.pathEn[0] ?? null }, locale);
    if (hit.level === 'category') {
      setDrill({ level: 'subcategory', categoryId: hit.id, categoryName: name, categoryIcon: hit.icon, categoryColor: hit.color });
    } else if (hit.level === 'subcategory') {
      setDrill({
        level: 'item',
        categoryId: hit.categoryId,
        categoryName,
        categoryIcon: hit.icon,
        categoryColor: hit.color,
        subcategoryId: hit.id,
        subcategoryName: name,
      });
    } else {
      router.push(
        historyHref({ type: kind, month, categoryId: hit.categoryId, subcategoryId: hit.subcategoryId, itemId: hit.id })
      );
      return;
    }
    setQuery('');
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
    } else {
      // An item: open its entries for this month in History
      router.push(
        historyHref({ type: kind, month, categoryId: drill.categoryId, subcategoryId: drill.subcategoryId, itemId: item.id })
      );
    }
  };

  // "Show the entries" at the top of each level: everything behind the totals listed below
  const levelEntriesHref = historyHref({
    type: kind,
    month,
    categoryId: drill.level === 'category' ? undefined : drill.categoryId,
    subcategoryId: drill.level === 'item' ? drill.subcategoryId : undefined,
  });

  return (
    <div className={`select-none ${className}`}>
      {/* Top 3 Categories Card */}
      {!rootTotals ? (
        <div className="space-y-2 rounded-card bg-surface p-3.5 shadow-card animate-pulse">
          <div className="h-7 rounded bg-surface-2" />
          <div className="h-7 rounded bg-surface-2" />
          <div className="h-7 rounded bg-surface-2" />
        </div>
      ) : top3.length === 0 ? (
        <div className="rounded-card bg-surface p-4 text-center text-ink-muted shadow-card">
          <p className="text-body">{t('noExpenses')}</p>
        </div>
      ) : (
        <div className="rounded-card bg-surface px-3.5 py-0.5 shadow-card divide-y divide-line">
          {top3.map((item, index) => {
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
                className={`flex items-center justify-between gap-2.5 py-1.5 cursor-pointer hover:bg-surface-2/40 -mx-1.5 px-1.5 rounded-xl transition-colors active:scale-[0.99] ${
                  /* Very small screens show two, so savings goals still fit on the first Reports page */
                  index === 2 ? '[@media(max-height:599px)]:hidden' : ''
                }`}
              >
                {/* Category Icon */}
                <div
                  style={{
                    backgroundColor: `${color}18`,
                    color: color,
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full"
                >
                  <CategoryIcon name={item.icon} className="size-4" />
                </div>

                {/* Category Name - text-body (17px), no ellipsis on default names */}
                <span className="text-body font-semibold text-ink whitespace-nowrap shrink-0">
                  {name}
                </span>

                {/* Flexible Progress Bar */}
                <div className="flex flex-1 items-center gap-2 min-w-8">
                  <div className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(item.percentage ?? 0, 100)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <span className="text-caption text-ink-muted tabular-nums shrink-0">
                    {item.percentage}%
                  </span>
                </div>

                {/* Amount - text-body (17px) tabular-nums */}
                <span className="text-body font-bold tabular-nums text-expense shrink-0">
                  {money(item.total, locale, { currency })}
                </span>
              </div>
            );
          })}

          {/* Full-width "See all categories" row */}
          <button
            type="button"
            onClick={handleOpenAllSheet}
            className="flex w-full items-center justify-center gap-1.5 py-1.5 text-body font-semibold text-accent hover:underline active:scale-95 transition-all"
          >
            <span>{t('seeAllCategories')}</span>
            {rootTotals.length > 3 && (
              <span className="text-caption text-accent/80 tabular-nums">
                ({rootTotals.length})
              </span>
            )}
            <ChevronRight className="size-4 rtl:rotate-180" />
          </button>
        </div>
      )}

      {/* Full Categories Drill-Down Sheet */}
      <Drawer
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setQuery('');
        }}
      >
        <DrawerContent className="max-h-[90dvh] flex flex-col bg-surface text-ink">
          <DrawerHeader className="pb-2.5 border-b border-line shrink-0">
            <div className="flex items-center justify-between">
              {/* Breadcrumb Trail */}
              <div className="flex flex-wrap items-center gap-1.5 text-body font-semibold">
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

                    <ChevronRight className="size-4 text-ink-muted rtl:rotate-180" />

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
                        <ChevronRight className="size-4 text-ink-muted rtl:rotate-180" />
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

          {drill.level === 'category' && (
            <div className="px-5 pt-3 shrink-0">
              <div className="flex h-12 w-full items-center rounded-2xl bg-surface-2 px-3">
                <Search className="size-5 shrink-0 text-ink-muted ms-1 me-2" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('searchCategories')}
                  aria-label={t('searchCategories')}
                  className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={t('clearSearch')}
                    className="flex min-h-12 min-w-12 items-center justify-center rounded-full text-ink-muted cursor-pointer active:scale-95 transition-transform"
                  >
                    <X className="size-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sheet List Content: 56px rows, hidden scrollbars, 2-line wrap */}
          <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-line [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {searching ? (
              hits.length === 0 ? (
                <div className="py-12 text-center text-ink-muted">
                  <Search className="size-8 mx-auto text-ink-faint mb-2" />
                  <p className="text-body">{t('noSearchMatches')}</p>
                </div>
              ) : (
                hits.map((hit, index) => {
                  const name = pickName({ name_ar: hit.nameAr, name_en: hit.nameEn }, locale) || hit.id;
                  const path = joinPath(
                    hit.pathEn.map((en, i) => pickName({ name_ar: hit.pathAr[i] || null, name_en: en || null }, locale)),
                    locale
                  );
                  const color = hit.color || DONUT_PALETTE[index % DONUT_PALETTE.length];
                  return (
                    <div
                      key={`${hit.level}-${hit.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleHitClick(hit)}
                      onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleHitClick(hit);
                              }
                            }}
                      className="flex min-h-[56px] items-center justify-between gap-3 py-3 transition-colors cursor-pointer hover:bg-surface-2/40 -mx-2 px-2 rounded-xl active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          style={{ backgroundColor: `${color}18`, color }}
                          className="flex size-10 shrink-0 items-center justify-center rounded-full"
                        >
                          <CategoryIcon name={hit.icon} className="size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-body font-semibold text-ink leading-snug line-clamp-2 block">{name}</span>
                          <span className="block truncate text-caption text-ink-muted tabular-nums">
                            {path ? `${path} · ` : ''}
                            {t('entriesCount', { count: hit.count })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-body font-bold tabular-nums ${kind === 'income' ? 'text-income' : 'text-expense'}`}>
                          {money(hit.total, locale, { currency })}
                        </span>
                        <ChevronRight className="size-4 text-ink-faint rtl:rotate-180" />
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              <>
              {sheetTotals && sheetTotals.length > 0 && (
                <button
                  type="button"
                  onClick={() => router.push(levelEntriesHref)}
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 py-3 -mx-2 px-2 rounded-xl text-start cursor-pointer hover:bg-surface-2/40 active:scale-[0.99] transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                      <ListChecks className="size-5" />
                    </span>
                    <span className="text-body font-semibold text-accent">{t('showEntries')}</span>
                  </span>
                  <ChevronRight className="size-4 text-accent rtl:rotate-180" />
                </button>
              )}
              {!sheetTotals ? (
              <div className="space-y-3 py-4 animate-pulse">
                <div className="h-14 rounded-xl bg-surface-2" />
                <div className="h-14 rounded-xl bg-surface-2" />
                <div className="h-14 rounded-xl bg-surface-2" />
              </div>
            ) : sheetTotals.length === 0 ? (
              <div className="py-12 text-center text-ink-muted">
                <Layers className="size-8 mx-auto text-ink-faint mb-2" />
                <p className="text-body">{t('noData')}</p>
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

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSheetRowClick(item)}
                    onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSheetRowClick(item);
                            }
                          }}
                    className="flex min-h-[56px] items-center justify-between gap-3 py-3 transition-colors cursor-pointer hover:bg-surface-2/40 -mx-2 px-2 rounded-xl active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        style={{
                          backgroundColor: `${color}18`,
                          color: color,
                        }}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full"
                      >
                        <CategoryIcon name={iconName} className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Name wraps to 2 lines without ellipsis */}
                        <span className="text-body font-semibold text-ink leading-snug line-clamp-2 block">
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
                        {money(item.total, locale, { currency })}
                      </span>
                      <ChevronRight className="size-4 text-ink-faint rtl:rotate-180" />
                    </div>
                  </div>
                );
              })
            )}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

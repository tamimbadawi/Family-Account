'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  Filter,
  PieChart,
  Receipt,
  Share2,
  SlidersHorizontal,
  Users,
  Wallet as WalletIcon,
} from 'lucide-react';
import {
  useCategories,
  useEntries,
  useItems,
  useMembers,
  useSubcategories,
  useWallets,
} from '@/lib/data/provider';
import type { EnrichedEntry } from '@/lib/data/types';
import {
  PIVOT_PRESETS,
  type PivotPreset,
  type PresetPeriod,
  resolvePresetPeriod,
} from '@/lib/reports/presets';
import {
  formatLocalDateStr,
  getEgyptWeekStart,
  parseLocalDate,
  pivot,
  type PivotColumnDimension,
  type PivotConfig,
  type PivotMeasure,
  type PivotResult,
  type PivotRowDimension,
} from '@/lib/reports/pivot';
import { PivotTable, type BreadcrumbItem } from './PivotTable';
import { CellEntriesSheet } from './CellEntriesSheet';
import { downloadPivotCsv, sharePivotPng } from './breakdown-share';

function getPresetIcon(iconName: string) {
  switch (iconName) {
    case 'pie-chart':
      return PieChart;
    case 'calendar':
      return Calendar;
    case 'receipt':
      return Receipt;
    case 'wallet':
      return WalletIcon;
    case 'users':
      return Users;
    default:
      return SlidersHorizontal;
  }
}

export function BreakdownTab() {
  const locale = (useLocale() === 'ar' ? 'ar' : 'en') as 'ar' | 'en';
  const t = useTranslations('reports');

  // Load data via hooks
  const entries = useEntries();
  const categories = useCategories();
  const subcategories = useSubcategories();
  const items = useItems();
  const wallets = useWallets();
  const members = useMembers();

  // Maps for quick lookups
  const categoriesMap = React.useMemo(() => {
    const map = new Map();
    categories?.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const subcategoriesMap = React.useMemo(() => {
    const map = new Map();
    subcategories?.forEach((s) => map.set(s.id, s));
    return map;
  }, [subcategories]);

  const itemsMap = React.useMemo(() => {
    const map = new Map();
    items?.forEach((i) => map.set(i.id, i));
    return map;
  }, [items]);

  const walletsMap = React.useMemo(() => {
    const map = new Map();
    wallets?.forEach((w) => map.set(w.id, w));
    return map;
  }, [wallets]);

  const membersMap = React.useMemo(() => {
    const map = new Map();
    members?.forEach((m) => map.set(m.userId, m));
    return map;
  }, [members]);

  // Pivot configuration state (defaulting to preset 1: Where did our money go?)
  const [activePresetId, setActivePresetId] = React.useState<string | null>(
    'where-did-money-go'
  );

  const [config, setConfig] = React.useState<PivotConfig>(() => {
    const initialPreset = PIVOT_PRESETS[0];
    const period = resolvePresetPeriod(initialPreset.periodPreset);
    return {
      measure: initialPreset.config.measure,
      rows: initialPreset.config.rows,
      columns: initialPreset.config.columns,
      period,
      locale,
    };
  });

  const [breadcrumbs, setBreadcrumbs] = React.useState<BreadcrumbItem[]>([]);
  const [showFilters, setShowFilters] = React.useState(false);
  const [shareMenuOpen, setShareMenuOpen] = React.useState(false);

  // Cell drill-down state
  const [cellSheetOpen, setCellSheetOpen] = React.useState(false);
  const [cellSheetData, setCellSheetData] = React.useState<{
    title: string;
    subtitle?: string;
    total?: number;
    entries: EnrichedEntry[];
  }>({
    title: '',
    entries: [],
  });

  // Handle Preset selection
  const handleSelectPreset = (preset: PivotPreset) => {
    setActivePresetId(preset.id);
    setBreadcrumbs([]);

    let filter: PivotConfig['filter'] = undefined;
    if (preset.filterSubcategoryNameEn && subcategories) {
      const sub = subcategories.find(
        (s) => s.nameEn === preset.filterSubcategoryNameEn
      );
      if (sub) {
        filter = { subcategoryId: sub.id, categoryId: sub.categoryId };
      }
    }

    const period = resolvePresetPeriod(preset.periodPreset);
    setConfig({
      measure: preset.config.measure,
      rows: preset.config.rows,
      columns: preset.config.columns,
      period,
      filter,
      locale,
    });
  };

  // Compute Pivot
  const pivotResult: PivotResult = React.useMemo(() => {
    if (!entries) {
      return {
        rowKeys: [],
        rowLabels: [],
        colKeys: [],
        colLabels: [],
        cells: [],
        rowTotals: [],
        colTotals: [],
        grandTotal: 0,
      };
    }

    return pivot(
      entries,
      {
        categories: categoriesMap,
        subcategories: subcategoriesMap,
        items: itemsMap,
        wallets: walletsMap,
        members: membersMap,
        locale,
      },
      config
    );
  }, [
    entries,
    config,
    categoriesMap,
    subcategoriesMap,
    itemsMap,
    walletsMap,
    membersMap,
    locale,
  ]);

  // Row drill-down handler
  const handleRowClick = (rowKey: string, rowLabel: string) => {
    if (config.rows === 'category') {
      setBreadcrumbs([{ level: 'category', id: rowKey, name: rowLabel }]);
      setConfig((prev) => ({
        ...prev,
        rows: 'subcategory',
        filter: { categoryId: rowKey },
      }));
      setActivePresetId(null);
    } else if (config.rows === 'subcategory') {
      const currentCatId = config.filter?.categoryId;
      setBreadcrumbs((prev) => [
        ...prev,
        { level: 'subcategory', id: rowKey, name: rowLabel },
      ]);
      setConfig((prev) => ({
        ...prev,
        rows: 'item',
        filter: { categoryId: currentCatId, subcategoryId: rowKey },
      }));
      setActivePresetId(null);
    }
  };

  // Breadcrumb click handler
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Clicked "All"
      setBreadcrumbs([]);
      setConfig((prev) => ({
        ...prev,
        rows: 'category',
        filter: undefined,
      }));
    } else if (index === 0 && breadcrumbs.length > 1) {
      // Clicked Category level
      const cat = breadcrumbs[0];
      setBreadcrumbs([cat]);
      setConfig((prev) => ({
        ...prev,
        rows: 'subcategory',
        filter: { categoryId: cat.id },
      }));
    }
  };

  // Cell click handler: filters entries and opens drawer sheet
  const handleCellClick = (
    rowKey: string,
    colKey: string,
    value: number,
    rowLabel: string,
    colLabel: string
  ) => {
    if (!entries) return;

    // Filter matching entries
    const matching = entries.filter((e) => {
      // 1. Measure filter
      if (config.measure === 'expense' && e.type !== 'expense') return false;
      if (config.measure === 'income' && e.type !== 'income') return false;

      // 2. Date / Period filter
      if (config.period?.from && e.occurredOn < config.period.from) return false;
      if (config.period?.to && e.occurredOn > config.period.to) return false;

      // 3. Drill-down filter
      if (config.filter?.categoryId && e.categoryId !== config.filter.categoryId) {
        return false;
      }
      if (
        config.filter?.subcategoryId &&
        e.subcategoryId !== config.filter.subcategoryId
      ) {
        return false;
      }

      // 4. Row filter (unless clicking total row)
      if (rowKey !== 'total') {
        if (config.rows === 'category' && e.categoryId !== rowKey) return false;
        if (config.rows === 'subcategory' && e.subcategoryId !== rowKey) return false;
        if (config.rows === 'item' && e.itemId !== rowKey) return false;
        if (config.rows === 'wallet' && e.accountId !== rowKey) return false;
        if (config.rows === 'person' && e.createdBy !== rowKey) return false;
      }

      // 5. Column filter (unless clicking total column)
      if (colKey !== 'total') {
        if (config.columns === 'month' && e.occurredOn.slice(0, 7) !== colKey) {
          return false;
        }
        if (config.columns === 'week') {
          const wStart = formatLocalDateStr(
            getEgyptWeekStart(parseLocalDate(e.occurredOn))
          );
          if (wStart !== colKey) return false;
        }
        if (config.columns === 'wallet' && e.accountId !== colKey) return false;
        if (config.columns === 'category' && e.categoryId !== colKey) return false;
      }

      return true;
    });

    setCellSheetData({
      title: `${rowLabel} · ${colLabel}`,
      subtitle: `${matching.length} ${t('dim.item')}`,
      total: value,
      entries: matching,
    });
    setCellSheetOpen(true);
  };

  // Export handlers
  const handleDownloadCsv = () => {
    downloadPivotCsv(pivotResult, locale);
    setShareMenuOpen(false);
  };

  const handleSharePng = async () => {
    const activePreset = PIVOT_PRESETS.find((p) => p.id === activePresetId);
    const title = activePreset
      ? locale === 'ar'
        ? activePreset.nameAr
        : activePreset.nameEn
      : t('breakdownTitle');
    await sharePivotPng(pivotResult, title, locale);
    setShareMenuOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* 1. Header Action Row: Period, Customize & Share */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        {/* Period button */}
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-surface-2 text-ink hover:text-accent active:scale-95 transition-all text-caption font-medium min-w-0 shrink"
        >
          <Calendar className="size-3.5 text-accent shrink-0" />
          <span className="truncate">
            {activePresetId
              ? PIVOT_PRESETS.find((p) => p.id === activePresetId)?.periodPreset === 'last-6-months'
                ? t('periods.last6')
                : PIVOT_PRESETS.find((p) => p.id === activePresetId)?.periodPreset === 'this-year'
                ? t('periods.thisYear')
                : t('periods.thisMonth')
              : t('period')}
          </span>
        </button>

        {/* Action Buttons: Filter Toggle & Share */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            aria-label={t('customize')}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-full text-caption font-medium transition-all active:scale-95 shrink-0 ${
              showFilters
                ? 'bg-accent text-accent-ink shadow-xs'
                : 'bg-surface-2 text-ink-muted hover:text-ink'
            }`}
          >
            <Filter className="size-3.5 shrink-0" />
            <span>{t('customize')}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShareMenuOpen((prev) => !prev)}
              aria-label={t('share')}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-surface-2 text-ink-muted hover:text-ink active:scale-95 transition-all text-caption font-medium"
            >
              <Share2 className="size-3.5" />
              <span>{t('share')}</span>
            </button>

            {/* Share dropdown popover */}
            {shareMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShareMenuOpen(false)}
                />
                <div className="absolute end-0 top-10 z-40 w-44 rounded-2xl bg-surface p-1.5 shadow-card border border-line text-ink divide-y divide-line/40">
                  <button
                    type="button"
                    onClick={handleSharePng}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-caption font-semibold rounded-xl hover:bg-surface-2 transition-colors text-start"
                  >
                    <Download className="size-4 text-accent shrink-0" />
                    <span>{t('sharePng')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-caption font-semibold rounded-xl hover:bg-surface-2 transition-colors text-start"
                  >
                    <FileSpreadsheet className="size-4 text-accent shrink-0" />
                    <span>{t('shareCsv')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Wrapped Presets Chips (Always complete, never clipped) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PIVOT_PRESETS.map((preset) => {
          const Icon = getPresetIcon(preset.icon);
          const isSelected = activePresetId === preset.id;
          const name = locale === 'ar' ? preset.nameAr : preset.nameEn;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`flex items-center gap-1.5 h-8 px-2.5 rounded-full text-caption font-semibold transition-all active:scale-95 ${
                isSelected
                  ? 'bg-accent text-accent-ink shadow-xs'
                  : 'bg-surface text-ink border border-line/70 hover:bg-surface-2'
              }`}
            >
              <Icon className="size-3.5 shrink-0" />
              <span>{name}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Expandable Filter Chips (Show / Split by / Across / Period) */}
      {showFilters && (
        <div className="space-y-1.5 rounded-card bg-surface p-3 shadow-card border border-line/60">
          {/* Show (Measure) */}
          <div className="flex items-center gap-2 text-caption">
            <span className="w-16 shrink-0 text-ink-muted font-medium">
              {t('show')}:
            </span>
            <div className="flex-1 flex gap-1.5 overflow-x-auto pe-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {(['expense', 'income', 'net'] as PivotMeasure[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setConfig((prev) => ({ ...prev, measure: m }));
                    setActivePresetId(null);
                  }}
                  className={`h-7 px-2.5 rounded-full text-caption whitespace-nowrap shrink-0 transition-all ${
                    config.measure === m
                      ? 'bg-accent text-accent-ink shadow-xs font-semibold'
                      : 'bg-surface-2 text-ink-muted hover:text-ink'
                  }`}
                >
                  {t(m === 'expense' ? 'spent' : m === 'income' ? 'income' : 'net')}
                </button>
              ))}
            </div>
          </div>

          {/* Split by (Rows) */}
          <div className="flex items-center gap-2 text-caption">
            <span className="w-16 shrink-0 text-ink-muted font-medium">
              {t('splitBy')}:
            </span>
            <div className="flex-1 flex gap-1.5 overflow-x-auto pe-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {(
                ['category', 'subcategory', 'item', 'wallet', 'person'] as PivotRowDimension[]
              ).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setConfig((prev) => ({ ...prev, rows: r, filter: undefined }));
                    setBreadcrumbs([]);
                    setActivePresetId(null);
                  }}
                  className={`h-7 px-2.5 rounded-full text-caption whitespace-nowrap shrink-0 transition-all ${
                    config.rows === r
                      ? 'bg-accent text-accent-ink shadow-xs font-semibold'
                      : 'bg-surface-2 text-ink-muted hover:text-ink'
                  }`}
                >
                  {t(`dim.${r}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Across (Columns) */}
          <div className="flex items-center gap-2 text-caption">
            <span className="w-16 shrink-0 text-ink-muted font-medium">
              {t('across')}:
            </span>
            <div className="flex-1 flex gap-1.5 overflow-x-auto pe-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {(
                ['month', 'week', 'wallet', 'none'] as PivotColumnDimension[]
              ).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setConfig((prev) => ({ ...prev, columns: c }));
                    setActivePresetId(null);
                  }}
                  className={`h-7 px-2.5 rounded-full text-caption whitespace-nowrap shrink-0 transition-all ${
                    config.columns === c
                      ? 'bg-accent text-accent-ink shadow-xs font-semibold'
                      : 'bg-surface-2 text-ink-muted hover:text-ink'
                  }`}
                >
                  {t(`dim.${c}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Period */}
          <div className="flex items-center gap-2 text-caption">
            <span className="w-16 shrink-0 text-ink-muted font-medium">
              {t('period')}:
            </span>
            <div className="flex-1 flex gap-1.5 overflow-x-auto pe-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {[
                { id: 'this-month', key: 'thisMonth' },
                { id: 'last-3-months', key: 'last3' },
                { id: 'last-6-months', key: 'last6' },
                { id: 'this-year', key: 'thisYear' },
              ].map((p) => {
                const dates = resolvePresetPeriod(p.id as PresetPeriod);
                const isSelected =
                  config.period?.from === dates.from &&
                  config.period?.to === dates.to;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setConfig((prev) => ({ ...prev, period: dates }));
                      setActivePresetId(null);
                    }}
                    className={`h-7 px-2.5 rounded-full text-caption whitespace-nowrap shrink-0 transition-all ${
                      isSelected
                        ? 'bg-accent text-accent-ink shadow-xs font-semibold'
                        : 'bg-surface-2 text-ink-muted hover:text-ink'
                    }`}
                  >
                    {t(`periods.${p.key}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. Pivot Table */}
      <PivotTable
        result={pivotResult}
        config={config}
        breadcrumbs={breadcrumbs}
        onBreadcrumbClick={handleBreadcrumbClick}
        onRowClick={handleRowClick}
        onCellClick={handleCellClick}
        categoriesMap={categoriesMap}
        subcategoriesMap={subcategoriesMap}
        walletsMap={walletsMap}
      />

      {/* 4. Cell Entries Drill-down Sheet */}
      <CellEntriesSheet
        open={cellSheetOpen}
        onOpenChange={setCellSheetOpen}
        title={cellSheetData.title}
        subtitle={cellSheetData.subtitle}
        total={cellSheetData.total}
        entries={cellSheetData.entries}
      />
    </div>
  );
}

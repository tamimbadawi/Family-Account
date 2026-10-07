'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Plus, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import type { EnrichedEntry } from '@/lib/data/types';
import {
  useCategories,
  useEntries,
  useItems,
  useSubcategories,
  useWallets,
} from '@/lib/data/provider';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { PeriodSwitcher } from '@/components/history/PeriodSwitcher';
import { rangeOf, toISO, type Period } from '@/lib/history/period';
import { DayGroup } from '@/components/history/DayGroup';
import { TypeMenu } from '@/components/history/TypeMenu';
import { useFamilyMembers } from '@/lib/auth/use-family-members';
import { FilterSheet } from '@/components/history/FilterSheet';
import { ItemHistoryCard } from '@/components/history/ItemHistoryCard';
import {
  activeFilterCount,
  byMember,
  EMPTY_FILTERS,
  focusLevel,
  toListParams,
  type HistoryFilters,
} from '@/lib/history/filters';
import { Skeleton } from '@/components/ui/skeleton';
import { pickName } from '@/lib/format';

function HistoryContent() {
  const locale = useLocale();
  const t = useTranslations('history');
  const { openAdd, openEdit } = useEntrySheet();
  const searchParams = useSearchParams();
  const walletParam = searchParams.get('wallet') || undefined;

  // Filters; a wallet opened from "Our money" (?wallet=) starts the list on that wallet
  const [filters, setFilters] = React.useState<HistoryFilters>({ ...EMPTY_FILTERS, walletId: walletParam });
  const [prevWalletParam, setPrevWalletParam] = React.useState(walletParam);
  if (walletParam !== prevWalletParam) {
    setPrevWalletParam(walletParam);
    setFilters((f) => ({ ...f, walletId: walletParam }));
  }
  const [filterOpen, setFilterOpen] = React.useState(false);

  // Day / week / month / year shown, around an anchor date (starts on this month)
  const [period, setPeriod] = React.useState<Period>('month');
  const [anchor, setAnchor] = React.useState(() => toISO(new Date()));
  const range = rangeOf(period, anchor);
  const changePeriod = (p: Period, a: string) => {
    setPeriod(p);
    setAnchor(a);
  };

  const entries = byMember(useEntries(toListParams(filters, range)), filters.memberId);

  // Names for the active-filter chips
  const wallets = useWallets(true);
  const members = useFamilyMembers();
  const categories = useCategories();
  const groups = useSubcategories(filters.categoryId);
  const items = useItems(filters.subcategoryId);
  const nameOf = (row?: { nameAr: string | null; nameEn: string | null } | null) =>
    row ? pickName({ name_ar: row.nameAr, name_en: row.nameEn }, locale) : '';
  const focus = focusLevel(filters);
  const focusName =
    focus === 'item'
      ? nameOf(items?.find((i) => i.id === filters.itemId))
      : focus === 'subcategory'
        ? nameOf(groups?.find((g) => g.id === filters.subcategoryId))
        : focus === 'category'
          ? nameOf(categories?.find((c) => c.id === filters.categoryId))
          : '';
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (focus && focusName) {
    chips.push({
      key: 'category',
      label: focusName,
      clear: () => setFilters((f) => ({ ...f, categoryId: undefined, subcategoryId: undefined, itemId: undefined })),
    });
  }
  if (filters.walletId) {
    chips.push({
      key: 'wallet',
      label: nameOf(wallets?.find((w) => w.id === filters.walletId)) || '…',
      clear: () => setFilters((f) => ({ ...f, walletId: undefined })),
    });
  }
  if (filters.memberId) {
    chips.push({
      key: 'member',
      label: members.find((m) => m.userId === filters.memberId)?.displayName ?? '…',
      clear: () => setFilters((f) => ({ ...f, memberId: undefined })),
    });
  }
  const filterCount = activeFilterCount(filters);

  // Group entries by occurredOn
  const dayGroups = React.useMemo(() => {
    if (!entries) return [];
    const map = new Map<string, EnrichedEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.occurredOn) ?? [];
      list.push(entry);
      map.set(entry.occurredOn, list);
    }
    return Array.from(map.entries()).map(([date, list]) => ({
      date,
      entries: list,
    }));
  }, [entries]);

  const isLoading = entries === undefined;
  const isEmpty = entries !== undefined && entries.length === 0;
  const isFiltered = filterCount > 0 || filters.type !== 'all';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Controls: month, type dropdown + Filter, active filters */}
      <div className="px-5 pt-1 pb-3 space-y-3 shrink-0">
        <PeriodSwitcher period={period} anchor={anchor} onChange={changePeriod} />

        <div className="flex gap-2">
          <TypeMenu value={filters.type} onChange={(type) => setFilters((f) => ({ ...f, type }))} />
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={`relative flex h-12 shrink-0 items-center gap-2 rounded-2xl px-4 text-body font-semibold shadow-card transition-transform active:scale-[0.98] cursor-pointer select-none ${
              filterCount > 0 ? 'bg-accent text-accent-ink' : 'bg-surface text-ink'
            }`}
          >
            <SlidersHorizontal className="size-5" />
            <span>{t('filter')}</span>
            {filterCount > 0 && (
              <span className="flex size-6 items-center justify-center rounded-full bg-accent-ink text-caption font-bold text-accent tabular-nums">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                aria-label={t('removeFilter', { name: chip.label })}
                className="inline-flex min-h-12 max-w-full items-center gap-2 rounded-full bg-accent/12 px-4 text-caption font-semibold text-accent cursor-pointer active:scale-95 transition-transform"
              >
                <span className="truncate">{chip.label}</span>
                <X className="size-4 shrink-0" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </div>

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        value={filters}
        onApply={setFilters}
        range={range}
      />

      {/* Main content: list of day groups or empty / loading state */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {focus && <ItemHistoryCard filters={filters} period={period} anchor={anchor} onAnchorChange={setAnchor} />}

        {isLoading && (
          <div className="px-5 py-3 space-y-4">
            <div className="space-y-3 bg-surface p-4 rounded-card border border-line/40">
              <Skeleton className="h-5 w-32" />
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            </div>

            <div className="space-y-3 bg-surface p-4 rounded-card border border-line/40">
              <Skeleton className="h-5 w-28" />
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          </div>
        )}

        {/* Filtered and nothing matches: a short note, so it stays on screen under the history card */}
        {isEmpty && isFiltered && (
          <div className="px-6 py-8 text-center select-none">
            <h3 className="text-heading font-bold text-ink mb-1">{t(`emptyFiltered.${period}`)}</h3>
            <p className="text-body text-ink-muted">{t('emptyFilteredHint')}</p>
          </div>
        )}

        {isEmpty && !isFiltered && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center select-none">
            <div className="flex size-20 items-center justify-center rounded-full bg-surface-2 text-ink-muted mb-4 shadow-sm">
              <Calendar className="size-10 stroke-[1.5]" />
            </div>
            <h3 className="text-title font-bold text-ink mb-2">
              {t(`empty.${period}`)}
            </h3>
            <p className="text-body text-ink-muted max-w-xs mb-6">
              {t('emptyMonthHint')}
            </p>
            <button
              type="button"
              onClick={() => openAdd()}
              className="flex items-center gap-2 px-6 h-12 rounded-2xl bg-accent text-accent-ink font-semibold shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="size-5" />
              <span>{t('addEntry')}</span>
            </button>
          </div>
        )}

        {!isLoading && !isEmpty && (
          <div className="divide-y divide-line/20">
            {dayGroups.map((group) => (
              <DayGroup
                key={group.date}
                date={group.date}
                entries={group.entries}
                filter={filters.type === 'transfer' ? 'all' : filters.type}
                onEntryClick={(entry) => openEdit(entry)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <React.Suspense fallback={null}>
      <HistoryContent />
    </React.Suspense>
  );
}


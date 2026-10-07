'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Plus, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import type { EnrichedEntry, EntryType } from '@/lib/data/types';
import { useEntries, useWallets } from '@/lib/data/provider';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { MonthSwitcher } from '@/components/history/MonthSwitcher';
import { DayGroup } from '@/components/history/DayGroup';
import { Skeleton } from '@/components/ui/skeleton';
import { pickName } from '@/lib/format';

type FilterType = 'all' | 'expense' | 'income';

function HistoryContent() {
  const locale = useLocale();
  const t = useTranslations('history');
  const { openAdd, openEdit } = useEntrySheet();
  const searchParams = useSearchParams();
  const walletParam = searchParams.get('wallet') || undefined;

  const [prevWalletParam, setPrevWalletParam] = React.useState(walletParam);
  const [overrideWalletId, setOverrideWalletId] = React.useState<string | undefined | null>(null);

  if (walletParam !== prevWalletParam) {
    setPrevWalletParam(walletParam);
    setOverrideWalletId(null);
  }

  const activeWalletId = overrideWalletId !== null ? overrideWalletId : walletParam;

  const wallets = useWallets(true);
  const activeWallet = React.useMemo(() => {
    return wallets?.find((w) => w.id === activeWalletId);
  }, [wallets, activeWalletId]);

  // Current month 'YYYY-MM'
  const currentMonthDefault = React.useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = React.useState<string>(currentMonthDefault);
  const [filter, setFilter] = React.useState<FilterType>('all');

  const queryType: EntryType | undefined =
    filter === 'all' ? undefined : (filter as EntryType);

  const entries = useEntries({
    month: selectedMonth,
    type: queryType,
    accountId: activeWalletId,
  });

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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Controls: Month switcher and filter chips */}
      <div className="px-5 pt-1 pb-3 space-y-3 shrink-0">
        <MonthSwitcher
          value={selectedMonth}
          onChange={setSelectedMonth}
        />

        {/* Filter chips (All / Expenses / Income) */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-2 rounded-2xl select-none">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`h-11 rounded-xl text-body font-medium transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-surface text-ink font-semibold shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('all')}
          </button>
          <button
            type="button"
            onClick={() => setFilter('expense')}
            className={`h-11 rounded-xl text-body font-medium transition-all cursor-pointer ${
              filter === 'expense'
                ? 'bg-surface text-expense font-semibold shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('expenses')}
          </button>
          <button
            type="button"
            onClick={() => setFilter('income')}
            className={`h-11 rounded-xl text-body font-medium transition-all cursor-pointer ${
              filter === 'income'
                ? 'bg-surface text-income font-semibold shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('incomes')}
          </button>
        </div>

        {activeWallet && (
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setOverrideWalletId(undefined)}
              aria-label={t('clearWalletFilter')}
              className="inline-flex items-center gap-2 min-h-12 px-4 rounded-full bg-accent/12 text-accent text-caption font-semibold cursor-pointer active:scale-95 transition-transform"
            >
              <span>
                {pickName({ name_ar: activeWallet.nameAr, name_en: activeWallet.nameEn }, locale) ||
                  activeWallet.id}
              </span>
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* Main content: list of day groups or empty / loading state */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-32 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {isEmpty && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center select-none">
            <div className="flex size-20 items-center justify-center rounded-full bg-surface-2 text-ink-muted mb-4 shadow-sm">
              <Calendar className="size-10 stroke-[1.5]" />
            </div>
            <h3 className="text-title font-bold text-ink mb-2">
              {t('emptyMonth')}
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
                filter={filter}
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


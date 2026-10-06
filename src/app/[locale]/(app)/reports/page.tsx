'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MonthSwitcher } from '@/components/reports/MonthSwitcher';
import { HeroTotalsCard } from '@/components/reports/HeroTotalsCard';
import { CategoryDonut } from '@/components/reports/CategoryDonut';
import { RankedCategories } from '@/components/reports/RankedCategories';
import { SixMonthTrends } from '@/components/reports/SixMonthTrends';
import { WalletBalancesCard } from '@/components/reports/WalletBalancesCard';
import { BreakdownTab } from '@/components/reports/BreakdownTab';
import { useMonthSummary } from '@/lib/data/provider';
import type { CategoryTotal } from '@/lib/data/types';
import { Card } from '@/components/ui/card';

export default function ReportsPage() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const isRtl = locale.startsWith('ar');

  const [activeTab, setActiveTab] = React.useState<'overview' | 'breakdown'>(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      if (search.get('tab') === 'breakdown') {
        return 'breakdown';
      }
    }
    return 'overview';
  });
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    return new Date().toISOString().slice(0, 7);
  });

  const [pageIndex, setPageIndex] = React.useState<0 | 1>(0);
  const touchStartRef = React.useRef<number | null>(null);

  const [donutData, setDonutData] = React.useState<CategoryTotal[]>([]);
  const [donutTotal, setDonutTotal] = React.useState(0);

  const summary = useMonthSummary(selectedMonth);

  const handleCategoryDataLoaded = React.useCallback(
    (data: CategoryTotal[], total: number) => {
      setDonutData(data);
      setDonutTotal(total);
    },
    []
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        // Swiped left
        if (isRtl) {
          setPageIndex(0);
        } else {
          setPageIndex(1);
        }
      } else {
        // Swiped right
        if (isRtl) {
          setPageIndex(1);
        } else {
          setPageIndex(0);
        }
      }
    }
  };

  return (
    <div className="flex h-full flex-col justify-between select-none">
      <div className="space-y-1.5">
        {/* 1. Tabs Segmented Control: Overview / Breakdown */}
        <div className="flex rounded-full bg-surface-2 p-1 text-caption font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 rounded-full py-1.5 transition-all ${
              activeTab === 'overview'
                ? 'bg-surface text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('overview')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('breakdown')}
            className={`flex-1 rounded-full py-1.5 transition-all ${
              activeTab === 'breakdown'
                ? 'bg-surface text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('breakdown')}
          </button>
        </div>

        {activeTab === 'breakdown' ? (
          <BreakdownTab />
        ) : (
          /* Overview Content: 2-Page View */
          <div
            className="relative overflow-hidden -mx-1 px-1 -my-0.5 py-0.5"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {pageIndex === 0 ? (
              /* PAGE 1: MonthSwitcher, HeroCard, Donut, Top 3 Categories + See All */
              <div className="w-full space-y-1">
                {/* Month Switcher */}
                <MonthSwitcher
                  month={selectedMonth}
                  onMonthChange={setSelectedMonth}
                />

                {/* Hero Totals Card */}
                {summary ? (
                  <HeroTotalsCard
                    spent={summary.expense}
                    income={summary.income}
                    net={summary.net}
                  />
                ) : (
                  <div className="h-16 rounded-card bg-surface p-3 shadow-card animate-pulse space-y-2">
                    <div className="h-4 w-20 rounded bg-surface-2" />
                    <div className="h-5 w-32 rounded bg-surface-2" />
                  </div>
                )}

                {/* Category Donut */}
                <Card className="rounded-card bg-surface p-1 shadow-card gap-0">
                  <CategoryDonut
                    data={donutData}
                    total={donutTotal || summary?.expense || 0}
                    height={72}
                  />
                </Card>

                {/* Top 3 Categories + See All Sheet */}
                <RankedCategories
                  month={selectedMonth}
                  kind="expense"
                  onDataLoaded={handleCategoryDataLoaded}
                />
              </div>
            ) : (
              /* PAGE 2: 6-Month Trends and Wallet Balances */
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-heading font-semibold text-ink">
                    {t('trendsAndWallets')}
                  </span>
                  <span className="text-caption text-ink-muted tabular-nums">
                    2 / 2
                  </span>
                </div>

                <SixMonthTrends
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                />

                <WalletBalancesCard />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Page Indicator Dots (Only in Overview mode) */}
      {activeTab === 'overview' && (
        <div className="flex items-center justify-center gap-1 py-0">
          <button
            type="button"
            onClick={() => setPageIndex(0)}
            aria-label="Page 1: Overview"
            className="flex h-11 w-11 items-center justify-center"
          >
            <span
              className={`h-2 rounded-full transition-all duration-300 ${
                pageIndex === 0
                  ? 'w-6 bg-accent'
                  : 'w-2 bg-line hover:bg-ink-faint'
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => setPageIndex(1)}
            aria-label="Page 2: Trends and Wallets"
            className="flex h-11 w-11 items-center justify-center"
          >
            <span
              className={`h-2 rounded-full transition-all duration-300 ${
                pageIndex === 1
                  ? 'w-6 bg-accent'
                  : 'w-2 bg-line hover:bg-ink-faint'
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ChevronRight, Plus, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  useEntries,
  useMonthSummary,
  useCategoryTotals,
  useMembers,
} from '@/lib/data/provider';
import { EntryRow } from '@/components/entry/EntryRow';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryIcon } from '@/components/ui/category-icon';
import { money, pickName } from '@/lib/format';

export default function HomePage() {
  const tHome = useTranslations('home');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  // Current month string 'YYYY-MM'
  const currentMonth = React.useMemo(() => {
    return new Date().toISOString().slice(0, 7);
  }, []);

  // Queries
  const members = useMembers();
  const summary = useMonthSummary(currentMonth);
  const topCategories = useCategoryTotals(currentMonth, 'expense', 'category');
  const entries = useEntries({ limit: 5 });

  // Loading state
  const isLoading = summary === undefined || entries === undefined;

  // Member name for greeting
  const memberName = members?.[0]?.displayName || (locale === 'ar' ? 'ماما' : 'Mama');

  // Greeting based on time of day
  const isMorning = new Date().getHours() < 12;
  const greeting = isMorning
    ? tHome('greetingMorning', { name: memberName })
    : tHome('greetingEvening', { name: memberName });

  if (isLoading) {
    return (
      <div className="space-y-6 pt-2">
        {/* Greeting Skeleton */}
        <Skeleton className="h-6 w-36" />

        {/* Hero Card Skeleton */}
        <div className="space-y-3 rounded-card bg-surface p-6 shadow-card">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Top categories Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-3 gap-2.5">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        </div>

        {/* Recent entries Skeleton */}
        <div className="space-y-3 rounded-card bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  const isEmpty = entries.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center select-none">
        <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Sparkles className="size-10" />
        </div>
        <h2 className="text-title font-bold text-ink">{tHome('emptyTitle')}</h2>
        <p className="mt-2 max-w-xs text-body text-ink-muted">{tHome('emptyBody')}</p>
        <Button className="mt-8 w-full max-w-xs">
          <Plus className="size-5" />
          {tCommon('add')}
        </Button>
      </div>
    );
  }

  const netAmount = summary?.net ?? ((summary?.income ?? 0) - (summary?.expense ?? 0));
  const displayedCategories = (topCategories ?? []).slice(0, 3);

  return (
    <div className="space-y-5 pt-1">
      {/* 1. Greeting */}
      <div>
        <span className="text-heading font-medium text-ink-muted">
          {greeting}
        </span>
      </div>

      {/* 2. Hero Card */}
      <Link href="/reports" className="block active:scale-[0.99] transition-transform">
        <Card className="bg-surface p-6 shadow-card hover:shadow-md transition-shadow">
          <span className="text-heading text-ink-muted">
            {tHome('spentThisMonth')}
          </span>
          <div className="mt-1 text-hero font-bold tabular-nums text-expense">
            {money(summary?.expense ?? 0, locale)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-caption text-ink-muted font-medium">
            <span>
              {tHome('incomeShort', { amount: money(summary?.income ?? 0, locale) })}
            </span>
            <span>·</span>
            <span>
              {tHome('leftShort', { amount: money(netAmount, locale) })}
            </span>
          </div>
        </Card>
      </Link>

      {/* 3. Top categories this month */}
      {displayedCategories.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-heading font-semibold text-ink">
            {tHome('topCategories')}
          </h2>

          <div className="grid grid-cols-3 gap-2.5">
            {displayedCategories.map((cat) => {
              const name = pickName(
                { name_ar: cat.nameAr, name_en: cat.nameEn },
                locale
              );

              return (
                <div
                  key={cat.id}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface p-3 text-center shadow-card select-none"
                >
                  <div
                    style={
                      cat.color
                        ? {
                            backgroundColor: `${cat.color}18`,
                            color: cat.color,
                          }
                        : undefined
                    }
                    className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent"
                  >
                    <CategoryIcon name={cat.icon} className="size-5" />
                  </div>
                  <span className="truncate w-full text-caption font-medium text-ink">
                    {name}
                  </span>
                  <span className="text-caption font-bold tabular-nums text-expense">
                    {money(cat.total, locale, { compact: true })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Recent entries */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-heading font-semibold text-ink">
            {tHome('recent')}
          </h2>
          <Link
            href="/history"
            className="flex items-center gap-0.5 text-caption font-semibold text-accent hover:underline"
          >
            <span>{tCommon('seeAll')}</span>
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Link>
        </div>

        <div className="divide-y divide-line rounded-card bg-surface px-4 py-1 shadow-card">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      </section>
    </div>
  );
}

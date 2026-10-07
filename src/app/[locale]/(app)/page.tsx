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
  useBudgetProgress,
} from '@/lib/data/provider';
import { BudgetAlert } from '@/components/budgets/BudgetAlert';
import { budgetWarnings } from '@/lib/reports/budgets';
import { EntryRow } from '@/components/entry/EntryRow';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryIcon } from '@/components/ui/category-icon';
import { OurMoneyRow } from '@/components/wallets/OurMoneySheet';
import { money, pickName } from '@/lib/format';
import { useSignedInName } from '@/lib/auth/use-signed-in-name';

export default function HomePage() {
  const tHome = useTranslations('home');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { openAdd, openEdit } = useEntrySheet();

  // Current month string 'YYYY-MM'
  const currentMonth = React.useMemo(() => {
    return new Date().toISOString().slice(0, 7);
  }, []);

  // Responsive limit: at most 3 entries, 2 on 701-749px, 1 on <=700px (iPhone SE 375x667, 412x700)
  const [maxRows, setMaxRows] = React.useState(1);
  const [isShort, setIsShort] = React.useState(true);

  React.useEffect(() => {
    const update = () => {
      setMaxRows(window.innerHeight <= 700 ? 1 : (window.innerHeight < 780 ? 2 : 3));
      setIsShort(window.innerHeight <= 700);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Queries
  const members = useMembers();
  const summary = useMonthSummary(currentMonth);
  const topCategories = useCategoryTotals(currentMonth, 'expense', 'category');
  const entries = useEntries({ limit: 3 });
  const budgetProgress = useBudgetProgress(currentMonth);
  const warnings = React.useMemo(() => budgetWarnings(budgetProgress ?? []), [budgetProgress]);

  // Loading state
  const isLoading = summary === undefined || entries === undefined;

  // Greet the signed-in person by their own name; sample data's first member only when sign-in is off
  const signedInName = useSignedInName();
  const memberName = signedInName === null ? members?.[0]?.displayName || 'Mama' : signedInName;

  // Greeting based on time of day (just "Good evening" until the name has loaded)
  const isMorning = new Date().getHours() < 12;
  const greeting = memberName
    ? isMorning
      ? tHome('greetingMorning', { name: memberName })
      : tHome('greetingEvening', { name: memberName })
    : isMorning
      ? tHome('greetingMorningPlain')
      : tHome('greetingEveningPlain');

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-4">
        {/* Greeting Skeleton */}
        <Skeleton className="h-6 w-36" />

        {/* Hero Card Skeleton */}
        <div className="space-y-2 rounded-card bg-surface p-4 shadow-card">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-4 w-36" />
        </div>

        {/* Top categories Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-18 rounded-2xl" />
            <Skeleton className="h-18 rounded-2xl" />
            <Skeleton className="h-18 rounded-2xl" />
          </div>
        </div>

        {/* Our money skeleton */}
        <Skeleton className="h-14 rounded-card" />

        {/* Recent entries Skeleton */}
        <div className="space-y-2 rounded-card bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  const isEmpty = entries.length === 0;

  if (isEmpty) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 pt-1 flex flex-col items-center justify-center py-12 text-center select-none">
        <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Sparkles className="size-10" />
        </div>
        <h2 className="text-title font-bold text-ink">{tHome('emptyTitle')}</h2>
        <p className="mt-2 max-w-xs text-body text-ink-muted">{tHome('emptyBody')}</p>
        <Button onClick={() => openAdd()} className="mt-8 w-full max-w-xs text-accent-ink">
          <Plus className="size-5" />
          {tCommon('add')}
        </Button>
      </div>
    );
  }

  const netAmount = summary?.net ?? ((summary?.income ?? 0) - (summary?.expense ?? 0));
  const displayedCategories = (topCategories ?? []).slice(0, 3);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-3 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-2 select-none">
      {/* 1. Greeting */}
      <div>
        <span className="text-body font-medium text-ink-muted">
          {greeting}
        </span>
      </div>

      {/* 2. Hero Card */}
      <Link href="/reports" className="block active:scale-[0.99] transition-transform">
        <Card className="bg-surface p-3.5 sm:p-5 shadow-card hover:shadow-md transition-shadow">
          <span className="text-caption text-ink-muted font-medium">
            {tHome('spentThisMonth')}
          </span>
          <div className="mt-0.5 text-display sm:text-hero font-bold tabular-nums text-expense leading-tight">
            {money(summary?.expense ?? 0, locale)}
          </div>
          <div className="mt-1 flex items-center gap-2 text-caption text-ink-muted font-medium">
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

      {/* Soft budget warning (80% or more), only when there is one */}
      {warnings.length > 0 && <BudgetAlert warnings={warnings} />}

      {/* 3. Top categories this month */}
      {/* On short screens a budget warning takes the place of the top categories (still in Reports) */}
      {displayedCategories.length > 0 && !(isShort && warnings.length > 0) && (
        <section className="space-y-1">
          <h2 className="text-body font-semibold text-ink">
            {tHome('topCategories')}
          </h2>

          <div className="grid grid-cols-3 gap-2">
            {displayedCategories.map((cat) => {
              const name = pickName(
                { name_ar: cat.nameAr, name_en: cat.nameEn },
                locale
              );

              return (
                <div
                  key={cat.id}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface py-1.5 px-2 text-center shadow-card select-none"
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
                    className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent"
                  >
                    <CategoryIcon name={cat.icon} className="size-4" />
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

      {/* 4. Our money row */}
      <OurMoneyRow />

      {/* 5. Recent entries */}
      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-body font-semibold text-ink">
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

        <div className="divide-y divide-line rounded-card bg-surface px-4 py-0.5 shadow-card">
          {entries.slice(0, warnings.length > 0 && !isShort ? maxRows - 1 : maxRows).map((entry) => (
            <EntryRow key={entry.id} entry={entry} onClick={() => openEdit(entry)} />
          ))}
        </div>
      </section>
    </div>
  );
}

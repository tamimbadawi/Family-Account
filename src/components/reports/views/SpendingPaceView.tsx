'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Gauge, TrendingDown, TrendingUp } from 'lucide-react';
import { useEntries } from '@/lib/data/provider';
import { spendingPace, type SpendingPace } from '@/lib/reports/planning';
import { Card } from '@/components/ui/card';
import { money } from '@/lib/format';
import type { PivotEntry } from '@/lib/data/types';

export function SpendingPaceView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dayOfMonth = React.useMemo(() => new Date().getDate(), []);

  const entries = useEntries();

  const pivotEntries: PivotEntry[] = React.useMemo(() => {
    if (!entries) return [];
    return entries.map((e) => ({
      id: e.id,
      type: e.type,
      amount: e.amount,
      occurredOn: e.occurredOn,
      month: e.occurredOn.slice(0, 7),
      week: '',
      categoryId: e.categoryId ?? null,
      categoryNameAr: e.categoryNameAr ?? null,
      categoryNameEn: e.categoryNameEn ?? null,
      categoryIcon: e.categoryIcon ?? null,
      categoryColor: e.categoryColor ?? null,
      subcategoryId: e.subcategoryId ?? null,
      subcategoryNameAr: e.subcategoryNameAr ?? null,
      subcategoryNameEn: e.subcategoryNameEn ?? null,
      itemId: e.itemId ?? null,
      itemNameAr: e.itemNameAr ?? null,
      itemNameEn: e.itemNameEn ?? null,
      accountId: e.accountId,
      accountNameAr: e.accountNameAr ?? null,
      accountNameEn: e.accountNameEn ?? null,
      createdById: e.createdBy ?? null,
      createdByName: e.createdByName ?? null,
    }));
  }, [entries]);

  const paceData: SpendingPace = React.useMemo(() => {
    if (!pivotEntries.length) {
      return { spentSoFar: 0, typicalByToday: 0, typicalMonth: 0, pace: null };
    }
    return spendingPace(pivotEntries, today, { lookback: 6 });
  }, [pivotEntries, today]);

  const pacePercent = paceData.pace !== null ? Math.round(paceData.pace * 100) : null;
  const isAhead = pacePercent !== null && pacePercent > 5;
  const isBehind = pacePercent !== null && pacePercent < -5;

  const maxVal = Math.max(paceData.spentSoFar, paceData.typicalMonth, 1);
  const spentPercent = Math.min(100, Math.round((paceData.spentSoFar / maxVal) * 100));
  const typicalPercent = Math.min(100, Math.round((paceData.typicalByToday / maxVal) * 100));

  return (
    <div className="space-y-3 select-none">
      {/* Hero Status Card */}
      <Card className="rounded-card bg-surface p-5 shadow-card border border-line/60 text-center space-y-3">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-ink">
          {isAhead ? (
            <TrendingUp className="size-7 text-expense" />
          ) : isBehind ? (
            <TrendingDown className="size-7 text-income" />
          ) : (
            <Gauge className="size-7 text-accent" />
          )}
        </div>

        <div>
          <h2 className="text-title font-bold text-ink">
            {isAhead
              ? t('library.aheadPace')
              : isBehind
              ? t('library.behindPace')
              : t('library.onTrackPace')}
          </h2>
          {pacePercent !== null && (
            <p className="text-body font-semibold tabular-nums mt-1 text-ink-muted">
              {pacePercent > 0 ? `+${pacePercent}%` : `${pacePercent}%`}
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-line/40">
          <p className="text-caption text-ink-muted">
            {locale.startsWith('ar')
              ? `بحلول اليوم ${dayOfMonth} من الشهر، تنفق العائلة عادة حوالي ${money(paceData.typicalByToday, locale, { fractionDigits: 0 })}.`
              : `By day ${dayOfMonth} of the month, typical spending is around ${money(paceData.typicalByToday, locale, { fractionDigits: 0 })}.`}
          </p>
        </div>
      </Card>

      {/* Comparison Stats Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="rounded-card bg-surface p-3.5 shadow-card border border-line/60">
          <span className="text-caption text-ink-muted block">
            {t('library.spentSoFar')}
          </span>
          <span className="text-heading font-bold tabular-nums text-expense block mt-0.5">
            {money(paceData.spentSoFar, locale, { fractionDigits: 0 })}
          </span>
          {/* Progress bar */}
          <div className="mt-2.5 h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
            <div
              style={{ width: `${spentPercent}%` }}
              className="h-full bg-expense rounded-full"
            />
          </div>
        </Card>

        <Card className="rounded-card bg-surface p-3.5 shadow-card border border-line/60">
          <span className="text-caption text-ink-muted block">
            {t('library.typicalByToday')}
          </span>
          <span className="text-heading font-bold tabular-nums text-ink block mt-0.5">
            {money(paceData.typicalByToday, locale, { fractionDigits: 0 })}
          </span>
          {/* Progress bar */}
          <div className="mt-2.5 h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
            <div
              style={{ width: `${typicalPercent}%` }}
              className="h-full bg-accent rounded-full"
            />
          </div>
        </Card>
      </div>

      {/* Full Month Projection Card */}
      <Card className="rounded-card bg-surface p-4 shadow-card border border-line/60 flex items-center justify-between">
        <div className="min-w-0">
          <span className="text-caption font-medium text-ink-muted block">
            {t('library.typicalFullMonth')}
          </span>
          <span className="text-body font-bold tabular-nums text-ink block mt-0.5">
            {money(paceData.typicalMonth, locale, { fractionDigits: 0 })}
          </span>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CheckCircle2 className="size-5" />
        </div>
      </Card>
    </div>
  );
}

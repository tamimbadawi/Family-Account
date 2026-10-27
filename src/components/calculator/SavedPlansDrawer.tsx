'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bookmark, Clock, Trash2, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Card } from '@/components/ui/card';
import {
  type SavedPlan,
  getSavedPlans,
  deleteSavedPlan,
  restoreSavedPlan,
  subscribeSavedPlans,
  MAX_SAVED_PLANS,
} from '@/lib/calc/saved-plans';
import { money } from '@/lib/format';

export function SavedPlansDrawer({
  open,
  onOpenChange,
  onSelectPlan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlan: (plan: SavedPlan) => void;
}) {
  const t = useTranslations('goal');
  const locale = useLocale();
  const plans = React.useSyncExternalStore(subscribeSavedPlans, getSavedPlans, () => []);

  const handleDelete = (plan: SavedPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    const removed = deleteSavedPlan(plan.id);
    if (!removed) return;

    toast(t('planDeleted'), {
      action: {
        label: t('undo'),
        onClick: () => {
          restoreSavedPlan(removed);
        },
      },
      duration: 6000,
    });
  };

  const time = (m: number) =>
    m % 12 === 0 ? t('years', { n: m / 12 }) : t('months', { n: m });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto p-4 max-h-[85vh] flex flex-col select-none">
        <DrawerHeader className="p-0 mb-3 text-start shrink-0">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-title font-bold text-ink">
              {t('savedPlansTitle')}
            </DrawerTitle>
            <span className="text-caption font-semibold px-2 py-1 rounded-full bg-surface-2 text-ink-muted tabular-nums">
              {plans.length}/{MAX_SAVED_PLANS}
            </span>
          </div>
          <p className="text-caption text-ink-muted mt-1">
            {t('savedPlansSubtitle')}
          </p>
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 py-1 [scrollbar-width:none]">
          {plans.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent mx-auto">
                <Bookmark className="size-6" />
              </div>
              <p className="text-body font-semibold text-ink">{t('noSavedPlans')}</p>
              <p className="text-caption text-ink-muted px-4">
                {t('noSavedPlansHint')}
              </p>
            </div>
          ) : (
            plans.map((p) => {
              const formattedDate = new Date(p.createdAt).toLocaleDateString(
                locale === 'ar' ? 'ar-EG' : 'en-US',
                { month: 'short', day: 'numeric' }
              );

              return (
                <Card
                  key={p.id}
                  onClick={() => {
                    onSelectPlan(p);
                    onOpenChange(false);
                  }}
                  className="p-3.5 flex flex-col gap-2 rounded-card bg-surface hover:bg-surface-2/60 active:scale-[0.99] transition-all cursor-pointer border border-line/60 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-body font-bold text-ink truncate">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-2 text-caption text-ink-muted mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          <span>{formattedDate}</span>
                        </span>
                        <span>·</span>
                        <span>{time(p.horizon)}</span>
                        <span>·</span>
                        <span className="capitalize">{t(`sure.${p.sure}`)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label={t('delete')}
                      onClick={(e) => handleDelete(p, e)}
                      className="size-9 rounded-full flex items-center justify-center text-ink-muted hover:text-expense hover:bg-expense-soft transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-line/30">
                    <div className="flex flex-col">
                      <span className="text-caption text-ink-muted">{t('amountPlaced')}</span>
                      <span className="text-body font-bold tabular-nums text-ink">
                        {money(p.amount, locale, { currency: 'EGP' })}
                      </span>
                    </div>

                    <div className="flex flex-col text-end">
                      <span className="text-caption text-ink-muted">{t('expectedGainLabel')}</span>
                      <span className="text-body font-bold tabular-nums text-income">
                        +{money(p.expectedGain, locale, { currency: 'EGP' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-accent-soft text-accent text-caption font-bold tabular-nums shrink-0">
                      <span>{Math.round(p.chance * 100)}%</span>
                      <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

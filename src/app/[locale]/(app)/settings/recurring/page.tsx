'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, ChevronLeft, CreditCard, Plus, Repeat, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { useRecurringRules, useRepository } from '@/lib/data/provider';
import { useSaveError } from '@/components/ui/use-save-error';
import type { EnrichedRecurringRule } from '@/lib/data/types';
import { money, pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { useRecurrenceSummary } from '@/components/entry/useRecurrenceSummary';
import {
  getNextDueDate,
  getDaysUntil,
  getMonthlyEquivalent,
  isSubscriptionRule,
} from '@/lib/recurring/date';

export default function RecurringSettingsPage() {
  const locale = useLocale();
  const t = useTranslations('recurring');
  const tCommon = useTranslations('common');
  const repo = useRepository();
  const saveError = useSaveError();
  const { openAdd } = useEntrySheet();
  const summarize = useRecurrenceSummary();

  const rules = useRecurringRules(false);
  const [stoppingId, setStoppingId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'subscriptions' | 'recurring'>('subscriptions');

  // Today in local YYYY-MM-DD
  const today = React.useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const subscriptions = React.useMemo(() => {
    return (rules ?? []).filter(isSubscriptionRule);
  }, [rules]);

  const otherRules = React.useMemo(() => {
    return (rules ?? []).filter((r) => !isSubscriptionRule(r));
  }, [rules]);

  // Subscriptions monthly total & annual estimate
  const { totalMonthly, annualEstimate, renewingSoonCount } = React.useMemo(() => {
    let monthly = 0;
    let soon = 0;

    for (const sub of subscriptions) {
      monthly += getMonthlyEquivalent(sub.amount, sub.frequency, sub.interval);
      const nextDue = getNextDueDate(sub, today);
      if (nextDue) {
        const days = getDaysUntil(nextDue, today);
        if (days >= 0 && days <= 7) {
          soon++;
        }
      }
    }

    return {
      totalMonthly: Math.round(monthly * 100) / 100,
      annualEstimate: Math.round(monthly * 12),
      renewingSoonCount: soon,
    };
  }, [subscriptions, today]);

  const handleStop = async (rule: EnrichedRecurringRule, isSub: boolean) => {
    try {
      setStoppingId(rule.id);
      await repo.archiveRecurringRule(rule.id, true);
      const successMsg = isSub ? t('subscriptionStopped') : t('stopped') + ' ✓';
      toast(successMsg, {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              await repo.archiveRecurringRule(rule.id, false);
              toast.info(isSub ? t('subscriptionRestored') : t('restored'));
            } catch (err) {
              saveError(err);
            }
          },
        },
        duration: 6000,
      });
    } catch (err) {
      saveError(err);
    } finally {
      setStoppingId(null);
    }
  };

  const handleAddNew = () => {
    if (activeTab === 'subscriptions') {
      openAdd('expense', { initialRecurring: true, initialSubscription: true });
    } else {
      openAdd('expense', { initialRecurring: true });
    }
  };

  const isLoading = rules === undefined;
  const isSubscriptionsEmpty = !isLoading && subscriptions.length === 0;
  const isOtherEmpty = !isLoading && otherRules.length === 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
      {/* Top Header: back chevron + title + New button */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 shrink-0 flex items-center justify-between border-b border-line/30 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/settings"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2 cursor-pointer"
            aria-label={t('back')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </Link>
          <h1 className="text-title font-bold text-ink leading-tight">
            {t('title')}
          </h1>
        </div>

        {/* + New button */}
        <button
          type="button"
          onClick={handleAddNew}
          aria-label={activeTab === 'subscriptions' ? t('newSubscription') : t('addNew')}
          className="flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-2xl bg-accent px-3.5 text-body font-semibold text-accent-ink transition-transform active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="size-5" />
          <span>{activeTab === 'subscriptions' ? t('newSubscription') : t('addNew')}</span>
        </button>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="px-5 pt-3 pb-1 select-none">
        <div className="flex p-1 bg-surface-2 rounded-2xl border border-line/20">
          <button
            type="button"
            onClick={() => setActiveTab('subscriptions')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-body font-semibold transition-all cursor-pointer ${
              activeTab === 'subscriptions'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <CreditCard className="size-4.5" />
            <span>{t('tabSubscriptions')}</span>
            {subscriptions.length > 0 && (
              <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-accent-soft text-accent text-caption font-bold tabular-nums">
                {subscriptions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recurring')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-body font-semibold transition-all cursor-pointer ${
              activeTab === 'recurring'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Repeat className="size-4.5" />
            <span>{t('tabRecurring')}</span>
            {otherRules.length > 0 && (
              <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-surface-3 text-ink-muted text-caption font-bold tabular-nums">
                {otherRules.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-5 py-3 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)]">
        {/* ==================== TAB 1: SUBSCRIPTIONS ==================== */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-4">
            {/* Total Monthly Spend Banner */}
            {subscriptions.length > 0 && (
              <div className="p-4 bg-surface rounded-card border border-line/40 shadow-card select-none">
                <div className="text-caption font-semibold text-ink-muted uppercase tracking-wider">
                  {t('monthlyTotal')}
                </div>
                <div className="text-[28px] font-bold text-ink tabular-nums mt-0.5 leading-tight">
                  {money(totalMonthly, locale)}
                  <span className="text-body font-medium text-ink-muted ms-1.5">
                    {t('perMonth')}
                  </span>
                </div>
                <div className="text-caption text-ink-muted mt-1.5 flex items-center gap-2">
                  <span>{t('activeCount', { count: subscriptions.length })}</span>
                  <span>·</span>
                  <span>{t('annualEstimate', { amount: money(annualEstimate, locale) })}</span>
                </div>
              </div>
            )}

            {/* Upcoming Charge Alert Banner (within 7 days) */}
            {renewingSoonCount > 0 && (
              <div className="flex items-start gap-3 p-3.5 bg-accent-soft rounded-2xl border border-accent/20 select-none">
                <AlertCircle className="size-5 text-accent shrink-0 mt-0.5" />
                <p className="text-body font-medium text-ink leading-snug">
                  {t('renewingSoonAlert', { count: renewingSoonCount })}
                </p>
              </div>
            )}

            {/* Empty State */}
            {isSubscriptionsEmpty && (
              <div className="flex flex-col items-center text-center py-8 px-4">
                <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent mb-3">
                  <CreditCard className="size-8" />
                </div>
                <h2 className="text-heading font-semibold text-ink mb-1">
                  {t('emptySubscriptionsTitle')}
                </h2>
                <p className="text-body text-ink-muted max-w-xs leading-relaxed mb-5">
                  {t('emptySubscriptionsDesc')}
                </p>
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-6 text-body font-semibold text-accent-ink transition-transform active:scale-95 cursor-pointer"
                >
                  <Plus className="size-5" />
                  {t('addSubscription')}
                </button>
              </div>
            )}

            {/* Subscriptions List */}
            {!isLoading && subscriptions.length > 0 && (
              <div className="space-y-3">
                {subscriptions.map((rule) => {
                  const name = pickName(
                    {
                      name_ar: rule.itemNameAr ?? rule.categoryNameAr,
                      name_en: rule.itemNameEn ?? rule.categoryNameEn,
                    },
                    locale
                  );

                  const walletName = pickName(
                    {
                      name_ar: rule.accountNameAr,
                      name_en: rule.accountNameEn,
                    },
                    locale
                  );

                  const nextDue = getNextDueDate(rule, today);
                  const daysUntil = nextDue ? getDaysUntil(nextDue, today) : null;
                  const isStopping = stoppingId === rule.id;

                  // Renewal badge text and styling
                  let renewalBadge: { text: string; isUrgent: boolean } | null = null;
                  if (nextDue && daysUntil !== null) {
                    if (daysUntil === 0) {
                      renewalBadge = { text: t('renewsToday'), isUrgent: true };
                    } else if (daysUntil === 1) {
                      renewalBadge = { text: t('renewsTomorrow'), isUrgent: true };
                    } else if (daysUntil <= 7) {
                      renewalBadge = {
                        text: t('renewsInDays', { days: daysUntil, date: nextDue }),
                        isUrgent: true,
                      };
                    } else {
                      renewalBadge = {
                        text: t('renewsOn', { date: nextDue }),
                        isUrgent: false,
                      };
                    }
                  }

                  return (
                    <div
                      key={rule.id}
                      className="flex flex-col gap-3 p-4 bg-surface rounded-card border border-line/40 shadow-card select-none"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Service / Category Icon */}
                          <div
                            className="flex size-12 shrink-0 items-center justify-center rounded-2xl"
                            style={{
                              backgroundColor: rule.categoryColor ? `${rule.categoryColor}18` : undefined,
                              color: rule.categoryColor ?? undefined,
                            }}
                          >
                            <CategoryIcon name={rule.categoryIcon ?? 'credit-card'} className="size-6" />
                          </div>

                          {/* Name, Wallet / Card Badge & Cycle */}
                          <div className="min-w-0 flex-1">
                            <div className="text-body font-bold text-ink truncate leading-tight">
                              {name}
                            </div>

                            {/* Card / Wallet Pill */}
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-2 text-caption font-semibold text-ink-muted">
                                <CreditCard className="size-3.5 text-accent" />
                                <span className="truncate max-w-[160px]">{walletName || '—'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Amount & Frequency */}
                        <div className="text-end shrink-0">
                          <div className="text-body font-bold text-ink tabular-nums leading-tight">
                            {money(rule.amount, locale, { currency: rule.accountCurrency ?? undefined })}
                          </div>
                          <div className="text-caption text-ink-muted mt-0.5 leading-tight">
                            {rule.frequency === 'yearly' ? t('perYear') : t('perMonth')}
                          </div>
                        </div>
                      </div>

                      {/* Renewal Countdown Badge & Stop Action */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-line/25">
                        <div className="min-w-0 flex-1">
                          {renewalBadge && (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-caption font-semibold ${
                                renewalBadge.isUrgent
                                  ? 'bg-accent-soft text-accent'
                                  : 'bg-surface-2 text-ink-muted'
                              }`}
                            >
                              {renewalBadge.isUrgent && <AlertCircle className="size-3.5" />}
                              <span>{renewalBadge.text}</span>
                            </span>
                          )}
                          {rule.note && (
                            <div className="text-caption text-ink-muted mt-1 truncate">
                              {rule.note}
                            </div>
                          )}
                        </div>

                        {/* Stop action button with tap target >= 48px */}
                        <button
                          type="button"
                          onClick={() => handleStop(rule, true)}
                          disabled={isStopping}
                          aria-label={`${t('stopSubscription')} ${name}`}
                          className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl bg-danger/10 px-3.5 py-2 text-body font-semibold text-danger transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {t('stop')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: ALL RECURRING (BILLS, RENT, ETC.) ==================== */}
        {activeTab === 'recurring' && (
          <div className="space-y-4">
            <p className="text-body text-ink-muted leading-relaxed">
              {t('subtitle')}
            </p>

            {isOtherEmpty && (
              <div className="flex flex-col items-center text-center py-8 px-4">
                <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent mb-3">
                  <Repeat className="size-8" />
                </div>
                <h2 className="text-heading font-semibold text-ink mb-1">
                  {t('emptyTitle')}
                </h2>
                <p className="text-body text-ink-muted max-w-xs leading-relaxed mb-5">
                  {t('emptyDesc')}
                </p>
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-6 text-body font-semibold text-accent-ink transition-transform active:scale-95 cursor-pointer"
                >
                  <Plus className="size-5" />
                  {t('addRecurring')}
                </button>
              </div>
            )}

            {!isLoading && !isOtherEmpty && (
              <div className="space-y-3">
                {otherRules.map((rule) => {
                  const isTransfer = rule.type === 'transfer';
                  const name = isTransfer
                    ? t('fromTo', {
                        from: pickName({ name_ar: rule.accountNameAr, name_en: rule.accountNameEn }, locale),
                        to: pickName({ name_ar: rule.toAccountNameAr, name_en: rule.toAccountNameEn }, locale),
                      })
                    : pickName(
                        {
                          name_ar: rule.itemNameAr ?? rule.categoryNameAr,
                          name_en: rule.itemNameEn ?? rule.categoryNameEn,
                        },
                        locale
                      );

                  const scheduleText = summarize(rule);
                  const isStopping = stoppingId === rule.id;

                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between gap-3 p-4 bg-surface rounded-card border border-line/40 shadow-card select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Icon */}
                        <div
                          className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
                          style={{
                            backgroundColor: rule.categoryColor ? `${rule.categoryColor}18` : undefined,
                            color: rule.categoryColor ?? undefined,
                          }}
                        >
                          {isTransfer ? (
                            <div className="flex size-11 items-center justify-center rounded-2xl bg-surface-2 text-ink">
                              <ArrowRight className="size-5 rtl:rotate-180" />
                            </div>
                          ) : (
                            <CategoryIcon name={rule.categoryIcon} className="size-5" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="min-w-0 flex-1">
                          <div className="text-body font-semibold text-ink truncate leading-tight">
                            {name}
                          </div>
                          <div className="text-caption text-ink-muted leading-tight mt-0.5 truncate">
                            {scheduleText}
                            {rule.note ? ` · ${rule.note}` : ''}
                          </div>
                          <div className="text-body font-bold text-ink tabular-nums mt-1 leading-tight">
                            {money(rule.amount, locale, { currency: rule.accountCurrency ?? undefined })}
                          </div>
                        </div>
                      </div>

                      {/* Stop action button with tap target >= 48px */}
                      <button
                        type="button"
                        onClick={() => handleStop(rule, false)}
                        disabled={isStopping}
                        aria-label={`${t('stop')} ${name}`}
                        className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl bg-danger/10 px-3.5 py-2 text-body font-semibold text-danger transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {t('stop')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

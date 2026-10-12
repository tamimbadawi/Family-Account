'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Car,
  ChevronLeft,
  Gift,
  Heart,
  House,
  PiggyBank,
  Plane,
  Plus,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { useRepository, useSavingsGoals, useWallets } from '@/lib/data/provider';
import { useSaveError } from '@/components/ui/use-save-error';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import type { EnrichedSavingsGoal } from '@/lib/data/types';
import { money, normalizeDigits, pickName } from '@/lib/format';
import { formatGoalTargetDate } from '@/lib/goals/progress';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const GOAL_ICONS = [
  { name: 'sparkles', Icon: Sparkles },
  { name: 'piggy-bank', Icon: PiggyBank },
  { name: 'plane', Icon: Plane },
  { name: 'car', Icon: Car },
  { name: 'house', Icon: House },
  { name: 'gift', Icon: Gift },
  { name: 'heart', Icon: Heart },
  { name: 'trophy', Icon: Trophy },
] as const;

export default function SavingsGoalsPage() {
  const locale = useLocale();
  const t = useTranslations('goals');
  const tCommon = useTranslations('common');
  const repo = useRepository();
  const saveError = useSaveError();
  const { openAdd } = useEntrySheet();
  const shouldReduceMotion = useReducedMotion();

  const goals = useSavingsGoals(false);
  const wallets = useWallets() ?? [];
  const [stoppingId, setStoppingId] = React.useState<string | null>(null);

  // Add Goal Dialog state
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [goalName, setGoalName] = React.useState('');
  const [targetAmountStr, setTargetAmountStr] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('');
  const [selectedIcon, setSelectedIcon] = React.useState<string>('sparkles');
  const [selectedWalletId, setSelectedWalletId] = React.useState<string>('new');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const resetForm = () => {
    setGoalName('');
    setTargetAmountStr('');
    setTargetDate('');
    setSelectedIcon('sparkles');
    setSelectedWalletId('new');
    setIsSubmitting(false);
  };

  const handleStop = async (goal: EnrichedSavingsGoal) => {
    try {
      setStoppingId(goal.id);
      await repo.archiveSavingsGoal(goal.id, true);
      toast(t('stopped') + ' ✓', {
        action: {
          label: tCommon('undo'),
          onClick: async () => {
            try {
              await repo.archiveSavingsGoal(goal.id, false);
              toast.info(t('restored'));
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

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = goalName.trim();
    const cleanAmount = Number(normalizeDigits(targetAmountStr.replace(/,/g, '')));

    if (!cleanName || !(cleanAmount > 0)) return;

    try {
      setIsSubmitting(true);
      let targetWalletId = selectedWalletId;

      if (targetWalletId === 'new') {
        const newWallet = await repo.addWallet({
          nameEn: cleanName,
          nameAr: cleanName,
          type: 'wallet',
          openingBalance: 0,
          icon: selectedIcon,
        });
        targetWalletId = newWallet.id;
      }

      await repo.createSavingsGoal({
        nameEn: cleanName,
        nameAr: cleanName,
        targetAmount: cleanAmount,
        targetDate: targetDate.trim() || null,
        icon: selectedIcon,
        walletId: targetWalletId,
      });

      setIsAddOpen(false);
      resetForm();
      toast.success(t('title') + ' ✓');
    } catch (err) {
      saveError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = goals === undefined;
  const isEmpty = goals !== undefined && goals.length === 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
      {/* Top Header: back chevron + title + New Goal button */}
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

        {/* New Goal action with tap target >= 48px */}
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsAddOpen(true);
          }}
          className="flex min-h-[48px] items-center gap-1.5 rounded-2xl bg-accent px-3.5 py-2 text-body font-semibold text-accent-ink transition-transform active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="size-5" />
          <span>{t('newGoal')}</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-5 py-4 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)]">
        <p className="text-body text-ink-muted leading-relaxed">
          {t('subtitle')}
        </p>
        {isEmpty && (
          <div className="flex flex-col items-center text-center py-8 px-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent mb-3">
              <Target className="size-8" />
            </div>
            <h2 className="text-heading font-semibold text-ink mb-1">
              {t('emptyTitle')}
            </h2>
            <p className="text-body text-ink-muted max-w-xs leading-relaxed">
              {t('emptyDesc')}
            </p>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsAddOpen(true);
              }}
              className="mt-6 flex min-h-[48px] items-center gap-1.5 rounded-2xl bg-accent px-5 py-2.5 text-body font-semibold text-accent-ink transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="size-5" />
              <span>{t('newGoal')}</span>
            </button>
          </div>
        )}

        {!isLoading && !isEmpty && goals && (
          <div className="space-y-3">
            {goals.map((goal) => {
              const name = pickName(
                { name_ar: goal.nameAr, name_en: goal.nameEn },
                locale
              );
              const isStopping = stoppingId === goal.id;
              const formattedDate = formatGoalTargetDate(goal.targetDate, locale);

              return (
                <div
                  key={goal.id}
                  className="p-4 bg-surface rounded-card border border-line/40 shadow-card space-y-3 select-none"
                >
                  {/* Top: Icon + Name + Target Date / Completed Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-income-soft text-income">
                        <CategoryIcon name={goal.icon ?? 'sparkles'} className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-body font-bold text-ink truncate leading-tight">
                          {name}
                        </h2>
                        <div className="text-caption text-ink-muted leading-tight mt-0.5 truncate">
                          {formattedDate ? `${formattedDate} · ` : ''}
                          {goal.walletNameEn ? (
                            <span className="truncate">
                              {pickName({ name_ar: goal.walletNameAr, name_en: goal.walletNameEn }, locale)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Reached celebration badge */}
                    {goal.isReached && (
                      <motion.div
                        initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
                        animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="flex shrink-0 items-center gap-1 rounded-full bg-income-soft px-2.5 py-1 text-caption font-bold text-income select-none"
                      >
                        <Trophy className="size-3.5" />
                        <span>{t('reached')}</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div
                      role="progressbar"
                      aria-valuenow={goal.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-2.5 w-full bg-surface-2 rounded-full overflow-hidden"
                    >
                      <motion.div
                        initial={shouldReduceMotion ? false : { width: 0 }}
                        animate={{ width: `${goal.barPercent}%` }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                        className={`h-full rounded-full ${goal.isReached ? 'bg-income' : 'bg-accent'}`}
                      />
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center justify-between text-caption font-semibold tabular-nums leading-tight">
                      <span className="text-ink">
                        {t('saved', { amount: money(goal.currentAmount, locale) })}
                      </span>
                      <span className="text-ink-muted">
                        {goal.isReached
                          ? `${money(goal.targetAmount, locale)} (100%)`
                          : `${t('left', { amount: money(goal.remaining, locale) })} (${goal.percent}%)`}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-1 gap-2 border-t border-line/20">
                    <button
                      type="button"
                      onClick={() => openAdd('transfer')}
                      className="flex min-h-[48px] items-center gap-1.5 rounded-xl bg-surface-2 hover:bg-line/40 px-3.5 py-2 text-body font-semibold text-accent transition-transform active:scale-95 cursor-pointer"
                    >
                      <Plus className="size-4.5" />
                      <span>{t('addMoney')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStop(goal)}
                      disabled={isStopping}
                      aria-label={`${t('stop')} ${name}`}
                      className="flex min-h-[48px] items-center justify-center rounded-xl bg-danger/10 px-3.5 py-2 text-body font-semibold text-danger transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
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

      {/* Add Goal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-[calc(100%-1.5rem)] gap-4 p-5 rounded-3xl select-none">
          <DialogHeader>
            <DialogTitle className="text-heading font-bold text-ink">
              {t('newGoal')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateGoal} className="space-y-4">
            {/* Goal Name */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t('goalName')}
              </label>
              <Input
                type="text"
                required
                maxLength={60}
                placeholder={t('goalNamePlaceholder')}
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                className="h-12 rounded-2xl bg-surface-2 text-body"
              />
            </div>

            {/* Target Amount */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t('targetAmount')} (EGP)
              </label>
              <Input
                type="text"
                inputMode="decimal"
                required
                placeholder="50,000"
                value={targetAmountStr}
                onChange={(e) => setTargetAmountStr(e.target.value)}
                className="h-12 rounded-2xl bg-surface-2 text-body tabular-nums"
              />
            </div>

            {/* Target Date (optional) */}
            <div className="space-y-1">
              <label className="text-caption font-semibold text-ink-muted">
                {t('targetDate')} ({t('optional')})
              </label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="h-12 rounded-2xl bg-surface-2 text-body"
              />
            </div>

            {/* Icon Picker (8 friendly icons, each >= 48px) */}
            <div className="space-y-1.5">
              <label className="text-caption font-semibold text-ink-muted">
                {t('chooseIcon')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {GOAL_ICONS.map(({ name, Icon }) => {
                  const isSelected = selectedIcon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedIcon(name)}
                      className={`flex h-12 items-center justify-center rounded-2xl transition-transform active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-accent text-accent-ink ring-2 ring-accent'
                          : 'bg-surface-2 text-ink hover:bg-line/40'
                      }`}
                    >
                      <Icon className="size-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wallet Selection */}
            {wallets.length > 0 && (
              <div className="space-y-1">
                <label className="text-caption font-semibold text-ink-muted">
                  {t('chooseWallet')}
                </label>
                <select
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="h-12 w-full rounded-2xl bg-surface-2 px-3 text-body font-medium text-ink focus:outline-none"
                >
                  <option value="new">✨ {t('dedicatedWallet')}</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || !goalName.trim() || !(Number(targetAmountStr) > 0)}
              className="h-14 w-full rounded-2xl bg-accent text-body font-semibold text-accent-ink transition-transform active:scale-98 cursor-pointer disabled:opacity-40"
            >
              {t('addGoal')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

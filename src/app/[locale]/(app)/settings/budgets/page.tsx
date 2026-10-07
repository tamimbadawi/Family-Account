'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import {
  useBudgetProgress,
  useBudgets,
  useCategories,
  useRepository,
  useSubcategories,
} from '@/lib/data/provider';
import type { Budget, Category, Subcategory } from '@/lib/data/types';
import { formatExpression, previewValue } from '@/lib/format/expression';
import { localISODate, money, pickName } from '@/lib/format';
import { AmountPad } from '@/components/entry/AmountPad';
import { BudgetProgressRow, useBudgetNames } from '@/components/budgets/BudgetProgressRow';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';

type Step = 'category' | 'group' | 'amount';

export default function BudgetsPage() {
  const locale = useLocale();
  const t = useTranslations('budgets');
  const tSettings = useTranslations('settings');
  const repo = useRepository();
  const names = useBudgetNames();

  const month = React.useMemo(() => localISODate().slice(0, 7), []);
  const progress = useBudgetProgress(month);
  const budgets = useBudgets();
  const categories = useCategories('expense');

  // Sheet state
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>('category');
  const [category, setCategory] = React.useState<Category | null>(null);
  const [subcategoryId, setSubcategoryId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Budget | null>(null);
  // Opened by tapping a budget in the list: the sheet is only the amount, with no way back to the pickers
  const [fromList, setFromList] = React.useState(false);
  const [amountStr, setAmountStr] = React.useState('');
  const groups = useSubcategories(category?.id ?? '__none__');

  const amount = previewValue(amountStr) ?? 0;
  const name = (n: { nameAr: string | null; nameEn: string | null }) =>
    pickName({ name_ar: n.nameAr, name_en: n.nameEn }, locale);
  const fmt = (n: number) => money(n, locale, { fractionDigits: 0 });

  const budgetFor = (categoryId: string, subId: string | null) =>
    budgets?.find((b) => b.categoryId === categoryId && b.subcategoryId === subId) ?? null;

  const openAdd = () => {
    setEditing(null);
    setFromList(false);
    setCategory(null);
    setSubcategoryId(null);
    setAmountStr('');
    setStep('category');
    setOpen(true);
  };

  const openEdit = (budget: Budget) => {
    setEditing(budget);
    setFromList(true);
    setCategory(names.category(budget.categoryId) ?? null);
    setSubcategoryId(budget.subcategoryId);
    setAmountStr(String(budget.amount));
    setStep('amount');
    setOpen(true);
  };

  const pickTarget = (subId: string | null) => {
    if (!category) return;
    setSubcategoryId(subId);
    const existing = budgetFor(category.id, subId);
    setEditing(existing);
    setAmountStr(existing ? String(existing.amount) : '');
    setStep('amount');
  };

  const pickCategory = async (cat: Category) => {
    setCategory(cat);
    // A category with no groups goes straight to the amount
    const subs = await repo.getSubcategories(cat.id);
    if (subs.length === 0) {
      setSubcategoryId(null);
      const existing = budgetFor(cat.id, null);
      setEditing(existing);
      setAmountStr(existing ? String(existing.amount) : '');
      setStep('amount');
    } else {
      setStep('group');
    }
  };

  const handleSave = async () => {
    if (!category || amount <= 0) return;
    try {
      if (editing) await repo.updateBudget(editing.id, { amount });
      else await repo.addBudget({ categoryId: category.id, subcategoryId, amount });
      setOpen(false);
      toast.success(t('saved'));
    } catch (err) {
      console.error(err);
      toast.error(t('saveFailed'));
    }
  };

  const handleRemove = async () => {
    if (!editing) return;
    const id = editing.id;
    await repo.archiveBudget(id);
    setOpen(false);
    toast(t('removed'), {
      action: {
        label: t('undo'),
        onClick: async () => {
          await repo.archiveBudget(id, false);
        },
      },
      duration: 6000,
    });
  };

  const targetLabel = category
    ? names.label({ categoryId: category.id, subcategoryId })
    : '';

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
      {/* Header: back chevron + large title */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 shrink-0 flex items-center gap-2 border-b border-line/30 select-none">
        <Link
          href="/settings"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2"
          aria-label={tSettings('back')}
        >
          <ChevronLeft className="size-6 rtl:rotate-180" />
        </Link>
        <h1 className="text-title font-bold text-ink truncate">{t('title')}</h1>
      </div>

      <div className="flex-1 px-5 pt-3 pb-24 space-y-2.5 select-none">
        <p className="text-body text-ink-muted px-1">{t('intro')}</p>

        {budgets?.some((b) => b.isStarter) && (
          <p className="rounded-card bg-accent-soft px-3.5 py-2.5 text-body font-medium text-ink">{t('starterHint')}</p>
        )}

        <button
          type="button"
          onClick={openAdd}
          className="w-full flex items-center gap-3 p-2.5 bg-surface rounded-card border-2 border-dashed border-line/60 hover:border-accent text-accent font-semibold transition-all active:scale-[0.99] cursor-pointer"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent/12 text-accent">
            <Plus className="size-5" />
          </div>
          <span className="text-body">{t('add')}</span>
        </button>

        {!progress && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-card" />
            ))}
          </div>
        )}

        {progress && progress.length === 0 && (
          <div className="flex flex-col items-center text-center py-8 px-4">
            <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
              <PiggyBank className="size-8" />
            </div>
            <h2 className="text-heading font-bold text-ink">{t('emptyTitle')}</h2>
            <p className="mt-1 text-body text-ink-muted max-w-xs">{t('emptyBody')}</p>
          </div>
        )}

        {progress && progress.length > 0 && (
          <div className="bg-surface rounded-card border border-line/40 shadow-card divide-y divide-line/30 overflow-hidden">
            {progress.map((p) => (
              <BudgetProgressRow key={p.budget.id} progress={p} names={names} onClick={() => openEdit(p.budget)} />
            ))}
          </div>
        )}
      </div>

      {/* Add / change budget sheet */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92dvh] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto select-none">
          <DrawerHeader className="px-0 pt-3 pb-2 flex flex-row items-center gap-2">
            {step !== 'category' && !fromList && (
              <button
                type="button"
                onClick={() => setStep(step === 'amount' && groups && groups.length > 0 ? 'group' : 'category')}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2"
                aria-label={t('back')}
              >
                <ChevronLeft className="size-6 rtl:rotate-180" />
              </button>
            )}
            <DrawerTitle className="flex-1 text-start text-heading font-bold text-ink">
              {step === 'category' && t('pickCategory')}
              {step === 'group' && category && t('pickGroup', { name: name(category) })}
              {step === 'amount' && t('howMuch', { name: targetLabel })}
            </DrawerTitle>
          </DrawerHeader>

          {step === 'category' && (
            <div className="bg-surface rounded-card border border-line/40 divide-y divide-line/30 overflow-hidden">
              {(categories ?? []).map((cat) => {
                const existing = budgetFor(cat.id, null);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => pickCategory(cat)}
                    className="w-full flex min-h-14 items-center gap-3 px-3.5 py-2 text-start hover:bg-surface-2/40 active:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <div
                      style={cat.color ? { backgroundColor: `${cat.color}18`, color: cat.color } : undefined}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                    >
                      <CategoryIcon name={cat.icon} className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-semibold text-ink">{name(cat)}</div>
                      {existing && (
                        <div className="text-caption text-ink-muted tabular-nums">
                          {t('hasBudget', { amount: fmt(existing.amount) })}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
                  </button>
                );
              })}
            </div>
          )}

          {step === 'group' && category && (
            <div className="bg-surface rounded-card border border-line/40 divide-y divide-line/30 overflow-hidden">
              <GroupRow
                label={t('wholeCategory', { name: name(category) })}
                hint={budgetFor(category.id, null)}
                strong
                onClick={() => pickTarget(null)}
                fmt={fmt}
              />
              {(groups ?? []).map((g: Subcategory) => (
                <GroupRow
                  key={g.id}
                  label={name(g)}
                  hint={budgetFor(category.id, g.id)}
                  onClick={() => pickTarget(g.id)}
                  fmt={fmt}
                />
              ))}
            </div>
          )}

          {step === 'amount' && (
            <div className="space-y-3">
              <div className="text-center py-1">
                <div className="text-display font-bold tabular-nums text-ink">{fmt(amount)}</div>
                {/[+\-*/]/.test(amountStr) ? (
                  <div className="text-caption text-ink-muted tabular-nums" dir="ltr">
                    {formatExpression(amountStr)}
                  </div>
                ) : (
                  <div className="text-caption text-ink-muted">{t('perMonth')}</div>
                )}
              </div>

              <AmountPad value={amountStr} onChange={setAmountStr} />

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 h-13 rounded-2xl bg-surface-2 text-ink text-body font-semibold active:scale-95 transition-all cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={amount <= 0}
                  className="flex-1 h-13 rounded-2xl bg-accent text-accent-ink text-body font-semibold shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {t('save')}
                </button>
              </div>

              {editing && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl text-expense text-body font-semibold hover:bg-expense-soft active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="size-5" />
                  {t('remove')}
                </button>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function GroupRow({
  label,
  hint,
  strong,
  onClick,
  fmt,
}: {
  label: string;
  hint: Budget | null;
  strong?: boolean;
  onClick: () => void;
  fmt: (n: number) => string;
}) {
  const t = useTranslations('budgets');
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex min-h-13 items-center gap-3 px-3.5 py-2 text-start hover:bg-surface-2/40 active:bg-surface-2 transition-colors cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <div className={`text-body text-ink ${strong ? 'font-bold' : 'font-medium'}`}>{label}</div>
        {hint && (
          <div className="text-caption text-ink-muted tabular-nums">{t('hasBudget', { amount: fmt(hint.amount) })}</div>
        )}
      </div>
      <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
    </button>
  );
}

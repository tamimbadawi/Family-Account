'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronLeft, ChevronRight, Shapes } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { useCategories, useEntries, useItems, useSubcategories, useWallets } from '@/lib/data/provider';
import { useEntryAuthor, useFamilyMembers } from '@/lib/auth/use-family-members';
import { pickName } from '@/lib/format';
import {
  applyFilters,
  EMPTY_FILTERS,
  hasPick,
  toggleId,
  togglePick,
  toListParams,
  type CategoryPick,
  type HistoryFilters,
} from '@/lib/history/filters';
import type { Range } from '@/lib/history/period';

type Step = 'main' | 'categories' | 'groups' | 'items';

const ROW =
  'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-start transition-colors active:bg-surface-2 cursor-pointer';
const CHIP = 'inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-body font-semibold transition-transform active:scale-95 cursor-pointer';

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: HistoryFilters;
  onApply: (next: HistoryFilters) => void;
  range: Range;
}

/** Bottom sheet to narrow History by categories / groups / items, wallets and who entered it. Each part takes several choices. */
export function FilterSheet({ open, onOpenChange, value, onApply, range }: FilterSheetProps) {
  const t = useTranslations('history');
  const locale = useLocale();
  const [draft, setDraft] = React.useState<HistoryFilters>(value);
  const [step, setStep] = React.useState<Step>('main');
  // The category / group being looked inside (several can be chosen, so this is only where we are)
  const [browseCategoryId, setBrowseCategoryId] = React.useState<string>();
  const [browseGroupId, setBrowseGroupId] = React.useState<string>();

  // Each time the sheet opens it starts from what is applied now
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(value);
      setStep('main');
    }
  }

  const categories = useCategories();
  const allGroups = useSubcategories();
  const allItems = useItems();
  const wallets = useWallets();
  const members = useFamilyMembers();
  const authorOf = useEntryAuthor();
  const preview = applyFilters(useEntries(toListParams(draft, range)), draft, authorOf);

  const name = (row?: { nameAr: string | null; nameEn: string | null } | null) =>
    row ? pickName({ name_ar: row.nameAr, name_en: row.nameEn }, locale) : '';
  const browseCategory = categories?.find((c) => c.id === browseCategoryId);
  const browseGroup = allGroups?.find((g) => g.id === browseGroupId);
  const groups = allGroups?.filter((g) => g.categoryId === browseCategoryId);
  const items = allItems?.filter((i) => i.subcategoryId === browseGroupId);

  const pickRowOf = (p: CategoryPick) =>
    p.itemId
      ? allItems?.find((i) => i.id === p.itemId)
      : p.subcategoryId
        ? allGroups?.find((g) => g.id === p.subcategoryId)
        : categories?.find((c) => c.id === p.categoryId);
  const picks = draft.picks;
  const onlyPick = picks.length === 1 ? picks[0] : undefined;
  const onlyCategory = onlyPick ? categories?.find((c) => c.id === onlyPick.categoryId) : undefined;
  const categoryLabel =
    picks.length === 0 ? t('anyCategory') : onlyPick ? name(pickRowOf(onlyPick)) : t('chosenCount', { count: picks.length });
  const categoryCaption = !onlyPick
    ? picks.map((p) => name(pickRowOf(p))).filter(Boolean).join(', ')
    : onlyPick.itemId
      ? [name(onlyCategory), name(allGroups?.find((g) => g.id === onlyPick.subcategoryId))].filter(Boolean).join(' › ')
      : onlyPick.subcategoryId
        ? name(onlyCategory)
        : '';

  const toggle = (p: CategoryPick) => setDraft({ ...draft, picks: togglePick(draft.picks, p) });

  const back = () => setStep(step === 'items' ? 'groups' : step === 'groups' ? 'categories' : 'main');
  const title =
    step === 'categories' ? t('chooseCategory') : step === 'groups' ? name(browseCategory) : step === 'items' ? name(browseGroup) : t('filter');

  const pickRow = (
    key: string,
    label: string,
    selected: boolean,
    onClick: () => void,
    opts?: { icon?: React.ReactNode; drill?: boolean; toggle?: boolean }
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={opts?.toggle ? selected : undefined}
      className={ROW}
    >
      {opts?.icon}
      <span className={`flex-1 truncate text-body ${selected ? 'font-semibold text-accent' : 'font-medium text-ink'}`}>{label}</span>
      {selected && <Check className="size-5 shrink-0 text-accent" />}
      {opts?.drill && <ChevronRight className="size-5 shrink-0 text-ink-muted rtl:rotate-180" />}
    </button>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <div className="flex min-h-0 flex-col">
          <DrawerHeader className="flex flex-row items-center gap-2 px-4 pt-1 pb-2">
            {step !== 'main' && (
              <button
                type="button"
                onClick={back}
                aria-label={t('back')}
                className="-ms-1 flex size-11 shrink-0 items-center justify-center rounded-full text-accent active:bg-surface-2 cursor-pointer"
              >
                <ChevronLeft className="size-6 rtl:rotate-180" />
              </button>
            )}
            <DrawerTitle className="flex-1 truncate text-start text-title font-bold text-ink">{title}</DrawerTitle>
            {step === 'main' && (
              <button
                type="button"
                onClick={() => setDraft({ ...EMPTY_FILTERS, type: draft.type })}
                className="min-h-11 rounded-full px-3 text-body font-semibold text-accent active:bg-surface-2 cursor-pointer"
              >
                {t('clearAll')}
              </button>
            )}
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
            {step === 'main' && (
              <div className="space-y-5">
                <section className="space-y-2">
                  <h3 className="text-caption font-semibold text-ink-muted">{t('category')}</h3>
                  <button
                    type="button"
                    onClick={() => setStep('categories')}
                    className="flex min-h-16 w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-3 text-start active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    {onlyCategory ? (
                      <CategoryIcon name={onlyCategory.icon} className="size-6 shrink-0" style={{ color: onlyCategory.color ?? undefined }} />
                    ) : (
                      <Shapes className="size-6 shrink-0 text-ink-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-ink">{categoryLabel}</span>
                      {categoryCaption && <span className="block truncate text-caption text-ink-muted">{categoryCaption}</span>}
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-ink-muted rtl:rotate-180" />
                  </button>
                </section>

                <section className="space-y-2">
                  <h3 className="text-caption font-semibold text-ink-muted">{t('wallet')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {[{ id: undefined, label: t('anyWallet') }, ...(wallets ?? []).map((w) => ({ id: w.id, label: name(w) }))].map((w) => {
                      const on = w.id ? draft.walletIds.includes(w.id) : draft.walletIds.length === 0;
                      return (
                        <button
                          key={w.id ?? 'any'}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setDraft({ ...draft, walletIds: w.id ? toggleId(draft.walletIds, w.id) : [] })}
                          className={`${CHIP} ${on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'}`}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {members.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-caption font-semibold text-ink-muted">{t('who')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {[{ id: undefined, label: t('anyone') }, ...members.map((m) => ({ id: m.userId, label: m.displayName }))].map((m) => {
                        const on = m.id ? draft.memberIds.includes(m.id) : draft.memberIds.length === 0;
                        return (
                          <button
                            key={m.id ?? 'any'}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setDraft({ ...draft, memberIds: m.id ? toggleId(draft.memberIds, m.id) : [] })}
                            className={`${CHIP} ${on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'}`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}

            {step === 'categories' && (
              <div className="divide-y divide-line/40 overflow-hidden rounded-card bg-surface-2">
                {pickRow('any', t('anyCategory'), picks.length === 0, () => {
                  setDraft({ ...draft, picks: [] });
                  setStep('main');
                }, { icon: <Shapes className="size-6 shrink-0 text-ink-muted" /> })}
                {(categories ?? []).map((c) =>
                  pickRow(
                    c.id,
                    name(c),
                    picks.some((p) => p.categoryId === c.id),
                    () => {
                      setBrowseCategoryId(c.id);
                      setStep('groups');
                    },
                    {
                      icon: <CategoryIcon name={c.icon} className="size-6 shrink-0" style={{ color: c.color ?? undefined }} />,
                      drill: true,
                    }
                  )
                )}
              </div>
            )}

            {step === 'groups' && browseCategoryId && (
              <div className="divide-y divide-line/40 overflow-hidden rounded-card bg-surface-2">
                {pickRow(
                  'all',
                  t('allOf', { name: name(browseCategory) }),
                  hasPick(picks, { categoryId: browseCategoryId }),
                  () => toggle({ categoryId: browseCategoryId }),
                  { toggle: true }
                )}
                {(groups ?? []).map((g) =>
                  pickRow(
                    g.id,
                    name(g),
                    picks.some((p) => p.subcategoryId === g.id),
                    () => {
                      setBrowseGroupId(g.id);
                      setStep('items');
                    },
                    { drill: true }
                  )
                )}
              </div>
            )}

            {step === 'items' && browseCategoryId && browseGroupId && (
              <div className="divide-y divide-line/40 overflow-hidden rounded-card bg-surface-2">
                {pickRow(
                  'all',
                  t('allOf', { name: name(browseGroup) }),
                  hasPick(picks, { categoryId: browseCategoryId, subcategoryId: browseGroupId }),
                  () => toggle({ categoryId: browseCategoryId, subcategoryId: browseGroupId }),
                  { toggle: true }
                )}
                {(items ?? []).map((i) => {
                  const p = { categoryId: browseCategoryId, subcategoryId: browseGroupId, itemId: i.id };
                  return pickRow(i.id, name(i), hasPick(picks, p), () => toggle(p), { toggle: true });
                })}
              </div>
            )}
          </div>

          {step !== 'main' && (
            <div className="shrink-0 border-t border-line/40 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button onClick={() => setStep('main')} className="h-14 w-full text-heading font-semibold text-accent-ink">
                {t('done')}
              </Button>
            </div>
          )}

          {step === 'main' && (
            <div className="shrink-0 border-t border-line/40 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                onClick={() => {
                  onApply(draft);
                  onOpenChange(false);
                }}
                className="h-14 w-full text-heading font-semibold text-accent-ink"
              >
                {preview === undefined ? t('showResults') : t('showCount', { count: preview.length })}
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

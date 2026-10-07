'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronLeft, ChevronRight, Shapes } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { useCategories, useEntries, useHouseholdMembers, useItems, useSubcategories, useWallets } from '@/lib/data/provider';
import { pickName } from '@/lib/format';
import { byMember, EMPTY_FILTERS, toListParams, type HistoryFilters } from '@/lib/history/filters';

type Step = 'main' | 'categories' | 'groups' | 'items';

const ROW =
  'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-start transition-colors active:bg-surface-2 cursor-pointer';
const CHIP = 'inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-body font-semibold transition-transform active:scale-95 cursor-pointer';

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: HistoryFilters;
  onApply: (next: HistoryFilters) => void;
  month: string;
}

/** Bottom sheet to narrow History by category → group → item, wallet and who entered it. */
export function FilterSheet({ open, onOpenChange, value, onApply, month }: FilterSheetProps) {
  const t = useTranslations('history');
  const locale = useLocale();
  const [draft, setDraft] = React.useState<HistoryFilters>(value);
  const [step, setStep] = React.useState<Step>('main');

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
  const groups = useSubcategories(draft.categoryId);
  const items = useItems(draft.subcategoryId);
  const wallets = useWallets();
  const members = useHouseholdMembers();
  const preview = byMember(useEntries(toListParams(draft, { month })), draft.memberId);

  const name = (row?: { nameAr: string | null; nameEn: string | null } | null) =>
    row ? pickName({ name_ar: row.nameAr, name_en: row.nameEn }, locale) : '';
  const category = categories?.find((c) => c.id === draft.categoryId);
  const group = groups?.find((s) => s.id === draft.subcategoryId);
  const item = items?.find((i) => i.id === draft.itemId);
  const categoryLabel = item ? name(item) : group ? name(group) : category ? name(category) : t('anyCategory');
  const categoryPath = [category, group].filter(Boolean).map((r) => name(r)).join(' › ');

  const back = () => setStep(step === 'items' ? 'groups' : step === 'groups' ? 'categories' : 'main');
  const title =
    step === 'categories' ? t('chooseCategory') : step === 'groups' ? name(category) : step === 'items' ? name(group) : t('filter');

  const pickRow = (label: string, selected: boolean, onClick: () => void, opts?: { icon?: React.ReactNode; drill?: boolean }) => (
    <button type="button" onClick={onClick} className={ROW}>
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
                    {category ? (
                      <CategoryIcon name={category.icon} className="size-6 shrink-0" style={{ color: category.color ?? undefined }} />
                    ) : (
                      <Shapes className="size-6 shrink-0 text-ink-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-ink">{categoryLabel}</span>
                      {(group || item) && <span className="block truncate text-caption text-ink-muted">{categoryPath}</span>}
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-ink-muted rtl:rotate-180" />
                  </button>
                </section>

                <section className="space-y-2">
                  <h3 className="text-caption font-semibold text-ink-muted">{t('wallet')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {[{ id: undefined, label: t('anyWallet') }, ...(wallets ?? []).map((w) => ({ id: w.id, label: name(w) }))].map((w) => {
                      const on = draft.walletId === w.id;
                      return (
                        <button
                          key={w.id ?? 'any'}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setDraft({ ...draft, walletId: w.id })}
                          className={`${CHIP} ${on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'}`}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {members.length > 1 && (
                  <section className="space-y-2">
                    <h3 className="text-caption font-semibold text-ink-muted">{t('who')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {[{ id: undefined, label: t('anyone') }, ...members.map((m) => ({ id: m.userId, label: m.displayName }))].map((m) => {
                        const on = draft.memberId === m.id;
                        return (
                          <button
                            key={m.id ?? 'any'}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setDraft({ ...draft, memberId: m.id })}
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
                {pickRow(t('anyCategory'), !draft.categoryId, () => {
                  setDraft({ ...draft, categoryId: undefined, subcategoryId: undefined, itemId: undefined });
                  setStep('main');
                }, { icon: <Shapes className="size-6 shrink-0 text-ink-muted" /> })}
                {(categories ?? []).map((c) =>
                  pickRow(
                    name(c),
                    draft.categoryId === c.id,
                    () => {
                      setDraft({ ...draft, categoryId: c.id, subcategoryId: undefined, itemId: undefined });
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

            {step === 'groups' && (
              <div className="divide-y divide-line/40 overflow-hidden rounded-card bg-surface-2">
                {pickRow(t('allOf', { name: name(category) }), !draft.subcategoryId, () => {
                  setDraft({ ...draft, subcategoryId: undefined, itemId: undefined });
                  setStep('main');
                })}
                {(groups ?? []).map((s) =>
                  pickRow(
                    name(s),
                    draft.subcategoryId === s.id,
                    () => {
                      setDraft({ ...draft, subcategoryId: s.id, itemId: undefined });
                      setStep('items');
                    },
                    { drill: true }
                  )
                )}
              </div>
            )}

            {step === 'items' && (
              <div className="divide-y divide-line/40 overflow-hidden rounded-card bg-surface-2">
                {pickRow(t('allOf', { name: name(group) }), !draft.itemId, () => {
                  setDraft({ ...draft, itemId: undefined });
                  setStep('main');
                })}
                {(items ?? []).map((i) =>
                  pickRow(name(i), draft.itemId === i.id, () => {
                    setDraft({ ...draft, itemId: i.id });
                    setStep('main');
                  })
                )}
              </div>
            )}
          </div>

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

'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronLeft, X } from 'lucide-react';
import type { Category, CategoryKind, Item, Subcategory } from '@/lib/data/types';
import { useCategories, useItems, useRepository, useSubcategories } from '@/lib/data/provider';
import { CategoryIcon } from '@/components/ui/category-icon';
import { pickName } from '@/lib/format';
import {
  CategoryFormDrawer,
  type CategoryFormValues,
} from '@/components/settings/CategoryFormDrawer';

export interface CategoryRowProps {
  kind: CategoryKind;
  selected: Item | null;
  onPick: (item: Item) => void;
  onClear: () => void;
  /** Where to show the "you are in" chip (next to the amount); without it the chip stays first in the row. */
  breadcrumbSlot?: HTMLElement | null;
  /** The category and group currently open (an entry can be saved at either level). */
  onPathChange?: (category: Category | null, subcategory: Subcategory | null) => void;
}

type Step = 'category' | 'subcategory' | 'item';

const CHIP =
  'inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-4 text-body font-semibold transition-transform active:scale-95 cursor-pointer';

/**
 * One swipeable row of chips: category → group → item.
 * Compact so the whole entry sheet fits one iPhone screen.
 */
export function CategoryRow({ kind, selected, onPick, onClear, onPathChange, breadcrumbSlot }: CategoryRowProps) {
  const t = useTranslations('entry');
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const repo = useRepository();
  const rowRef = React.useRef<HTMLDivElement>(null);

  const [step, setStep] = React.useState<Step>('category');
  const [category, setCategory] = React.useState<Category | null>(null);
  const [subcategory, setSubcategory] = React.useState<Subcategory | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  // Reset when kind changes (expense <-> income)
  const [prevKind, setPrevKind] = React.useState(kind);
  if (prevKind !== kind) {
    setPrevKind(kind);
    setStep('category');
    setCategory(null);
    setSubcategory(null);
    setIsCreating(false);
  }

  React.useEffect(() => {
    onPathChange?.(category, subcategory);
  }, [category, subcategory, onPathChange]);

  const categories = useCategories(kind);
  const subcategories = useSubcategories(category?.id);
  const items = useItems(subcategory?.id);

  // Each step starts from the beginning of the row
  React.useEffect(() => {
    rowRef.current?.scrollTo({ left: 0 });
  }, [step]);

  const name = (row: { nameAr: string | null; nameEn: string | null } | null | undefined) =>
    pickName({ name_ar: row?.nameAr, name_en: row?.nameEn }, locale);

  const goBack = () => {
    if (step === 'item') {
      setSubcategory(null);
      setStep('subcategory');
    } else {
      setCategory(null);
      setStep('category');
    }
  };

  // Same form as Settings → Categories: both names, plus colour and icon for categories
  const handleCreate = async ({ nameAr, nameEn, color, icon }: CategoryFormValues) => {
    // A new category or group comes with a matching group/item of the same name and is chosen at once,
    // so Save works straight away (an entry needs an item; nobody should have to build three levels first)
    if (step === 'category') {
      const created = await repo.addCategory({ kind, nameAr, nameEn, color, icon });
      const group = await repo.addSubcategory({ categoryId: created.id, nameAr, nameEn });
      const item = await repo.addItem({ subcategoryId: group.id, nameAr, nameEn });
      setCategory(created);
      setSubcategory(group);
      setStep('item');
      onPick(item);
    } else if (step === 'subcategory' && category) {
      const created = await repo.addSubcategory({ categoryId: category.id, nameAr, nameEn });
      const item = await repo.addItem({ subcategoryId: created.id, nameAr, nameEn });
      setSubcategory(created);
      setStep('item');
      onPick(item);
    } else if (step === 'item' && subcategory) {
      const created = await repo.addItem({ subcategoryId: subcategory.id, nameAr, nameEn });
      onPick(created);
    }
    setIsCreating(false);
  };

  // Chosen item: one chip, tap to choose again
  if (selected) {
    return (
      <div className="flex h-12 items-center">
        <button
          type="button"
          onClick={onClear}
          className={`${CHIP} max-w-full bg-accent text-accent-ink shadow-card`}
        >
          <Check className="size-5 shrink-0" />
          <span className="truncate">{name(selected)}</span>
          <X className="size-4 shrink-0 opacity-80" aria-label={t('change')} />
        </button>
      </div>
    );
  }

  const options: { id: string; label: string; icon?: string | null; color?: string | null; onClick: () => void }[] =
    step === 'category'
      ? (categories ?? []).map((c) => ({
          id: c.id,
          label: name(c),
          icon: c.icon,
          color: c.color,
          onClick: () => {
            setCategory(c);
            setStep('subcategory');
          },
        }))
      : step === 'subcategory'
        ? (subcategories ?? []).map((s) => ({
            id: s.id,
            label: name(s),
            onClick: () => {
              setSubcategory(s);
              setStep('item');
            },
          }))
        : (items ?? []).map((i) => ({ id: i.id, label: name(i), onClick: () => onPick(i) }));

  const newLabel =
    step === 'category' ? t('newCategory') : step === 'subcategory' ? t('newSubcategory') : t('newItem');
  const formTitle =
    step === 'category'
      ? tSettings('addCategory')
      : step === 'subcategory'
        ? tSettings('addSubcategory')
        : tSettings('addItem');

  // "You are in": the main category (and group), highlighted; tapping it steps back one level
  const breadcrumb = (
    <button
      type="button"
      onClick={goBack}
      aria-label={t('backTo', { name: step === 'item' ? name(subcategory) : name(category) })}
      data-breadcrumb
      className={`${CHIP} max-w-full gap-1.5 bg-accent-soft px-3 text-accent shadow-card`}
    >
      <ChevronLeft className="size-5 shrink-0 rtl:rotate-180" />
      <span style={category?.color ? { color: category.color } : undefined} className="shrink-0">
        <CategoryIcon name={category?.icon} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col items-start text-start leading-tight">
        <span className="max-w-full truncate">{name(category)}</span>
        {step === 'item' && subcategory && (
          <span className="max-w-full truncate text-caption font-medium opacity-80">{name(subcategory)}</span>
        )}
      </span>
    </button>
  );

  return (
    <div
      ref={rowRef}
      className="-mx-5 flex gap-2 overflow-x-auto px-5 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {step !== 'category' && !breadcrumbSlot && breadcrumb}
      {step !== 'category' && breadcrumbSlot && createPortal(breadcrumb, breadcrumbSlot)}

      {options.map((o) => (
        <button key={o.id} type="button" onClick={o.onClick} className={`${CHIP} bg-surface-2 text-ink`}>
          {step === 'category' && (
            <span style={o.color ? { color: o.color } : undefined} className="text-accent">
              <CategoryIcon name={o.icon} className="size-5" />
            </span>
          )}
          <span>{o.label}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setIsCreating(true)}
        className={`${CHIP} border-2 border-dashed border-line text-ink-muted`}
      >
        {newLabel}
      </button>

      <CategoryFormDrawer
        nested
        open={isCreating}
        onOpenChange={setIsCreating}
        level={step}
        title={formTitle}
        onSave={handleCreate}
      />
    </div>
  );
}

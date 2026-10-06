'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronLeft, X } from 'lucide-react';
import type { Category, CategoryKind, Item, Subcategory } from '@/lib/data/types';
import { useCategories, useItems, useRepository, useSubcategories } from '@/lib/data/provider';
import { CategoryIcon } from '@/components/ui/category-icon';
import { pickName } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface CategoryRowProps {
  kind: CategoryKind;
  selected: Item | null;
  onPick: (item: Item) => void;
  onClear: () => void;
}

type Step = 'category' | 'subcategory' | 'item';

const CHIP =
  'inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-4 text-body font-semibold transition-transform active:scale-95 cursor-pointer';

/**
 * One swipeable row of chips: category → group → item.
 * Compact so the whole entry sheet fits one iPhone screen.
 */
export function CategoryRow({ kind, selected, onPick, onClear }: CategoryRowProps) {
  const t = useTranslations('entry');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const repo = useRepository();
  const isRtl = locale === 'ar';
  const rowRef = React.useRef<HTMLDivElement>(null);

  const [step, setStep] = React.useState<Step>('category');
  const [category, setCategory] = React.useState<Category | null>(null);
  const [subcategory, setSubcategory] = React.useState<Subcategory | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');

  // Reset when kind changes (expense <-> income)
  const [prevKind, setPrevKind] = React.useState(kind);
  if (prevKind !== kind) {
    setPrevKind(kind);
    setStep('category');
    setCategory(null);
    setSubcategory(null);
    setIsCreating(false);
  }

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

  const handleCreate = async () => {
    const value = newName.trim();
    if (!value) return;
    const names = { nameAr: value, nameEn: value };

    if (step === 'category') {
      const created = await repo.addCategory({
        kind,
        ...names,
        icon: 'tag',
        color: kind === 'expense' ? '#C2410C' : '#15803D',
      });
      setCategory(created);
      setStep('subcategory');
    } else if (step === 'subcategory' && category) {
      const created = await repo.addSubcategory({ categoryId: category.id, ...names });
      setSubcategory(created);
      setStep('item');
    } else if (step === 'item' && subcategory) {
      const created = await repo.addItem({ subcategoryId: subcategory.id, ...names });
      onPick(created);
    }
    setNewName('');
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

  if (isCreating) {
    const label =
      step === 'category' ? t('newCategory') : step === 'subcategory' ? t('newSubcategory') : t('newItem');
    return (
      <div className="flex h-12 items-center gap-2">
        <Input
          autoFocus
          aria-label={label}
          placeholder={isRtl ? t('nameArLabel') : t('nameEnLabel')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreate();
            }
          }}
          className="h-12 min-w-0 flex-1 rounded-2xl bg-surface-2 text-body"
        />
        <Button
          type="button"
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="h-12 rounded-2xl px-5 text-body font-semibold text-accent-ink cursor-pointer"
        >
          {tCommon('save')}
        </Button>
        <button
          type="button"
          aria-label={tCommon('cancel')}
          onClick={() => {
            setIsCreating(false);
            setNewName('');
          }}
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted cursor-pointer"
        >
          <X className="size-5" />
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

  return (
    <div
      ref={rowRef}
      className="-mx-5 flex gap-2 overflow-x-auto px-5 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {step !== 'category' && (
        <button type="button" onClick={goBack} className={`${CHIP} bg-accent-soft text-accent`}>
          <ChevronLeft className="size-5 rtl:rotate-180" />
          <span>{step === 'subcategory' ? name(category) : name(subcategory)}</span>
        </button>
      )}

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
    </div>
  );
}

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import type {
  Category,
  CategoryKind,
  Item,
  Subcategory,
} from '@/lib/data/types';
import {
  useCategories,
  useSubcategories,
  useItems,
  useRecentItems,
  useRepository,
} from '@/lib/data/provider';
import { CategoryIcon } from '@/components/ui/category-icon';
import { pickName } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface CategoryPickerProps {
  kind: CategoryKind;
  onPick: (item: Item, subcategory: Subcategory, category: Category) => void;
  className?: string;
}

type Step = 'category' | 'subcategory' | 'item';

export function CategoryPicker({ kind, onPick, className = '' }: CategoryPickerProps) {
  const t = useTranslations('entry');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const repo = useRepository();
  const isRtl = locale === 'ar';

  const [step, setStep] = React.useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = React.useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = React.useState<Subcategory | null>(null);

  // Inline "New" state
  const [isCreating, setIsCreating] = React.useState(false);
  const [newNameAr, setNewNameAr] = React.useState('');
  const [newNameEn, setNewNameEn] = React.useState('');

  // Reset when kind changes (expense <-> income)
  const [prevKind, setPrevKind] = React.useState(kind);
  if (prevKind !== kind) {
    setPrevKind(kind);
    setStep('category');
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setIsCreating(false);
  }

  // Queries
  const recentItems = useRecentItems(6);
  const categories = useCategories(kind);
  const subcategories = useSubcategories(selectedCategory?.id);
  const items = useItems(selectedSubcategory?.id);

  // Filter recents by kind (max 2 rows = max 4 chips)
  const filteredRecents = React.useMemo(() => {
    if (!recentItems) return [];
    return recentItems.filter((r) => r.category.kind === kind).slice(0, 4);
  }, [recentItems, kind]);

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat);
    setIsCreating(false);
    setStep('subcategory');
  };

  const handleSelectSubcategory = (sub: Subcategory) => {
    setSelectedSubcategory(sub);
    setIsCreating(false);
    setStep('item');
  };

  const handleSelectItem = (item: Item) => {
    if (selectedCategory && selectedSubcategory) {
      onPick(item, selectedSubcategory, selectedCategory);
    }
  };

  const handleBack = () => {
    if (isCreating) {
      setIsCreating(false);
      return;
    }
    if (step === 'item') {
      setSelectedSubcategory(null);
      setStep('subcategory');
    } else if (step === 'subcategory') {
      setSelectedCategory(null);
      setStep('category');
    }
  };

  const handleCreate = async () => {
    if (!newNameAr.trim() && !newNameEn.trim()) return;

    if (step === 'category') {
      const created = await repo.addCategory({
        kind,
        nameAr: newNameAr.trim() || newNameEn.trim(),
        nameEn: newNameEn.trim() || newNameAr.trim(),
        icon: 'tag',
        color: kind === 'expense' ? '#C2410C' : '#15803D',
      });
      setNewNameAr('');
      setNewNameEn('');
      setIsCreating(false);
      handleSelectCategory(created);
    } else if (step === 'subcategory' && selectedCategory) {
      const created = await repo.addSubcategory({
        categoryId: selectedCategory.id,
        nameAr: newNameAr.trim() || newNameEn.trim(),
        nameEn: newNameEn.trim() || newNameAr.trim(),
      });
      setNewNameAr('');
      setNewNameEn('');
      setIsCreating(false);
      handleSelectSubcategory(created);
    } else if (step === 'item' && selectedSubcategory && selectedCategory) {
      const created = await repo.addItem({
        subcategoryId: selectedSubcategory.id,
        nameAr: newNameAr.trim() || newNameEn.trim(),
        nameEn: newNameEn.trim() || newNameAr.trim(),
      });
      setNewNameAr('');
      setNewNameEn('');
      setIsCreating(false);
      onPick(created, selectedSubcategory, selectedCategory);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Breadcrumb Header if drilled down or creating */}
      {(step !== 'category' || isCreating) && (
        <div className="flex items-center gap-1.5 pb-1 select-none">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 rounded-xl px-2 py-1 text-body font-semibold text-accent hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <ChevronLeft className="size-5 rtl:rotate-180" />
            <span>
              {isCreating
                ? tCommon('back')
                : step === 'subcategory'
                ? pickName(
                    { name_ar: selectedCategory?.nameAr, name_en: selectedCategory?.nameEn },
                    locale
                  )
                : pickName(
                    { name_ar: selectedSubcategory?.nameAr, name_en: selectedSubcategory?.nameEn },
                    locale
                  )}
            </span>
          </button>
        </div>
      )}

      {/* Recents Row (only on root category step when not creating) */}
      {step === 'category' && !isCreating && filteredRecents.length > 0 && (
        <div className="space-y-1.5 select-none">
          <div className="flex items-center gap-1.5 text-caption font-medium text-ink-muted">
            <Sparkles className="size-4 text-accent" />
            <span>{t('recents')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredRecents.map((recent) => {
              const name = pickName(
                { name_ar: recent.item.nameAr, name_en: recent.item.nameEn },
                locale
              );

              return (
                <button
                  key={recent.item.id}
                  type="button"
                  onClick={() => onPick(recent.item, recent.subcategory, recent.category)}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 px-3.5 text-caption font-semibold text-ink shadow-xs transition-all active:scale-95 hover:bg-line/70"
                >
                  <CategoryIcon name={recent.category.icon} className="size-4 text-accent" />
                  <span>{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Animated Step Content */}
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={isCreating ? `creating-${step}` : step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className="w-full"
        >
          {/* Top-aligned "+ New" Form replacing picker */}
          {isCreating ? (
            <div className="space-y-3 rounded-card bg-surface p-4 shadow-card">
              <div className="text-body font-semibold text-ink">
                {step === 'category'
                  ? t('newCategory')
                  : step === 'subcategory'
                  ? t('newSubcategory')
                  : t('newItem')}
              </div>
              <Input
                autoFocus
                placeholder={isRtl ? t('nameArLabel') : t('nameEnLabel')}
                value={isRtl ? newNameAr : newNameEn}
                onChange={(e) =>
                  isRtl ? setNewNameAr(e.target.value) : setNewNameEn(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                className="h-12 rounded-xl text-body bg-surface"
              />
              <div className="flex gap-2.5 pt-1">
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={isRtl ? !newNameAr.trim() : !newNameEn.trim()}
                  className="flex-1 h-12 rounded-xl text-body font-semibold text-accent-ink cursor-pointer"
                >
                  {tCommon('save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewNameAr('');
                    setNewNameEn('');
                  }}
                  className="h-12 rounded-xl text-body font-semibold cursor-pointer"
                >
                  {tCommon('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Category Tiles */}
              {step === 'category' && (
                <div className="grid grid-cols-3 gap-3 select-none">
                  {(categories ?? []).map((cat) => {
                    const name = pickName(
                      { name_ar: cat.nameAr, name_en: cat.nameEn },
                      locale
                    );

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat)}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface p-3 text-center shadow-card transition-transform active:scale-95 hover:shadow-md cursor-pointer"
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
                          className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent"
                        >
                          <CategoryIcon name={cat.icon} className="size-6" />
                        </div>
                        <span className="line-clamp-2 min-h-[2.5rem] flex items-center justify-center text-caption font-semibold text-ink leading-tight text-center px-1">
                          {name}
                        </span>
                      </button>
                    );
                  })}

                  {/* + New Tile */}
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line bg-surface/50 p-3 text-center transition-colors hover:bg-surface-2 cursor-pointer"
                  >
                    <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                      <Plus className="size-6" />
                    </div>
                    <span className="min-h-[2.5rem] flex items-center justify-center text-caption font-semibold text-ink-muted leading-tight text-center px-1">
                      {t('newCategory')}
                    </span>
                  </button>
                </div>
              )}

              {/* Step 2: Subcategory List */}
              {step === 'subcategory' && (
                <div className="divide-y divide-line rounded-card bg-surface shadow-card select-none">
                  {(subcategories ?? []).map((sub) => {
                    const name = pickName(
                      { name_ar: sub.nameAr, name_en: sub.nameEn },
                      locale
                    );

                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSelectSubcategory(sub)}
                        className="flex h-14 w-full items-center justify-between px-4 text-start transition-colors active:bg-surface-2 hover:bg-surface-2/50 cursor-pointer"
                      >
                        <span className="text-body font-medium text-ink">{name}</span>
                        <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
                      </button>
                    );
                  })}

                  {/* + New Subcategory */}
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="flex h-14 w-full items-center gap-2 px-4 text-start font-semibold text-accent transition-colors active:bg-surface-2 cursor-pointer"
                  >
                    <Plus className="size-5" />
                    <span>{t('newSubcategory')}</span>
                  </button>
                </div>
              )}

              {/* Step 3: Items List */}
              {step === 'item' && (
                <div className="divide-y divide-line rounded-card bg-surface shadow-card select-none">
                  {(items ?? []).map((item) => {
                    const name = pickName(
                      { name_ar: item.nameAr, name_en: item.nameEn },
                      locale
                    );

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className="flex h-14 w-full items-center justify-between px-4 text-start transition-colors active:bg-surface-2 hover:bg-surface-2/50 cursor-pointer"
                      >
                        <span className="text-body font-medium text-ink">{name}</span>
                        <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
                      </button>
                    );
                  })}

                  {/* + New Item */}
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="flex h-14 w-full items-center gap-2 px-4 text-start font-semibold text-accent transition-colors active:bg-surface-2 cursor-pointer"
                  >
                    <Plus className="size-5" />
                    <span>{t('newItem')}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

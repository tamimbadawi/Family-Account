'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import {
  useCategories,
  useItems,
  useRepository,
  useSubcategories,
} from '@/lib/data/provider';
import type {
  Category,
  CategoryKind,
  Item,
  Subcategory,
} from '@/lib/data/types';
import { pickName } from '@/lib/format';
import { CategoryIcon } from '@/components/ui/category-icon';
import {
  CategoryFormDrawer,
  type CategoryFormInitial,
  type CategoryFormValues,
} from '@/components/settings/CategoryFormDrawer';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

export default function CategoryManagerPage() {
  const locale = useLocale();
  const t = useTranslations('settings');
  const tEntry = useTranslations('entry');
  const repo = useRepository();

  const [kind, setKind] = React.useState<CategoryKind>('expense');
  const [showArchived, setShowArchived] = React.useState(false);
  const [isReordering, setIsReordering] = React.useState(false);

  // Drill-down states
  const [selectedCategory, setSelectedCategory] = React.useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = React.useState<Subcategory | null>(null);

  // Dialog/Sheet states for Add/Edit
  const [editLevel, setEditLevel] = React.useState<'category' | 'subcategory' | 'item' | null>(null);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = React.useState<Subcategory | null>(null);
  const [editingItem, setEditingItem] = React.useState<Item | null>(null);

  // Starting values for the form
  const [formInitial, setFormInitial] = React.useState<CategoryFormInitial>({});

  // Queries
  const categories = useCategories(kind, showArchived);
  const subcategories = useSubcategories(selectedCategory?.id, showArchived);
  const items = useItems(selectedSubcategory?.id, showArchived);

  // Reset drill-down if category kind changes
  const handleKindChange = (newKind: CategoryKind) => {
    setKind(newKind);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
  };

  // Open Edit Modals
  const openAddCategory = () => {
    setEditingCategory(null);
    setFormInitial({});
    setEditLevel('category');
  };

  const openEditCategory = (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setFormInitial(cat);
    setEditLevel('category');
  };

  const openAddSubcategory = () => {
    setEditingSubcategory(null);
    setFormInitial({});
    setEditLevel('subcategory');
  };

  const openEditSubcategory = (sub: Subcategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSubcategory(sub);
    setFormInitial(sub);
    setEditLevel('subcategory');
  };

  const openAddItem = () => {
    setEditingItem(null);
    setFormInitial({});
    setEditLevel('item');
  };

  const openEditItem = (item: Item, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setFormInitial(item);
    setEditLevel('item');
  };

  // Save Handlers
  const handleSave = async ({ nameAr, nameEn, color, icon }: CategoryFormValues) => {
    try {
      if (editLevel === 'category') {
        if (editingCategory) {
          await repo.updateCategory(editingCategory.id, {
            nameAr,
            nameEn,
            color,
            icon,
          });
        } else {
          await repo.addCategory({
            kind,
            nameAr,
            nameEn,
            color,
            icon,
          });
        }
      } else if (editLevel === 'subcategory') {
        if (!selectedCategory) return;
        if (editingSubcategory) {
          await repo.updateSubcategory(editingSubcategory.id, {
            nameAr,
            nameEn,
          });
        } else {
          await repo.addSubcategory({
            categoryId: selectedCategory.id,
            nameAr,
            nameEn,
          });
        }
      } else if (editLevel === 'item') {
        if (!selectedSubcategory) return;
        if (editingItem) {
          await repo.updateItem(editingItem.id, {
            nameAr,
            nameEn,
          });
        } else {
          await repo.addItem({
            subcategoryId: selectedSubcategory.id,
            nameAr,
            nameEn,
          });
        }
      }

      toast.success(t('saved'));
      setEditLevel(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save');
    }
  };

  const handleArchiveToggle = async (
    target: Category | Subcategory | Item,
    level: 'category' | 'subcategory' | 'item'
  ) => {
    try {
      const willArchive = !target.isArchived;
      if (level === 'category') {
        await repo.archiveCategory(target.id, willArchive);
      } else if (level === 'subcategory') {
        await repo.archiveSubcategory(target.id, willArchive);
      } else if (level === 'item') {
        await repo.archiveItem(target.id, willArchive);
      }
      toast.success(willArchive ? t('archive') : t('unarchive'));
      setEditLevel(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to change archive state');
    }
  };

  // Reordering helpers
  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    if (!categories) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const current = categories[index];
    const target = categories[targetIndex];

    await repo.updateCategory(current.id, { sortOrder: target.sortOrder });
    await repo.updateCategory(target.id, { sortOrder: current.sortOrder });
  };

  const handleMoveSubcategory = async (index: number, direction: 'up' | 'down') => {
    if (!subcategories) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subcategories.length) return;

    const current = subcategories[index];
    const target = subcategories[targetIndex];

    await repo.updateSubcategory(current.id, { sortOrder: target.sortOrder });
    await repo.updateSubcategory(target.id, { sortOrder: current.sortOrder });
  };

  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    if (!items) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const current = items[index];
    const target = items[targetIndex];

    await repo.updateItem(current.id, { sortOrder: target.sortOrder });
    await repo.updateItem(target.id, { sortOrder: current.sortOrder });
  };

  // Breadcrumbs text
  const currentCategoryName = pickName(
    selectedCategory ? { name_ar: selectedCategory.nameAr, name_en: selectedCategory.nameEn } : null,
    locale
  );
  const currentSubcategoryName = pickName(
    selectedSubcategory ? { name_ar: selectedSubcategory.nameAr, name_en: selectedSubcategory.nameEn } : null,
    locale
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
      {/* ONE Top Header: back chevron + large title */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 shrink-0 flex items-center justify-between border-b border-line/30 select-none">
        <div className="flex items-center gap-2 min-w-0">
          {selectedSubcategory ? (
            <button
              type="button"
              onClick={() => setSelectedSubcategory(null)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors cursor-pointer -ms-2"
              aria-label={t('back')}
            >
              <ChevronLeft className="size-6 rtl:rotate-180" />
            </button>
          ) : selectedCategory ? (
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors cursor-pointer -ms-2"
              aria-label={t('back')}
            >
              <ChevronLeft className="size-6 rtl:rotate-180" />
            </button>
          ) : (
            <Link
              href="/settings"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2"
              aria-label={t('back')}
            >
              <ChevronLeft className="size-6 rtl:rotate-180" />
            </Link>
          )}

          <h1 className="text-title font-bold text-ink truncate">
            {selectedSubcategory
              ? currentSubcategoryName
              : selectedCategory
              ? currentCategoryName
              : t('categories')}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setIsReordering(!isReordering)}
          className="text-body font-semibold text-accent hover:opacity-80 transition-opacity cursor-pointer shrink-0 ps-3"
        >
          {isReordering ? t('done') : t('reorder')}
        </button>
      </div>

      {/* Tabs & Controls (only visible at top category level) */}
      {!selectedCategory && (
        <div className="px-5 pt-3 pb-2 space-y-3 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-2 rounded-2xl select-none">
            <button
              type="button"
              onClick={() => handleKindChange('expense')}
              className={`h-11 rounded-xl text-body font-medium transition-all cursor-pointer ${
                kind === 'expense'
                  ? 'bg-surface text-expense font-semibold shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tEntry('expense')}
            </button>
            <button
              type="button"
              onClick={() => handleKindChange('income')}
              className={`h-11 rounded-xl text-body font-medium transition-all cursor-pointer ${
                kind === 'income'
                  ? 'bg-surface text-income font-semibold shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tEntry('income')}
            </button>
          </div>

          <div className="flex h-12 items-center justify-between px-4 bg-surface rounded-2xl border border-line/40 select-none">
            <span className="text-body font-medium text-ink">{t('showArchived')}</span>
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          </div>
        </div>
      )}

      {/* Main List Area */}
      <div className="flex-1 px-5 py-2 pb-24 space-y-2">
        {/* Level 1: Categories */}
        {!selectedCategory && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={openAddCategory}
              className="w-full flex items-center gap-3 p-3.5 bg-surface rounded-card border-2 border-dashed border-line/60 hover:border-accent text-accent font-semibold transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <Plus className="size-5" />
              </div>
              <span className="text-body">{t('addCategory')}</span>
            </button>

            {!categories && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-card" />
                ))}
              </div>
            )}

            {categories && (
              <div className="bg-surface rounded-card border border-line/40 shadow-sm divide-y divide-line/30 overflow-hidden">
                {categories.map((cat, idx) => {
                  const name = pickName(
                    { name_ar: cat.nameAr, name_en: cat.nameEn },
                    locale
                  );
                  return (
                    <div
                      key={cat.id}
                      onClick={() => !isReordering && setSelectedCategory(cat)}
                      className={`flex items-center justify-between p-3.5 transition-colors select-none ${
                        isReordering
                          ? 'bg-surface'
                          : 'hover:bg-surface-2/40 active:bg-surface-2 cursor-pointer'
                      } ${cat.isArchived ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          style={{
                            backgroundColor: `${cat.color || '#0F766E'}18`,
                            color: cat.color || '#0F766E',
                          }}
                          className="flex size-11 shrink-0 items-center justify-center rounded-full"
                        >
                          <CategoryIcon name={cat.icon} className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-body font-semibold text-ink">
                            {name}
                          </div>
                          {cat.isArchived && (
                            <span className="text-caption text-ink-muted">
                              ({t('archive')})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isReordering ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveCategory(idx, 'up');
                              }}
                              className="p-2 rounded-lg bg-surface-2 text-ink-muted disabled:opacity-30"
                            >
                              <ArrowUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === categories.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveCategory(idx, 'down');
                              }}
                              className="p-2 rounded-lg bg-surface-2 text-ink-muted disabled:opacity-30"
                            >
                              <ArrowDown className="size-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-label={t('editCategory')}
                              onClick={(e) => openEditCategory(cat, e)}
                              className="p-2 rounded-full hover:bg-surface-2 text-ink-muted transition-colors cursor-pointer"
                            >
                              <Edit2 className="size-4" />
                            </button>
                            <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Level 2: Subcategories */}
        {selectedCategory && !selectedSubcategory && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={openAddSubcategory}
              className="w-full flex items-center gap-3 p-3.5 bg-surface rounded-card border-2 border-dashed border-line/60 hover:border-accent text-accent font-semibold transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <Plus className="size-5" />
              </div>
              <span className="text-body">{t('addSubcategory')}</span>
            </button>

            {!subcategories && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-card" />
                ))}
              </div>
            )}

            {subcategories && (
              <div className="bg-surface rounded-card border border-line/40 shadow-sm divide-y divide-line/30 overflow-hidden">
                {subcategories.map((sub, idx) => {
                  const name = pickName(
                    { name_ar: sub.nameAr, name_en: sub.nameEn },
                    locale
                  );
                  return (
                    <div
                      key={sub.id}
                      onClick={() => !isReordering && setSelectedSubcategory(sub)}
                      className={`flex items-center justify-between p-3.5 transition-colors select-none ${
                        isReordering
                          ? 'bg-surface'
                          : 'hover:bg-surface-2/40 active:bg-surface-2 cursor-pointer'
                      } ${sub.isArchived ? 'opacity-50' : ''}`}
                    >
                      <div className="min-w-0">
                        <span className="text-body font-semibold text-ink">
                          {name}
                        </span>
                        {sub.isArchived && (
                          <span className="ms-2 text-caption text-ink-muted">
                            ({t('archive')})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isReordering ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSubcategory(idx, 'up');
                              }}
                              className="p-2 rounded-lg bg-surface-2 text-ink-muted disabled:opacity-30"
                            >
                              <ArrowUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === subcategories.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveSubcategory(idx, 'down');
                              }}
                              className="p-2 rounded-lg bg-surface-2 text-ink-muted disabled:opacity-30"
                            >
                              <ArrowDown className="size-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => openEditSubcategory(sub, e)}
                              className="p-2 rounded-full hover:bg-surface-2 text-ink-muted transition-colors"
                            >
                              <Edit2 className="size-4" />
                            </button>
                            <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Level 3: Items */}
        {selectedSubcategory && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={openAddItem}
              className="w-full flex items-center gap-3 p-3.5 bg-surface rounded-card border-2 border-dashed border-line/60 hover:border-accent text-accent font-semibold transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <Plus className="size-5" />
              </div>
              <span className="text-body">{t('addItem')}</span>
            </button>

            {!items && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-card" />
                ))}
              </div>
            )}

            {items && (
              <div className="bg-surface rounded-card border border-line/40 shadow-sm divide-y divide-line/30 overflow-hidden">
                {items.map((item, idx) => {
                  const name = pickName(
                    { name_ar: item.nameAr, name_en: item.nameEn },
                    locale
                  );
                  return (
                    <div
                      key={item.id}
                      onClick={(e) => !isReordering && openEditItem(item, e)}
                      className={`flex items-center justify-between p-3.5 transition-colors select-none ${
                        isReordering
                          ? 'bg-surface'
                          : 'hover:bg-surface-2/40 active:bg-surface-2 cursor-pointer'
                      } ${item.isArchived ? 'opacity-50' : ''}`}
                    >
                      <div className="min-w-0">
                        <span className="text-body font-semibold text-ink">
                          {name}
                        </span>
                        {item.isArchived && (
                          <span className="ms-2 text-caption text-ink-muted">
                            ({t('archive')})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isReordering ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveItem(idx, 'up');
                              }}
                              className="p-2 rounded-lg bg-surface-2 text-ink-muted disabled:opacity-30"
                            >
                              <ArrowUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === items.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveItem(idx, 'down');
                              }}
                              className="p-2 rounded-lg bg-surface-2 text-ink-muted disabled:opacity-30"
                            >
                              <ArrowDown className="size-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => openEditItem(item, e)}
                            className="p-2 rounded-full hover:bg-surface-2 text-ink-muted transition-colors"
                          >
                            <Edit2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer for Add/Edit */}
      <CategoryFormDrawer
        open={editLevel !== null}
        onOpenChange={(open) => !open && setEditLevel(null)}
        level={editLevel ?? 'category'}
        title={
          editLevel === 'category'
            ? editingCategory
              ? t('editCategory')
              : t('addCategory')
            : editLevel === 'subcategory'
            ? editingSubcategory
              ? t('editSubcategory')
              : t('addSubcategory')
            : editingItem
            ? t('editItem')
            : t('addItem')
        }
        initial={formInitial}
        onSave={handleSave}
      >
        {/* Archive section for existing entries */}
        {((editLevel === 'category' && editingCategory) ||
          (editLevel === 'subcategory' && editingSubcategory) ||
          (editLevel === 'item' && editingItem)) && (
          <div className="pt-2 border-t border-line/40 space-y-2">
            <button
              type="button"
              onClick={() => {
                const target =
                  editLevel === 'category'
                    ? editingCategory!
                    : editLevel === 'subcategory'
                    ? editingSubcategory!
                    : editingItem!;
                handleArchiveToggle(target, editLevel!);
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-surface-2 text-ink hover:bg-surface-2/80 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Archive className="size-5 text-ink-muted" />
                <span className="text-body font-semibold">
                  {(editLevel === 'category'
                    ? editingCategory
                    : editLevel === 'subcategory'
                    ? editingSubcategory
                    : editingItem
                  )?.isArchived
                    ? t('unarchive')
                    : t('archive')}
                </span>
              </div>
            </button>
            <p className="text-caption text-ink-muted leading-tight px-1">
              {t('archiveHint')}
            </p>
          </div>
        )}
      </CategoryFormDrawer>
    </div>
  );
}

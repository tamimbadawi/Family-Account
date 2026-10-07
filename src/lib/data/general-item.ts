import type { Repository } from './repository';
import type { Category, Item, Subcategory } from './types';

const sameName = (a: { nameAr: string | null; nameEn: string | null }, b: { nameAr: string | null; nameEn: string | null }) =>
  (a.nameAr ?? '').trim() === (b.nameAr ?? '').trim() && (a.nameEn ?? '').trim() === (b.nameEn ?? '').trim();

/**
 * Entries always belong to an item. When someone saves at a category or group (no specific item),
 * the entry goes under a "general" item with the same name: the category's own group/item, or the
 * group's own item. Found by name and created only the first time, so it never duplicates.
 */
export async function generalItemFor(repo: Repository, category: Category, subcategory: Subcategory | null): Promise<Item> {
  let group = subcategory;
  if (!group) {
    const groups = await repo.getSubcategories(category.id);
    group =
      groups.find((g) => sameName(g, category)) ??
      (await repo.addSubcategory({ categoryId: category.id, nameAr: category.nameAr, nameEn: category.nameEn }));
  }
  const items = await repo.getItems(group.id);
  return (
    items.find((i) => sameName(i, group)) ??
    (await repo.addItem({ subcategoryId: group.id, nameAr: group.nameAr, nameEn: group.nameEn }))
  );
}

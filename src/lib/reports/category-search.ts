import type { CategoryKind, EnrichedEntry } from '@/lib/data/types';
import { normalizeSearchTerm } from '@/lib/history/search';

export interface CategorySearchHit {
  level: 'category' | 'subcategory' | 'item';
  id: string;
  categoryId: string;
  nameAr: string | null;
  nameEn: string | null;
  /** The levels above it ("Food › Groceries"), in each language; empty for a category. */
  pathAr: string[];
  pathEn: string[];
  icon: string | null;
  color: string | null;
  total: number;
  count: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const matches = (q: string, ...names: (string | null | undefined)[]) =>
  names.some((n) => n && normalizeSearchTerm(n).includes(q));

/**
 * Finds the categories, groups and items whose name matches the query, with what was spent
 * (or received) on each in the entries given: "bread" → Bread, 95 EGP, 2 times. Largest first.
 */
export function searchCategoryTotals(
  entries: EnrichedEntry[] | undefined,
  query: string,
  kind: CategoryKind
): CategorySearchHit[] {
  const q = normalizeSearchTerm(query);
  if (!q || !entries) return [];
  const hits = new Map<string, CategorySearchHit>();
  const add = (key: string, make: () => Omit<CategorySearchHit, 'total' | 'count'>, amount: number) => {
    let hit = hits.get(key);
    if (!hit) {
      hit = { ...make(), total: 0, count: 0 };
      hits.set(key, hit);
    }
    hit.total += amount;
    hit.count += 1;
  };

  for (const e of entries) {
    if (e.type !== kind || !e.itemId || !e.categoryId || !e.subcategoryId) continue;
    const base = { categoryId: e.categoryId, icon: e.categoryIcon ?? null, color: e.categoryColor ?? null };
    const catAr = e.categoryNameAr ?? null;
    const catEn = e.categoryNameEn ?? null;
    const subAr = e.subcategoryNameAr ?? null;
    const subEn = e.subcategoryNameEn ?? null;
    if (matches(q, catAr, catEn)) {
      add(`c:${e.categoryId}`, () => ({ ...base, level: 'category', id: e.categoryId!, nameAr: catAr, nameEn: catEn, pathAr: [], pathEn: [] }), e.amount);
    }
    if (matches(q, subAr, subEn)) {
      add(
        `s:${e.subcategoryId}`,
        () => ({ ...base, level: 'subcategory', id: e.subcategoryId!, nameAr: subAr, nameEn: subEn, pathAr: [catAr ?? ''], pathEn: [catEn ?? ''] }),
        e.amount
      );
    }
    if (matches(q, e.itemNameAr, e.itemNameEn)) {
      add(
        `i:${e.itemId}`,
        () => ({
          ...base,
          level: 'item',
          id: e.itemId!,
          nameAr: e.itemNameAr ?? null,
          nameEn: e.itemNameEn ?? null,
          pathAr: [catAr ?? '', subAr ?? ''],
          pathEn: [catEn ?? '', subEn ?? ''],
        }),
        e.amount
      );
    }
  }

  return Array.from(hits.values())
    .map((h) => ({ ...h, total: round2(h.total) }))
    .sort((a, b) => b.total - a.total);
}

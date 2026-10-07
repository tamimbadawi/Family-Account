import type { ListEntriesParams } from '@/lib/data/repository';
import type { EnrichedEntry } from '@/lib/data/types';

export type HistoryType = 'all' | 'expense' | 'income' | 'transfer';

/** One chosen category, group or item, kept as its path: the deepest id set is what it means. */
export interface CategoryPick {
  categoryId: string;
  subcategoryId?: string;
  itemId?: string;
}

/** What the History list is narrowed to. Every list may hold several choices; an empty list means "any". */
export interface HistoryFilters {
  type: HistoryType;
  picks: CategoryPick[];
  walletIds: string[];
  memberIds: string[];
}

export const EMPTY_FILTERS: HistoryFilters = { type: 'all', picks: [], walletIds: [], memberIds: [] };

export function pickLevel(p: CategoryPick): 'item' | 'subcategory' | 'category' {
  return p.itemId ? 'item' : p.subcategoryId ? 'subcategory' : 'category';
}

/** The id that identifies a pick (its deepest level). */
export function pickKey(p: CategoryPick): string {
  return p.itemId ?? p.subcategoryId ?? p.categoryId;
}

export function hasPick(picks: CategoryPick[], p: CategoryPick): boolean {
  return picks.some((x) => pickKey(x) === pickKey(p));
}

/**
 * Turns one category / group / item on or off. A choice and the choices above or below it on the
 * same path can't both be on ("All of Food" and "Bread" at once), so turning one on drops the others.
 */
export function togglePick(picks: CategoryPick[], p: CategoryPick): CategoryPick[] {
  if (hasPick(picks, p)) return picks.filter((x) => pickKey(x) !== pickKey(p));
  const level = pickLevel(p);
  const kept = picks.filter((x) => {
    if (x.categoryId !== p.categoryId) return true;
    if (level === 'category') return false; // the whole category covers everything in it
    if (pickLevel(x) === 'category') return false;
    if (x.subcategoryId !== p.subcategoryId) return true;
    if (level === 'subcategory') return false; // the whole group covers its items
    return pickLevel(x) === 'item'; // other items in the group stay; the whole group goes
  });
  return [...kept, p];
}

export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/**
 * Repository query for a period with these filters. A single wallet or category choice is passed
 * to the repository; several are matched in memory by `applyFilters`.
 */
export function toListParams(f: HistoryFilters, range: { month?: string; startDate?: string; endDate?: string }): ListEntriesParams {
  const one = f.picks.length === 1 ? f.picks[0] : undefined;
  return {
    ...range,
    type: f.type === 'all' ? undefined : f.type,
    accountId: f.walletIds.length === 1 ? f.walletIds[0] : undefined,
    itemId: one?.itemId,
    subcategoryId: one && !one.itemId ? one.subcategoryId : undefined,
    categoryId: one && !one.itemId && !one.subcategoryId ? one.categoryId : undefined,
  };
}

/** Keeps the entries that match any chosen category, any chosen wallet and any chosen person. */
export function applyFilters(
  entries: EnrichedEntry[] | undefined,
  f: HistoryFilters,
  authorOf: (createdBy: string | null | undefined) => { userId: string } | null = (id) => (id ? { userId: id } : null)
): EnrichedEntry[] | undefined {
  if (!entries) return entries;
  const { picks, walletIds, memberIds } = f;
  if (!picks.length && !walletIds.length && !memberIds.length) return entries;
  return entries.filter((e) => {
    if (
      picks.length &&
      !picks.some((p) =>
        p.itemId ? e.itemId === p.itemId : p.subcategoryId ? e.subcategoryId === p.subcategoryId : e.categoryId === p.categoryId
      )
    ) {
      return false;
    }
    if (walletIds.length && !walletIds.includes(e.accountId) && !(e.toAccountId && walletIds.includes(e.toAccountId))) {
      return false;
    }
    if (memberIds.length) {
      const author = authorOf(e.createdBy)?.userId;
      if (!author || !memberIds.includes(author)) return false;
    }
    return true;
  });
}

/** How many choices (besides the type dropdown) are on, for the Filter button's badge. */
export function activeFilterCount(f: HistoryFilters): number {
  return f.picks.length + f.walletIds.length + f.memberIds.length;
}

/** The one category, group or item the list is narrowed to, if exactly one is chosen (drives the history card). */
export function singlePick(f: HistoryFilters): CategoryPick | null {
  return f.picks.length === 1 ? f.picks[0] : null;
}

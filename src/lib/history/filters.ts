import type { ListEntriesParams } from '@/lib/data/repository';
import type { EnrichedEntry } from '@/lib/data/types';

export type HistoryType = 'all' | 'expense' | 'income' | 'transfer';

/** What the History list is narrowed to. Category, group and item are one path: the deepest one wins. */
export interface HistoryFilters {
  type: HistoryType;
  categoryId?: string;
  subcategoryId?: string;
  itemId?: string;
  walletId?: string;
  memberId?: string;
}

export const EMPTY_FILTERS: HistoryFilters = { type: 'all' };

/** Repository query for one month (or a date range) with these filters; "who" is applied in memory. */
export function toListParams(f: HistoryFilters, range: { month?: string; startDate?: string; endDate?: string }): ListEntriesParams {
  return {
    ...range,
    type: f.type === 'all' ? undefined : f.type,
    accountId: f.walletId,
    itemId: f.itemId,
    subcategoryId: f.itemId ? undefined : f.subcategoryId,
    categoryId: f.itemId || f.subcategoryId ? undefined : f.categoryId,
  };
}

export function byMember(
  entries: EnrichedEntry[] | undefined,
  memberId?: string,
  authorOf: (createdBy: string | null | undefined) => { userId: string } | null = (id) => (id ? { userId: id } : null)
): EnrichedEntry[] | undefined {
  if (!entries || !memberId) return entries;
  return entries.filter((e) => authorOf(e.createdBy)?.userId === memberId);
}

/** How many filters (besides the type dropdown) are on, for the Filter button's badge. */
export function activeFilterCount(f: HistoryFilters): number {
  return (f.categoryId ? 1 : 0) + (f.walletId ? 1 : 0) + (f.memberId ? 1 : 0);
}

/** The item / group / category the list is narrowed to, if any (drives the history card). */
export function focusLevel(f: HistoryFilters): 'item' | 'subcategory' | 'category' | null {
  if (f.itemId) return 'item';
  if (f.subcategoryId) return 'subcategory';
  if (f.categoryId) return 'category';
  return null;
}

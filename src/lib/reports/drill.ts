import type { EnrichedEntry, EntryType } from '@/lib/data/types';

/** Which entries a tapped total stands for. Every field narrows; leave one out for "any". */
export interface DrillQuery {
  type?: EntryType;
  categoryId?: string | null;
  subcategoryId?: string | null;
  itemId?: string | null;
  /** Wallet on either side (a move counts for both wallets). */
  walletId?: string | null;
  /** Who entered it ('unknown' = nobody recorded). */
  createdBy?: string | null;
  /** Months 'YYYY-MM' to include. */
  months?: string[];
  /** Inclusive date range 'YYYY-MM-DD'. */
  from?: string;
  to?: string;
}

/** The entries behind a report total, newest first. */
export function entriesFor(entries: EnrichedEntry[] | undefined, q: DrillQuery): EnrichedEntry[] {
  const months = q.months ? new Set(q.months) : null;
  return (entries ?? [])
    .filter((e) => {
      if (e.deletedAt) return false;
      if (q.type && e.type !== q.type) return false;
      if (q.categoryId && e.categoryId !== q.categoryId) return false;
      if (q.subcategoryId && e.subcategoryId !== q.subcategoryId) return false;
      if (q.itemId && e.itemId !== q.itemId) return false;
      if (q.walletId && e.accountId !== q.walletId && e.toAccountId !== q.walletId) return false;
      if (q.createdBy !== undefined && q.createdBy !== null && (e.createdBy ?? 'unknown') !== q.createdBy) return false;
      if (months && !months.has(e.occurredOn.slice(0, 7))) return false;
      if (q.from && e.occurredOn < q.from) return false;
      if (q.to && e.occurredOn > q.to) return false;
      return true;
    })
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

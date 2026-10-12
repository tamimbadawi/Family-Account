import type { EnrichedEntry } from '@/lib/data/types';
import type { CategoryPick } from './filters';

export interface HistorySummary {
  /** Money out, rounded to 2 dp. */
  spent: number;
  /** Money in, rounded to 2 dp. */
  received: number;
  /** Expense and income entries counted in the totals (moves between wallets are left out). */
  count: number;
  /** The one item every counted entry belongs to, so the list can jump to its history card. */
  item: CategoryPick | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Adds up the entries on screen (after search and filters): "how much did we spend on bread?". */
export function summarize(entries: EnrichedEntry[] | undefined): HistorySummary {
  let spent = 0;
  let received = 0;
  let count = 0;
  let item: CategoryPick | null = null;
  let mixed = false;
  for (const e of entries ?? []) {
    if (e.type === 'transfer') continue;
    if (e.type === 'expense') spent += e.amount;
    else received += e.amount;
    count += 1;
    if (mixed) continue;
    if (!e.itemId || !e.categoryId || !e.subcategoryId) mixed = true;
    else if (!item) item = { categoryId: e.categoryId, subcategoryId: e.subcategoryId, itemId: e.itemId };
    else if (item.itemId !== e.itemId) mixed = true;
  }
  return { spent: round2(spent), received: round2(received), count, item: mixed ? null : item };
}

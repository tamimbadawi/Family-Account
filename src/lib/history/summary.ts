import type { EnrichedEntry } from '../data/types';
import { totalsByCurrency } from '../money/groups';
import type { CategoryPick } from './filters';

export interface HistorySummary {
  /** Money out, rounded to 2 dp. */
  spent: number;
  /** Money in, rounded to 2 dp. */
  received: number;
  /** Money out grouped by currency without algebraic addition across currencies. */
  spentTotals: { currency: string; amount: number }[];
  /** Money in grouped by currency without algebraic addition across currencies. */
  receivedTotals: { currency: string; amount: number }[];
  /** Expense and income entries counted in the totals (moves between wallets are left out). */
  count: number;
  /** The one item every counted entry belongs to, so the list can jump to its history card. */
  item: CategoryPick | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Adds up the entries on screen (after search and filters): "how much did we spend on bread?". */
export function summarize(entries: EnrichedEntry[] | undefined): HistorySummary {
  const spentItems: { currency: string; amount: number }[] = [];
  const receivedItems: { currency: string; amount: number }[] = [];
  let count = 0;
  let item: CategoryPick | null = null;
  let mixed = false;

  for (const e of entries ?? []) {
    if (e.type === 'transfer') continue;
    const cur = e.accountCurrency || 'EGP';
    if (e.type === 'expense') {
      spentItems.push({ currency: cur, amount: e.amount });
    } else {
      receivedItems.push({ currency: cur, amount: e.amount });
    }
    count += 1;
    if (mixed) continue;
    if (!e.itemId || !e.categoryId || !e.subcategoryId) mixed = true;
    else if (!item) item = { categoryId: e.categoryId, subcategoryId: e.subcategoryId, itemId: e.itemId };
    else if (item.itemId !== e.itemId) mixed = true;
  }

  const spentTotals = totalsByCurrency(spentItems);
  const receivedTotals = totalsByCurrency(receivedItems);
  const totalSpent = spentTotals.reduce((sum, t) => sum + t.amount, 0);
  const totalReceived = receivedTotals.reduce((sum, t) => sum + t.amount, 0);

  return {
    spent: round2(totalSpent),
    received: round2(totalReceived),
    spentTotals,
    receivedTotals,
    count,
    item: mixed ? null : item,
  };
}
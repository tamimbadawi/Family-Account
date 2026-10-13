import { roundMoney } from '../data/mappers';
import type { WalletPurpose } from '../data/types';

export interface PurposeWalletLike {
  purpose?: WalletPurpose;
  isArchived?: boolean;
}

export function splitByPurpose<W extends PurposeWalletLike>(
  wallets: W[]
): { spending: W[]; goal: W[]; investment: W[] } {
  const spending: W[] = [];
  const goal: W[] = [];
  const investment: W[] = [];

  for (const w of wallets) {
    if (w.isArchived) continue;
    if (w.purpose === 'goal') {
      goal.push(w);
    } else if (w.purpose === 'investment') {
      investment.push(w);
    } else {
      spending.push(w);
    }
  }

  return { spending, goal, investment };
}

export interface CurrencyAmountItem {
  currency: string;
  amount: number;
}

/**
 * Groups items by currency without ever summing across currencies.
 * Preserves the order in which currencies first appear.
 */
export function totalsByCurrency(
  items: CurrencyAmountItem[]
): { currency: string; amount: number }[] {
  const map = new Map<string, number>();

  for (const item of items) {
    const cur = item.currency || 'EGP';
    const current = map.get(cur) ?? 0;
    map.set(cur, current + item.amount);
  }

  const result: { currency: string; amount: number }[] = [];
  for (const [currency, amount] of map.entries()) {
    result.push({
      currency,
      amount: roundMoney(amount),
    });
  }

  return result;
}

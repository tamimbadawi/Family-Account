// =========================================================
// Banks & Cash Reports (A5d) · Pure functions, no React/Dexie
// 5 Reports:
//   1. netWorthReport
//   2. balanceOverTimeReport
//   3. inOutPerWalletReport
//   4. cashWithdrawalsReport
//   5. transfersLogReport
//
// Rules:
// - Balance correction entries (Adjustments category) must NOT
//   count as spending or income in any report total.
// - Amounts are rounded to 2 decimal places.
// =========================================================

import type { EnrichedEntry, Wallet, WalletBalance } from '../data/types';
import { totalsByCurrency } from '../money/groups';
import {
  ITEM_EXPENSE_BALANCE_CORRECTION_ID,
  ITEM_INCOME_BALANCE_CORRECTION_ID,
} from '../data/mock-seed';

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Checks whether an entry is a balance correction (Adjustments category).
 * Balance corrections adjust wallet balances directly but must NEVER
 * count as regular spending or income in report totals.
 */
export function isBalanceCorrection(entry: {
  itemId?: string | null;
  categoryNameEn?: string | null;
  categoryNameAr?: string | null;
  subcategoryNameEn?: string | null;
  subcategoryNameAr?: string | null;
  itemNameEn?: string | null;
  itemNameAr?: string | null;
}): boolean {
  if (
    entry.itemId === ITEM_EXPENSE_BALANCE_CORRECTION_ID ||
    entry.itemId === ITEM_INCOME_BALANCE_CORRECTION_ID
  ) {
    return true;
  }
  const cat = (entry.categoryNameEn ?? '').toLowerCase();
  const sub = (entry.subcategoryNameEn ?? '').toLowerCase();
  const item = (entry.itemNameEn ?? '').toLowerCase();
  return (
    cat === 'adjustments' ||
    sub === 'balance correction' ||
    item === 'balance correction' ||
    entry.categoryNameAr === 'تسويات' ||
    entry.subcategoryNameAr === 'تصحيح الرصيد' ||
    entry.itemNameAr === 'تصحيح الرصيد'
  );
}

// -------------------------------------------------------------
// 1. Net worth (What we have)
// -------------------------------------------------------------

export interface WalletNetWorthItem {
  id: string;
  nameAr: string | null;
  nameEn: string | null;
  type: string;
  currency: string;
  icon: string | null;
  color: string | null;
  currentBalance: number;
  prevMonthBalance: number;
  changeVsLastMonth: number;
  sharePercentage: number;
  purpose: 'spending' | 'goal' | 'investment';
}

export interface NetWorthGroup {
  purpose: 'spending' | 'goal' | 'investment';
  wallets: WalletNetWorthItem[];
  totals: { currency: string; amount: number }[];
}

export interface NetWorthReportResult {
  spendingTotals: { currency: string; amount: number }[];
  savedTotals: { currency: string; amount: number }[];
  spendingChangeVsLastMonth: number;
  spendingPrevMonthTotal: number;
  spendingChangePercentage: number;
  spendingChanges: {
    currency: string;
    changeVsLastMonth: number;
    changePercentage: number;
  }[];
  groups: NetWorthGroup[];
}

export function netWorthReport(
  wallets: Wallet[],
  balances: WalletBalance[],
  entries: EnrichedEntry[],
  currentMonth: string,
  investments?: { id: string; worth: number }[]
): NetWorthReportResult {
  const activeWallets = wallets.filter((w) => !w.isArchived);
  const balanceMap = new Map<string, number>();
  for (const b of balances) {
    balanceMap.set(b.id, b.balance);
  }

  // Calculate delta during the current month per wallet
  const deltaMap = new Map<string, number>();
  for (const w of activeWallets) {
    deltaMap.set(w.id, 0);
  }

  for (const e of entries) {
    if (e.deletedAt) continue;
    if (!e.occurredOn.startsWith(currentMonth)) continue;

    const amt = e.amount;
    if (deltaMap.has(e.accountId)) {
      if (e.type === 'income') {
        deltaMap.set(e.accountId, (deltaMap.get(e.accountId) ?? 0) + amt);
      } else if (e.type === 'expense' || e.type === 'transfer') {
        deltaMap.set(e.accountId, (deltaMap.get(e.accountId) ?? 0) - amt);
      }
    }

    if (e.type === 'transfer' && e.toAccountId && deltaMap.has(e.toAccountId)) {
      deltaMap.set(e.toAccountId, (deltaMap.get(e.toAccountId) ?? 0) + amt);
    }
  }

  // Create WalletNetWorthItems
  const allWalletItems: WalletNetWorthItem[] = activeWallets.map((w) => {
    const rawPurpose = w.purpose ?? 'spending';
    const purpose: 'spending' | 'goal' | 'investment' =
      rawPurpose === 'goal' ? 'goal' : rawPurpose === 'investment' ? 'investment' : 'spending';

    let currentBalance: number;
    if (purpose === 'investment') {
      const inv = investments?.find((i) => i.id === w.id);
      currentBalance = round2(inv ? inv.worth : (balanceMap.get(w.id) ?? w.openingBalance));
    } else {
      currentBalance = round2(balanceMap.get(w.id) ?? w.openingBalance);
    }

    const delta = deltaMap.get(w.id) ?? 0;
    const prevMonthBalance = round2(currentBalance - delta);
    const changeVsLastMonth = round2(currentBalance - prevMonthBalance);

    return {
      id: w.id,
      nameAr: w.nameAr,
      nameEn: w.nameEn,
      type: w.type,
      currency: w.currency || 'EGP',
      icon: w.icon,
      color: w.color,
      currentBalance,
      prevMonthBalance,
      changeVsLastMonth,
      sharePercentage: 0,
      purpose,
    };
  });

  // Partition into three groups in order: spending, goal, investment
  const groupPurposes: ('spending' | 'goal' | 'investment')[] = ['spending', 'goal', 'investment'];
  const groups: NetWorthGroup[] = groupPurposes.map((p) => {
    const groupWallets = allWalletItems.filter((item) => item.purpose === p);

    // Group totals by currency
    const totals = totalsByCurrency(
      groupWallets.map((w) => ({ currency: w.currency, amount: w.currentBalance }))
    );

    // Calculate sharePercentage within its own group and currency
    const totalByCurrencyMap = new Map<string, number>();
    for (const t of totals) {
      totalByCurrencyMap.set(t.currency, t.amount);
    }

    for (const item of groupWallets) {
      const groupCurTotal = totalByCurrencyMap.get(item.currency) ?? 0;
      item.sharePercentage =
        groupCurTotal > 0 ? round2((item.currentBalance / groupCurTotal) * 100) : 0;
    }

    // Sort largest balance first within each group
    groupWallets.sort((a, b) => b.currentBalance - a.currentBalance);

    return {
      purpose: p,
      wallets: groupWallets,
      totals,
    };
  });

  const spendingGroup = groups.find((g) => g.purpose === 'spending')!;
  const goalGroup = groups.find((g) => g.purpose === 'goal')!;
  const investmentGroup = groups.find((g) => g.purpose === 'investment')!;

  const spendingTotals = spendingGroup.totals;

  // Saved = goals by balance + investments by worth
  const savedTotals = totalsByCurrency([
    ...goalGroup.wallets.map((w) => ({ currency: w.currency, amount: w.currentBalance })),
    ...investmentGroup.wallets.map((w) => ({ currency: w.currency, amount: w.currentBalance })),
  ]);

  // Spending change vs last month calculation
  const spendingChanges = spendingTotals.map((st) => {
    const walletsInCur = spendingGroup.wallets.filter((w) => w.currency === st.currency);
    const prevMonthTotal = round2(
      walletsInCur.reduce((sum, w) => sum + w.prevMonthBalance, 0)
    );
    const change = round2(st.amount - prevMonthTotal);
    const changePercentage =
      prevMonthTotal !== 0 ? round2((change / prevMonthTotal) * 100) : 0;
    return {
      currency: st.currency,
      changeVsLastMonth: change,
      changePercentage,
    };
  });

  const primarySpendingChange = spendingChanges[0] ?? {
    changeVsLastMonth: 0,
    changePercentage: 0,
  };
  const spendingPrevMonthTotal = round2(
    spendingGroup.wallets.reduce((sum, w) => sum + w.prevMonthBalance, 0)
  );
  const spendingChangeVsLastMonth = primarySpendingChange.changeVsLastMonth;
  const spendingChangePercentage = primarySpendingChange.changePercentage;

  return {
    spendingTotals,
    savedTotals,
    spendingChangeVsLastMonth,
    spendingPrevMonthTotal,
    spendingChangePercentage,
    spendingChanges,
    groups,
  };
}

// -------------------------------------------------------------
// 2. Balance over time
// -------------------------------------------------------------

export type BalanceOverTimeMode = 'spending' | 'saving';

export interface BalanceOverTimeOptions {
  mode?: BalanceOverTimeMode;
}

export interface BalanceOverTimePoint {
  month: string;
  total: number;
  [walletId: string]: number | string;
}

export interface WalletChartMeta {
  id: string;
  nameAr: string | null;
  nameEn: string | null;
  color: string;
  currency: string;
  icon: string | null;
  finalBalance: number;
}

export interface CurrencyBalanceOverTime {
  currency: string;
  dataPoints: BalanceOverTimePoint[];
  wallets: WalletChartMeta[];
  finalTotal: number;
}

export interface BalanceOverTimeResult {
  mode: BalanceOverTimeMode;
  currencies: CurrencyBalanceOverTime[];
  dataPoints: BalanceOverTimePoint[];
  wallets: WalletChartMeta[];
}

export function balanceOverTimeReport(
  wallets: Wallet[],
  entries: EnrichedEntry[],
  months: string[],
  options?: BalanceOverTimeOptions | BalanceOverTimeMode
): BalanceOverTimeResult {
  const mode: BalanceOverTimeMode =
    typeof options === 'string' ? options : options?.mode ?? 'spending';

  const activeWallets = wallets.filter((w) => {
    if (w.isArchived) return false;
    const purpose = w.purpose ?? 'spending';
    if (mode === 'spending') {
      return purpose === 'spending';
    } else {
      return purpose === 'goal' || purpose === 'investment';
    }
  });

  // Filter valid entries
  const validEntries = entries
    .filter((e) => !e.deletedAt)
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

  const sortedMonths = [...months].sort();

  // Find all distinct currencies
  const distinctCurrencies = Array.from(
    new Set(activeWallets.map((w) => w.currency || 'EGP'))
  );
  if (distinctCurrencies.length === 0) {
    distinctCurrencies.push('EGP');
  }

  const currencies: CurrencyBalanceOverTime[] = distinctCurrencies.map((currency) => {
    const currWallets = activeWallets.filter((w) => (w.currency || 'EGP') === currency);

    const dataPoints: BalanceOverTimePoint[] = sortedMonths.map((m) => {
      const point: BalanceOverTimePoint = {
        month: m,
        total: 0,
      };

      let monthTotal = 0;
      for (const w of currWallets) {
        let bal = w.openingBalance || 0;
        for (const e of validEntries) {
          if (e.occurredOn.slice(0, 7) > m) break;
          if (e.accountId === w.id) {
            if (e.type === 'income') bal += e.amount;
            else if (e.type === 'expense' || e.type === 'transfer') bal -= e.amount;
          }
          if (e.type === 'transfer' && e.toAccountId === w.id) {
            bal += e.amount;
          }
        }
        bal = round2(bal);
        point[w.id] = bal;
        monthTotal += bal;
      }

      point.total = round2(monthTotal);
      return point;
    });

    const lastPoint = dataPoints[dataPoints.length - 1];

    const walletMetas: WalletChartMeta[] = currWallets.map((w, index) => {
      const defaultColors = ['#0F766E', '#1D4ED8', '#B45309', '#BE185D', '#6D28D9'];
      const color = w.color || defaultColors[index % defaultColors.length];
      const finalBalance = (lastPoint?.[w.id] as number) ?? round2(w.openingBalance);

      return {
        id: w.id,
        nameAr: w.nameAr,
        nameEn: w.nameEn,
        color,
        currency,
        icon: w.icon,
        finalBalance,
      };
    });

    const finalTotal = lastPoint?.total ?? 0;

    return {
      currency,
      dataPoints,
      wallets: walletMetas,
      finalTotal,
    };
  });

  return {
    mode,
    currencies,
    dataPoints: currencies[0]?.dataPoints ?? [],
    wallets: currencies.flatMap((c) => c.wallets),
  };
}

// -------------------------------------------------------------
// 3. In & out per wallet
// -------------------------------------------------------------

export interface InOutWalletRow {
  walletId: string;
  nameAr: string | null;
  nameEn: string | null;
  type: string;
  icon: string | null;
  color: string | null;
  moneyIn: number;
  moneyOut: number;
  transfersIn: number;
  transfersOut: number;
  netChange: number;
  operationsCount: number;
}

export interface InOutPerWalletResult {
  month: string;
  totalIn: number;
  totalOut: number;
  totalTransfers: number;
  netFlow: number;
  wallets: InOutWalletRow[];
}

export function inOutPerWalletReport(
  wallets: Wallet[],
  entries: EnrichedEntry[],
  month: string
): InOutPerWalletResult {
  const activeWallets = wallets.filter((w) => !w.isArchived);
  const rowsMap = new Map<string, InOutWalletRow>();

  for (const w of activeWallets) {
    rowsMap.set(w.id, {
      walletId: w.id,
      nameAr: w.nameAr,
      nameEn: w.nameEn,
      type: w.type,
      icon: w.icon,
      color: w.color,
      moneyIn: 0,
      moneyOut: 0,
      transfersIn: 0,
      transfersOut: 0,
      netChange: 0,
      operationsCount: 0,
    });
  }

  let totalIn = 0;
  let totalOut = 0;
  let totalTransfers = 0;

  for (const e of entries) {
    if (e.deletedAt) continue;
    if (!e.occurredOn.startsWith(month)) continue;

    const isCorrection = isBalanceCorrection(e);

    if (e.type === 'income') {
      const row = rowsMap.get(e.accountId);
      if (row) {
        row.operationsCount++;
        // Exclude balance corrections from report moneyIn totals
        if (!isCorrection) {
          row.moneyIn = round2(row.moneyIn + e.amount);
          totalIn = round2(totalIn + e.amount);
        }
      }
    } else if (e.type === 'expense') {
      const row = rowsMap.get(e.accountId);
      if (row) {
        row.operationsCount++;
        // Exclude balance corrections from report moneyOut totals
        if (!isCorrection) {
          row.moneyOut = round2(row.moneyOut + e.amount);
          totalOut = round2(totalOut + e.amount);
        }
      }
    } else if (e.type === 'transfer') {
      totalTransfers = round2(totalTransfers + e.amount);

      const fromRow = rowsMap.get(e.accountId);
      if (fromRow) {
        fromRow.operationsCount++;
        fromRow.transfersOut = round2(fromRow.transfersOut + e.amount);
      }

      if (e.toAccountId) {
        const toRow = rowsMap.get(e.toAccountId);
        if (toRow) {
          toRow.operationsCount++;
          toRow.transfersIn = round2(toRow.transfersIn + e.amount);
        }
      }
    }
  }

  const walletRows = Array.from(rowsMap.values()).map((row) => {
    row.netChange = round2(
      row.moneyIn + row.transfersIn - (row.moneyOut + row.transfersOut)
    );
    return row;
  });

  walletRows.sort((a, b) => b.moneyOut + b.transfersOut - (a.moneyOut + a.transfersOut));

  return {
    month,
    totalIn,
    totalOut,
    totalTransfers,
    netFlow: round2(totalIn - totalOut),
    wallets: walletRows,
  };
}

// -------------------------------------------------------------
// 4. Cash withdrawals
// -------------------------------------------------------------

export interface CashWithdrawalItem {
  id: string;
  occurredOn: string;
  amount: number;
  note: string | null;
  fromWalletNameAr: string | null;
  fromWalletNameEn: string | null;
  toWalletNameAr: string | null;
  toWalletNameEn: string | null;
  cashSpentSince: number;
}

export interface CashWithdrawalsResult {
  withdrawals: CashWithdrawalItem[];
  totalWithdrawn: number;
  count: number;
  averageWithdrawal: number;
}

export function cashWithdrawalsReport(
  wallets: Wallet[],
  entries: EnrichedEntry[],
  monthOrMonths?: string | string[]
): CashWithdrawalsResult {
  const cashWalletIds = new Set(
    wallets.filter((w) => w.type === 'cash').map((w) => w.id)
  );

  const monthsSet = monthOrMonths
    ? new Set(Array.isArray(monthOrMonths) ? monthOrMonths : [monthOrMonths])
    : null;

  // Filter transfers to a cash wallet from a non-cash wallet
  const withdrawalEntries = entries
    .filter((e) => {
      if (e.deletedAt) return false;
      if (e.type !== 'transfer') return false;
      if (!e.toAccountId || !cashWalletIds.has(e.toAccountId)) return false;
      if (cashWalletIds.has(e.accountId)) return false; // cash to cash is not withdrawal
      if (monthsSet && !monthsSet.has(e.occurredOn.slice(0, 7))) return false;
      return true;
    })
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn)); // chronological order

  // All cash expenses (excluding balance corrections)
  const cashExpenses = entries
    .filter(
      (e) =>
        !e.deletedAt &&
        e.type === 'expense' &&
        cashWalletIds.has(e.accountId) &&
        !isBalanceCorrection(e)
    )
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

  const items: CashWithdrawalItem[] = withdrawalEntries.map((w, index) => {
    const nextWithdrawal = withdrawalEntries[index + 1];
    const startDate = w.occurredOn;
    const endDate = nextWithdrawal ? nextWithdrawal.occurredOn : '9999-12-31';

    // Calculate cash spent between this withdrawal and next withdrawal
    let cashSpent = 0;
    for (const exp of cashExpenses) {
      if (exp.occurredOn >= startDate && exp.occurredOn < endDate) {
        cashSpent += exp.amount;
      }
    }

    return {
      id: w.id,
      occurredOn: w.occurredOn,
      amount: round2(w.amount),
      note: w.note ?? null,
      fromWalletNameAr: w.accountNameAr ?? null,
      fromWalletNameEn: w.accountNameEn ?? null,
      toWalletNameAr: w.toAccountNameAr ?? null,
      toWalletNameEn: w.toAccountNameEn ?? null,
      cashSpentSince: round2(cashSpent),
    };
  });

  // Sort newest first for display
  items.reverse();

  const totalWithdrawn = round2(items.reduce((sum, item) => sum + item.amount, 0));
  const count = items.length;
  const averageWithdrawal = count > 0 ? round2(totalWithdrawn / count) : 0;

  return {
    withdrawals: items,
    totalWithdrawn,
    count,
    averageWithdrawal,
  };
}

// -------------------------------------------------------------
// 5. Transfers log
// -------------------------------------------------------------

export interface TransferLogItem {
  id: string;
  occurredOn: string;
  amount: number;
  note: string | null;
  fromWalletId: string;
  fromWalletNameAr: string | null;
  fromWalletNameEn: string | null;
  toWalletId: string;
  toWalletNameAr: string | null;
  toWalletNameEn: string | null;
}

export interface TransfersLogResult {
  transfers: TransferLogItem[];
  totalTransfers: number;
  count: number;
}

export function transfersLogReport(
  wallets: Wallet[],
  entries: EnrichedEntry[],
  options: { walletId?: string; month?: string } = {}
): TransfersLogResult {
  const walletMap = new Map<string, Wallet>();
  for (const w of wallets) {
    walletMap.set(w.id, w);
  }

  const transfers = entries
    .filter((e) => {
      if (e.deletedAt) return false;
      if (e.type !== 'transfer') return false;
      if (!e.toAccountId) return false;

      if (options.walletId) {
        if (e.accountId !== options.walletId && e.toAccountId !== options.walletId) {
          return false;
        }
      }

      if (options.month) {
        if (!e.occurredOn.startsWith(options.month)) return false;
      }

      return true;
    })
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
    .map((e) => {
      const fromWallet = walletMap.get(e.accountId);
      const toWallet = e.toAccountId ? walletMap.get(e.toAccountId) : null;

      return {
        id: e.id,
        occurredOn: e.occurredOn,
        amount: round2(e.amount),
        note: e.note ?? null,
        fromWalletId: e.accountId,
        fromWalletNameAr: e.accountNameAr ?? fromWallet?.nameAr ?? null,
        fromWalletNameEn: e.accountNameEn ?? fromWallet?.nameEn ?? null,
        toWalletId: e.toAccountId!,
        toWalletNameAr: e.toAccountNameAr ?? toWallet?.nameAr ?? null,
        toWalletNameEn: e.toAccountNameEn ?? toWallet?.nameEn ?? null,
      };
    });

  const totalTransfers = round2(transfers.reduce((sum, t) => sum + t.amount, 0));

  return {
    transfers,
    totalTransfers,
    count: transfers.length,
  };
}

import { describe, expect, it } from 'vitest';
import type { EnrichedEntry, Wallet, WalletBalance } from '../data/types';
import {
  ITEM_EXPENSE_BALANCE_CORRECTION_ID,
  ITEM_INCOME_BALANCE_CORRECTION_ID,
} from '../data/mock-seed';
import {
  balanceOverTimeReport,
  cashWithdrawalsReport,
  inOutPerWalletReport,
  isBalanceCorrection,
  netWorthReport,
  transfersLogReport,
} from './wallet-reports';

const mockWallets: Wallet[] = [
  {
    id: 'w-cash',
    householdId: 'h1',
    nameAr: 'كاش',
    nameEn: 'Cash',
    type: 'cash',
    openingBalance: 5000,
    icon: 'banknote',
    color: '#0F766E',
    sortOrder: 0,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'w-nbe',
    householdId: 'h1',
    nameAr: 'الأهلي',
    nameEn: 'NBE',
    type: 'bank',
    openingBalance: 40000,
    icon: 'landmark',
    color: '#15803D',
    sortOrder: 1,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'w-cib',
    householdId: 'h1',
    nameAr: 'CIB',
    nameEn: 'CIB',
    type: 'bank',
    openingBalance: 20000,
    icon: 'building',
    color: '#1D4ED8',
    sortOrder: 2,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

const mockBalances: WalletBalance[] = [
  { ...mockWallets[0], balance: 4000 },
  { ...mockWallets[1], balance: 35000 },
  { ...mockWallets[2], balance: 25000 },
];

const mockEntries: EnrichedEntry[] = [
  // 1. Regular expense from cash
  {
    id: 'e1',
    householdId: 'h1',
    type: 'expense',
    amount: 1000,
    occurredOn: '2026-10-05',
    accountId: 'w-cash',
    toAccountId: null,
    itemId: 'item-food',
    note: 'Groceries',
    createdBy: 'u1',
    updatedBy: null,
    createdAt: '2026-10-05',
    updatedAt: '2026-10-05',
    deletedAt: null,
    accountNameEn: 'Cash',
  },
  // 2. Regular income to NBE
  {
    id: 'e2',
    householdId: 'h1',
    type: 'income',
    amount: 15000,
    occurredOn: '2026-10-01',
    accountId: 'w-nbe',
    toAccountId: null,
    itemId: 'item-salary',
    note: 'Salary',
    createdBy: 'u1',
    updatedBy: null,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
    deletedAt: null,
    accountNameEn: 'NBE',
  },
  // 3. ATM transfer from NBE to Cash (withdrawal)
  {
    id: 'e3',
    householdId: 'h1',
    type: 'transfer',
    amount: 3000,
    occurredOn: '2026-10-02',
    accountId: 'w-nbe',
    toAccountId: 'w-cash',
    itemId: null,
    note: 'ATM',
    createdBy: 'u1',
    updatedBy: null,
    createdAt: '2026-10-02',
    updatedAt: '2026-10-02',
    deletedAt: null,
    accountNameEn: 'NBE',
    toAccountNameEn: 'Cash',
  },
  // 4. Another withdrawal later in month
  {
    id: 'e4',
    householdId: 'h1',
    type: 'transfer',
    amount: 2000,
    occurredOn: '2026-10-15',
    accountId: 'w-cib',
    toAccountId: 'w-cash',
    itemId: null,
    note: 'CIB ATM',
    createdBy: 'u1',
    updatedBy: null,
    createdAt: '2026-10-15',
    updatedAt: '2026-10-15',
    deletedAt: null,
    accountNameEn: 'CIB',
    toAccountNameEn: 'Cash',
  },
  // 5. Cash expense between withdrawals
  {
    id: 'e5',
    householdId: 'h1',
    type: 'expense',
    amount: 500,
    occurredOn: '2026-10-08',
    accountId: 'w-cash',
    toAccountId: null,
    itemId: 'item-coffee',
    note: 'Cafe',
    createdBy: 'u1',
    updatedBy: null,
    createdAt: '2026-10-08',
    updatedAt: '2026-10-08',
    deletedAt: null,
    accountNameEn: 'Cash',
  },
  // 6. Balance correction entry (MUST BE EXCLUDED FROM EXPENSE / INCOME TOTALS)
  {
    id: 'e6',
    householdId: 'h1',
    type: 'expense',
    amount: 250,
    occurredOn: '2026-10-10',
    accountId: 'w-cash',
    toAccountId: null,
    itemId: ITEM_EXPENSE_BALANCE_CORRECTION_ID,
    note: 'Balance correction',
    createdBy: 'u1',
    updatedBy: null,
    createdAt: '2026-10-10',
    updatedAt: '2026-10-10',
    deletedAt: null,
    categoryNameEn: 'Adjustments',
    itemNameEn: 'Balance correction',
    accountNameEn: 'Cash',
  },
  // 7. Income balance correction (MUST BE EXCLUDED FROM INCOME TOTALS)
  {
    id: 'e7',
    householdId: 'h1',
    type: 'income',
    amount: 500,
    occurredOn: '2026-10-12',
    accountId: 'w-cib',
    toAccountId: null,
    itemId: ITEM_INCOME_BALANCE_CORRECTION_ID,
    note: 'Balance correction',
    createdBy: 'u1',
    updatedBy: null,
    createdAt: '2026-10-12',
    updatedAt: '2026-10-12',
    deletedAt: null,
    categoryNameEn: 'Adjustments',
    itemNameEn: 'Balance correction',
    accountNameEn: 'CIB',
  },
];

describe('wallet-reports pure functions', () => {
  it('isBalanceCorrection correctly identifies balance corrections', () => {
    expect(isBalanceCorrection({ itemId: ITEM_EXPENSE_BALANCE_CORRECTION_ID })).toBe(true);
    expect(isBalanceCorrection({ itemId: ITEM_INCOME_BALANCE_CORRECTION_ID })).toBe(true);
    expect(isBalanceCorrection({ categoryNameEn: 'Adjustments' })).toBe(true);
    expect(isBalanceCorrection({ categoryNameAr: 'تسويات' })).toBe(true);
    expect(isBalanceCorrection({ itemNameEn: 'Balance correction' })).toBe(true);
    expect(isBalanceCorrection({ itemId: 'regular-item' })).toBe(false);
  });

  it('netWorthReport calculates total net worth and wallet breakdown', () => {
    const report = netWorthReport(mockWallets, mockBalances, mockEntries, '2026-10');
    expect(report.totalNetWorth).toBe(64000); // 4000 + 35000 + 25000
    expect(report.wallets).toHaveLength(3);
    expect(report.wallets[0].id).toBe('w-nbe');
    expect(report.wallets[0].currentBalance).toBe(35000);
    expect(report.wallets[0].sharePercentage).toBeGreaterThan(50);
  });

  it('balanceOverTimeReport produces points for each month', () => {
    const report = balanceOverTimeReport(mockWallets, mockEntries, ['2026-09', '2026-10']);
    expect(report.dataPoints).toHaveLength(2);
    expect(report.dataPoints[0].month).toBe('2026-09');
    expect(report.dataPoints[1].month).toBe('2026-10');
    expect(report.wallets).toHaveLength(3);
  });

  it('inOutPerWalletReport excludes balance corrections from moneyIn and moneyOut', () => {
    const report = inOutPerWalletReport(mockWallets, mockEntries, '2026-10');

    // Total income should be 15,000 (salary), NOT 15,500 (ignoring 500 correction)
    expect(report.totalIn).toBe(15000);

    // Total expense should be 1,500 (1,000 groceries + 500 cafe), NOT 1,750 (ignoring 250 correction)
    expect(report.totalOut).toBe(1500);

    // Total transfers should be 5,000 (3,000 + 2,000)
    expect(report.totalTransfers).toBe(5000);

    const cashRow = report.wallets.find((w) => w.walletId === 'w-cash');
    expect(cashRow?.moneyOut).toBe(1500); // excluded e6 (250)
    expect(cashRow?.transfersIn).toBe(5000);

    const cibRow = report.wallets.find((w) => w.walletId === 'w-cib');
    expect(cibRow?.moneyIn).toBe(0); // excluded e7 (500)
    expect(cibRow?.transfersOut).toBe(2000);
  });

  it('cashWithdrawalsReport finds bank-to-cash transfers and calculates cashSpentSince', () => {
    const report = cashWithdrawalsReport(mockWallets, mockEntries, '2026-10');
    expect(report.count).toBe(2);
    expect(report.totalWithdrawn).toBe(5000);
    expect(report.averageWithdrawal).toBe(2500);

    // withdrawal 1: on 2026-10-02 (3000). Between Oct 2 and Oct 15, cash spent was 1000 + 500 = 1500 (e6 correction excluded)
    const w1 = report.withdrawals.find((w) => w.occurredOn === '2026-10-02');
    expect(w1?.cashSpentSince).toBe(1500);
  });

  it('transfersLogReport lists all transfers and filters by wallet', () => {
    const all = transfersLogReport(mockWallets, mockEntries);
    expect(all.count).toBe(2);
    expect(all.totalTransfers).toBe(5000);

    const cibOnly = transfersLogReport(mockWallets, mockEntries, { walletId: 'w-cib' });
    expect(cibOnly.count).toBe(1);
    expect(cibOnly.transfers[0].amount).toBe(2000);
  });
});

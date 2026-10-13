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
    currency: 'EGP',
    icon: 'banknote',
    color: '#0F766E',
    sortOrder: 0,
    isArchived: false,
    purpose: 'spending',
    investmentKind: null,
    maturesOn: null,
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
    currency: 'EGP',
    icon: 'landmark',
    color: '#15803D',
    sortOrder: 1,
    isArchived: false,
    purpose: 'spending',
    investmentKind: null,
    maturesOn: null,
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
    currency: 'EGP',
    icon: 'building',
    color: '#1D4ED8',
    sortOrder: 2,
    isArchived: false,
    purpose: 'spending',
    investmentKind: null,
    maturesOn: null,
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

  it('netWorthReport groups wallets, returns per-currency totals, and excludes totalNetWorth', () => {
    const report = netWorthReport(mockWallets, mockBalances, mockEntries, '2026-10');
    // Ensure totalNetWorth is removed
    expect('totalNetWorth' in report).toBe(false);
    expect(report.spendingTotals).toEqual([{ currency: 'EGP', amount: 64000 }]);
    expect(report.savedTotals).toEqual([]);
    expect(report.groups).toHaveLength(3);

    const spendingGroup = report.groups.find((g) => g.purpose === 'spending')!;
    expect(spendingGroup.wallets).toHaveLength(3);
    expect(spendingGroup.wallets[0].id).toBe('w-nbe');
    expect(spendingGroup.wallets[0].currentBalance).toBe(35000);
    expect(spendingGroup.wallets[0].sharePercentage).toBeGreaterThan(50);
  });

  it('netWorthReport: two currencies are not added together', () => {
    const multiCurrencyWallets: Wallet[] = [
      { ...mockWallets[0], id: 'w-egp', currency: 'EGP', openingBalance: 5000 },
      { ...mockWallets[1], id: 'w-usd', currency: 'USD', openingBalance: 1000 },
    ];
    const multiBalances: WalletBalance[] = [
      { ...multiCurrencyWallets[0], balance: 5000 },
      { ...multiCurrencyWallets[1], balance: 1000 },
    ];

    const report = netWorthReport(multiCurrencyWallets, multiBalances, [], '2026-10');
    expect(report.spendingTotals).toEqual([
      { currency: 'EGP', amount: 5000 },
      { currency: 'USD', amount: 1000 },
    ]);
    // Ensure they are never summed across currencies
    expect(report.spendingTotals).toHaveLength(2);
  });

  it('netWorthReport: an investment uses worth instead of balance', () => {
    const investWallet: Wallet = {
      ...mockWallets[0],
      id: 'w-invest',
      purpose: 'investment',
      openingBalance: 80000,
    };
    const balances: WalletBalance[] = [{ ...investWallet, balance: 80000 }];
    const investments = [{ id: 'w-invest', worth: 96000 }];

    const report = netWorthReport([investWallet], balances, [], '2026-10', investments);
    const investGroup = report.groups.find((g) => g.purpose === 'investment')!;
    expect(investGroup.wallets).toHaveLength(1);
    expect(investGroup.wallets[0].currentBalance).toBe(96000);
    expect(report.savedTotals).toEqual([{ currency: 'EGP', amount: 96000 }]);
  });

  it('netWorthReport: a wallet with no purpose lands in spending', () => {
    const noPurposeWallet: Wallet = {
      ...mockWallets[0],
      id: 'w-no-purpose',
      purpose: undefined as unknown as Wallet['purpose'],
      openingBalance: 1200,
    };
    const report = netWorthReport([noPurposeWallet], [{ ...noPurposeWallet, balance: 1200 }], [], '2026-10');
    const spendingGroup = report.groups.find((g) => g.purpose === 'spending')!;
    expect(spendingGroup.wallets.some((w) => w.id === 'w-no-purpose')).toBe(true);
  });

  it('netWorthReport: archived wallets are skipped', () => {
    const archivedWallet: Wallet = {
      ...mockWallets[0],
      id: 'w-archived',
      isArchived: true,
      openingBalance: 5000,
    };
    const report = netWorthReport([archivedWallet], [{ ...archivedWallet, balance: 5000 }], [], '2026-10');
    for (const g of report.groups) {
      expect(g.wallets.some((w) => w.id === 'w-archived')).toBe(false);
    }
    expect(report.spendingTotals).toEqual([]);
    expect(report.savedTotals).toEqual([]);
  });

  it('balanceOverTimeReport produces points for each month in spending mode', () => {
    const report = balanceOverTimeReport(mockWallets, mockEntries, ['2026-09', '2026-10']);
    expect(report.dataPoints).toHaveLength(2);
    expect(report.dataPoints[0].month).toBe('2026-09');
    expect(report.dataPoints[1].month).toBe('2026-10');
    expect(report.wallets).toHaveLength(3);
    expect(report.mode).toBe('spending');
  });

  it('balanceOverTimeReport filters by spending and saving modes', () => {
    const mixedWallets: Wallet[] = [
      { ...mockWallets[0], id: 'w-spend', purpose: 'spending', openingBalance: 1000 },
      { ...mockWallets[1], id: 'w-goal', purpose: 'goal', openingBalance: 2000 },
      { ...mockWallets[2], id: 'w-inv', purpose: 'investment', openingBalance: 3000 },
    ];

    const spendingReport = balanceOverTimeReport(mixedWallets, [], ['2026-10'], 'spending');
    expect(spendingReport.wallets).toHaveLength(1);
    expect(spendingReport.wallets[0].id).toBe('w-spend');
    expect(spendingReport.dataPoints[0].total).toBe(1000);

    const savingReport = balanceOverTimeReport(mixedWallets, [], ['2026-10'], 'saving');
    expect(savingReport.wallets).toHaveLength(2);
    expect(savingReport.wallets.map((w) => w.id)).toEqual(['w-goal', 'w-inv']);
    expect(savingReport.dataPoints[0].total).toBe(5000); // 2000 + 3000
  });

  it('balanceOverTimeReport: two currencies have separate charts and are not added together', () => {
    const multiCurWallets: Wallet[] = [
      { ...mockWallets[0], id: 'w-egp', currency: 'EGP', openingBalance: 4000 },
      { ...mockWallets[1], id: 'w-usd', currency: 'USD', openingBalance: 500 },
    ];

    const report = balanceOverTimeReport(multiCurWallets, [], ['2026-10']);
    expect(report.currencies).toHaveLength(2);

    const egp = report.currencies.find((c) => c.currency === 'EGP')!;
    const usd = report.currencies.find((c) => c.currency === 'USD')!;

    expect(egp.wallets).toHaveLength(1);
    expect(egp.dataPoints[0].total).toBe(4000);

    expect(usd.wallets).toHaveLength(1);
    expect(usd.dataPoints[0].total).toBe(500);
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

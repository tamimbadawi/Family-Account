import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { FamilyAccountsDB } from '../offline/db';
import { MockRepository } from './mock-repository';
import { WALLET_BANK_ID, WALLET_CASH_ID } from './mock-seed';

describe('MockRepository with fake-indexeddb', () => {
  let db: FamilyAccountsDB;
  let repo: MockRepository;

  beforeEach(async () => {
    // Unique in-memory database name for each test
    const dbName = `test-fa-${Math.random().toString(36).substring(2, 9)}`;
    db = new FamilyAccountsDB(dbName);
    repo = new MockRepository(db);
    await repo.seed();
  });

  it('seeds default household, members, wallets, and categories', async () => {
    const household = await repo.getHousehold();
    expect(household).not.toBeNull();
    expect(household?.name).toBe('عائلتنا');
    expect(household?.currency).toBe('EGP');

    const members = await repo.getMembers();
    expect(members).toHaveLength(2);
    const names = members.map((m) => m.displayName);
    expect(names).toContain('ماما');
    expect(names).toContain('بابا');

    const wallets = await repo.getWallets();
    expect(wallets).toHaveLength(2);
    expect(wallets.map((w) => w.nameAr)).toContain('كاش');
    expect(wallets.map((w) => w.nameAr)).toContain('البنك');

    const categories = await repo.getCategories();
    expect(categories.length).toBeGreaterThanOrEqual(6);
    const catNamesEn = categories.map((c) => c.nameEn);
    expect(catNamesEn).toContain('Household');
    expect(catNamesEn).toContain('Food');
    expect(catNamesEn).toContain('Income');

    const allEntries = await repo.listEntries({ includeDeleted: true });
    expect(allEntries.length).toBeGreaterThanOrEqual(100);
  });

  it('calculates month summary correctly', async () => {
    const entries = await repo.listEntries();
    expect(entries.length).toBeGreaterThan(0);

    const firstMonth = entries[0].occurredOn.slice(0, 7);
    const summary = await repo.monthSummary(firstMonth);

    expect(summary.month).toBe(firstMonth);
    expect(summary.net).toBe(Math.round((summary.income - summary.expense) * 100) / 100);
    expect(summary.income).toBeGreaterThanOrEqual(0);
    expect(summary.expense).toBeGreaterThanOrEqual(0);
  });

  it('calculates wallet balances accurately factoring opening balance and transactions', async () => {
    const balances = await repo.walletBalances();
    expect(balances).toHaveLength(2);

    const cashWallet = balances.find((w) => w.id === WALLET_CASH_ID);
    const bankWallet = balances.find((w) => w.id === WALLET_BANK_ID);

    expect(cashWallet).toBeDefined();
    expect(bankWallet).toBeDefined();

    // Verify balance math for cash wallet
    const allTxs = await db.transactions.filter((t) => t.deleted_at === null).toArray();
    let expectedCash = cashWallet!.openingBalance;
    for (const t of allTxs) {
      if (t.type === 'income' && t.account_id === WALLET_CASH_ID) {
        expectedCash += Number(t.amount);
      } else if (t.type === 'expense' && t.account_id === WALLET_CASH_ID) {
        expectedCash -= Number(t.amount);
      } else if (t.type === 'transfer') {
        if (t.account_id === WALLET_CASH_ID) expectedCash -= Number(t.amount);
        if (t.to_account_id === WALLET_CASH_ID) expectedCash += Number(t.amount);
      }
    }

    expect(cashWallet!.balance).toBe(Math.round(expectedCash * 100) / 100);
  });

  it('soft deletes and restores entries, updating balances and summaries', async () => {
    const entries = await repo.listEntries();
    const target = entries.find((e) => e.type === 'expense' && e.accountId === WALLET_CASH_ID);
    expect(target).toBeDefined();

    const month = target!.occurredOn.slice(0, 7);
    const summaryBefore = await repo.monthSummary(month);
    const balancesBefore = await repo.walletBalances();
    const cashBefore = balancesBefore.find((w) => w.id === WALLET_CASH_ID)!.balance;

    // 1. Soft delete
    await repo.softDeleteEntry(target!.id);

    const activeEntriesAfter = await repo.listEntries();
    expect(activeEntriesAfter.some((e) => e.id === target!.id)).toBe(false);

    const deletedEntries = await repo.listEntries({ onlyDeleted: true });
    expect(deletedEntries.some((e) => e.id === target!.id)).toBe(true);

    const summaryAfterDelete = await repo.monthSummary(month);
    expect(summaryAfterDelete.expense).toBe(
      Math.round((summaryBefore.expense - target!.amount) * 100) / 100
    );

    const balancesAfterDelete = await repo.walletBalances();
    const cashAfterDelete = balancesAfterDelete.find((w) => w.id === WALLET_CASH_ID)!.balance;
    expect(cashAfterDelete).toBe(Math.round((cashBefore + target!.amount) * 100) / 100);

    // 2. Restore
    await repo.restoreEntry(target!.id);

    const activeEntriesRestored = await repo.listEntries();
    expect(activeEntriesRestored.some((e) => e.id === target!.id)).toBe(true);

    const summaryRestored = await repo.monthSummary(month);
    expect(summaryRestored.expense).toBe(summaryBefore.expense);

    const balancesRestored = await repo.walletBalances();
    const cashRestored = balancesRestored.find((w) => w.id === WALLET_CASH_ID)!.balance;
    expect(cashRestored).toBe(cashBefore);
  });

  it('adds and updates entries with constraint validations', async () => {
    const items = await repo.getItems();
    expect(items.length).toBeGreaterThan(0);
    const item = items[0];

    // Add valid expense
    const newEntry = await repo.addEntry({
      type: 'expense',
      amount: 250,
      occurredOn: '2026-10-06',
      accountId: WALLET_CASH_ID,
      itemId: item.id,
      note: 'تجربة إضافة مصروف',
    });

    expect(newEntry.id).toBeDefined();
    expect(newEntry.amount).toBe(250);

    // Update expense
    const updated = await repo.updateEntry(newEntry.id, {
      amount: 300,
      note: 'تعديل المصروف',
    });
    expect(updated.amount).toBe(300);
    expect(updated.note).toBe('تعديل المصروف');

    // Reject non-positive amounts
    await expect(
      repo.addEntry({
        type: 'expense',
        amount: -10,
        occurredOn: '2026-10-06',
        accountId: WALLET_CASH_ID,
        itemId: item.id,
      })
    ).rejects.toThrow('greater than zero');

    // Reject transfer with same source and destination
    await expect(
      repo.addEntry({
        type: 'transfer',
        amount: 500,
        occurredOn: '2026-10-06',
        accountId: WALLET_CASH_ID,
        toAccountId: WALLET_CASH_ID,
      })
    ).rejects.toThrow('same as source');
  });

  it('fetches recent items ordered by frequency', async () => {
    const recent = await repo.recentItems(6);
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThanOrEqual(6);

    for (const r of recent) {
      expect(r.item).toBeDefined();
      expect(r.category).toBeDefined();
      expect(r.usageCount).toBeGreaterThan(0);
    }
  });

  it('computes category totals with percentages', async () => {
    const entries = await repo.listEntries();
    const month = entries[0].occurredOn.slice(0, 7);

    const totals = await repo.categoryTotals(month, 'expense', 'category');
    expect(totals.length).toBeGreaterThan(0);

    // Verify sorted descending
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i - 1].total).toBeGreaterThanOrEqual(totals[i].total);
    }

    const sumPercentage = totals.reduce((sum, t) => sum + (t.percentage ?? 0), 0);
    expect(Math.round(sumPercentage)).toBe(100);
  });

  it('generates enriched entries for pivot tables', async () => {
    const pivotEntries = await repo.entriesForPivot('last-3-months');
    expect(pivotEntries.length).toBeGreaterThan(0);

    const sample = pivotEntries[0];
    expect(sample.id).toBeDefined();
    expect(sample.month).toMatch(/^\d{4}-\d{2}$/);
    expect(sample.week).toMatch(/^\d{4}-W\d{2}$/);
    expect(sample.categoryNameAr || sample.categoryNameEn).toBeDefined();
    expect(sample.accountNameAr || sample.accountNameEn).toBeDefined();
  });
});

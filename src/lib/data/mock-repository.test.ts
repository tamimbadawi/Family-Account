import 'fake-indexeddb/auto';
import { liveQuery } from 'dexie';
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
    expect(wallets).toHaveLength(4);
    expect(wallets.map((w) => w.nameAr)).toContain('كاش');
    expect(wallets.map((w) => w.nameAr)).toContain('البنك الأهلي');
    expect(wallets.map((w) => w.nameAr)).toContain('بنك CIB');
    expect(wallets.map((w) => w.nameAr)).toContain('بنك مصر');

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
    expect(balances).toHaveLength(4);

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

  it('runs read methods inside Dexie liveQuery against an empty database without ReadOnlyError', async () => {
    const emptyDb = new FamilyAccountsDB(`test-empty-${Math.random().toString(36).substring(2, 9)}`);
    const freshRepo = new MockRepository(emptyDb);

    const runInLiveQuery = <T>(querier: () => Promise<T>): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const observable = liveQuery(querier);
        const subscription = observable.subscribe({
          next: (val) => {
            subscription.unsubscribe();
            resolve(val);
          },
          error: (err) => {
            subscription.unsubscribe();
            reject(err);
          },
        });
      });
    };

    // 1. syncStatus (the exact querier that caused the crash in bug report)
    const syncStatus = await runInLiveQuery(() => freshRepo.syncStatus());
    expect(syncStatus).toEqual({
      status: 'synced',
      lastSyncedAt: null,
      pendingCount: 0,
    });

    // 2. Household & Members
    const household = await runInLiveQuery(() => freshRepo.getHousehold());
    expect(household).toBeNull();

    const members = await runInLiveQuery(() => freshRepo.getMembers());
    expect(members).toEqual([]);

    // 3. Wallets & Balances
    const wallets = await runInLiveQuery(() => freshRepo.getWallets());
    expect(wallets).toEqual([]);

    const balances = await runInLiveQuery(() => freshRepo.walletBalances());
    expect(balances).toEqual([]);

    // 4. Categories, Subcategories, Items
    const categories = await runInLiveQuery(() => freshRepo.getCategories());
    expect(categories).toEqual([]);

    const subcategories = await runInLiveQuery(() => freshRepo.getSubcategories());
    expect(subcategories).toEqual([]);

    const items = await runInLiveQuery(() => freshRepo.getItems());
    expect(items).toEqual([]);

    // 5. Entries & Aggregations
    const entries = await runInLiveQuery(() => freshRepo.listEntries());
    expect(entries).toEqual([]);

    const entry = await runInLiveQuery(() => freshRepo.getEntry('unknown-id'));
    expect(entry).toBeNull();

    const recent = await runInLiveQuery(() => freshRepo.recentItems());
    expect(recent).toEqual([]);

    const summary = await runInLiveQuery(() => freshRepo.monthSummary('2026-10'));
    expect(summary).toEqual({
      month: '2026-10',
      income: 0,
      expense: 0,
      net: 0,
    });

    const totals = await runInLiveQuery(() => freshRepo.categoryTotals('2026-10', 'expense', 'category'));
    expect(totals).toEqual([]);

    const pivot = await runInLiveQuery(() => freshRepo.entriesForPivot('this-month'));
    expect(pivot).toEqual([]);
  });

  it('ensures ensureSeeded is idempotent and safe under concurrent calls (StrictMode)', async () => {
    const testDb = new FamilyAccountsDB(`test-strict-${Math.random().toString(36).substring(2, 9)}`);
    const testRepo = new MockRepository(testDb);

    // Call ensureSeeded concurrently multiple times as React StrictMode does
    await Promise.all([
      testRepo.ensureSeeded(),
      testRepo.ensureSeeded(),
      testRepo.ensureSeeded(),
    ]);

    const household = await testRepo.getHousehold();
    expect(household).not.toBeNull();
    expect(household?.name).toBe('عائلتنا');

    const entries = await testRepo.listEntries();
    expect(entries.length).toBeGreaterThan(0);
  });
  it('stores, reads, replaces and removes a receipt photo', async () => {
    const [item] = await repo.getItems();
    const entry = await repo.addEntry({
      type: 'expense',
      amount: 120,
      occurredOn: '2026-10-06',
      accountId: WALLET_CASH_ID,
      itemId: item.id,
    });
    expect(entry.photoPath).toBeNull();
    expect(await repo.getEntryPhoto(entry.id)).toBeNull();

    const jpeg = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const withPhoto = await repo.setEntryPhoto(entry.id, jpeg);
    expect(withPhoto.photoPath).toBe(`${entry.householdId}/${entry.id}.jpg`);
    expect((await repo.getEntry(entry.id))?.photoPath).toBe(withPhoto.photoPath);
    const stored = await repo.getEntryPhoto(entry.id);
    expect(stored?.size).toBe(3);

    // Replacing keeps one photo per entry and follows the new format
    const webp = new Blob([new Uint8Array([4, 5])], { type: 'image/webp' });
    const replaced = await repo.setEntryPhoto(entry.id, webp);
    expect(replaced.photoPath).toBe(`${entry.householdId}/${entry.id}.webp`);
    expect((await repo.getEntryPhoto(entry.id))?.size).toBe(2);

    // Editing other fields keeps the photo
    await repo.updateEntry(entry.id, { amount: 130 });
    expect((await repo.getEntry(entry.id))?.photoPath).toBe(replaced.photoPath);

    // Remove only clears the link
    const removed = await repo.removeEntryPhoto(entry.id);
    expect(removed.photoPath).toBeNull();
    expect(await repo.getEntryPhoto(entry.id)).toBeNull();
    expect(await db.photos.get(entry.id)).toBeDefined();

    await expect(repo.setEntryPhoto('missing', jpeg)).rejects.toThrow('Entry not found');
  });

  describe('adjustWalletBalance', () => {
    it('adjusts balance up with an income correction entry', async () => {
      const balancesBefore = await repo.walletBalances();
      const cash = balancesBefore.find((w) => w.id === WALLET_CASH_ID)!;
      const targetBalance = cash.balance + 500;

      const entry = await repo.adjustWalletBalance(WALLET_CASH_ID, targetBalance, '2026-10-06');
      expect(entry).not.toBeNull();
      expect(entry?.type).toBe('income');
      expect(entry?.amount).toBe(500);
      expect(entry?.accountId).toBe(WALLET_CASH_ID);

      const balancesAfter = await repo.walletBalances();
      const cashAfter = balancesAfter.find((w) => w.id === WALLET_CASH_ID)!;
      expect(cashAfter.balance).toBe(targetBalance);
    });

    it('adjusts balance down with an expense correction entry', async () => {
      const balancesBefore = await repo.walletBalances();
      const cash = balancesBefore.find((w) => w.id === WALLET_CASH_ID)!;
      const targetBalance = cash.balance - 250;

      const entry = await repo.adjustWalletBalance(WALLET_CASH_ID, targetBalance, '2026-10-06');
      expect(entry).not.toBeNull();
      expect(entry?.type).toBe('expense');
      expect(entry?.amount).toBe(250);
      expect(entry?.accountId).toBe(WALLET_CASH_ID);

      const balancesAfter = await repo.walletBalances();
      const cashAfter = balancesAfter.find((w) => w.id === WALLET_CASH_ID)!;
      expect(cashAfter.balance).toBe(targetBalance);
    });

    it('returns null and creates no entry when difference is zero', async () => {
      const balancesBefore = await repo.walletBalances();
      const cash = balancesBefore.find((w) => w.id === WALLET_CASH_ID)!;

      const entry = await repo.adjustWalletBalance(WALLET_CASH_ID, cash.balance, '2026-10-06');
      expect(entry).toBeNull();

      const balancesAfter = await repo.walletBalances();
      const cashAfter = balancesAfter.find((w) => w.id === WALLET_CASH_ID)!;
      expect(cashAfter.balance).toBe(cash.balance);
    });

    it('re-seeds when seedVersion is bumped', async () => {
      const dbName = `test-reseed-${Math.random().toString(36).substring(2, 9)}`;
      const reseedDb = new FamilyAccountsDB(dbName);
      const reseedRepo = new MockRepository(reseedDb);

      await reseedRepo.seed();
      // Overwrite seedVersion with older version 1
      await reseedDb.meta.put({ key: 'seedVersion', value: 1 });

      // Call ensureSeeded should detect mismatch and reseed
      await reseedRepo.ensureSeeded();
      const v = await reseedDb.meta.get('seedVersion');
      expect(v?.value).toBe(2);
    });
  });
});


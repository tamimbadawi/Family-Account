import 'fake-indexeddb/auto';
import { liveQuery } from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { FamilyAccountsDB } from '../offline/db';
import { MockRepository } from './mock-repository';
import { SEED_VERSION, USER_BABA_ID, USER_MAMA_ID, WALLET_BANK_ID, WALLET_CASH_ID } from './mock-seed';

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
    expect(names).toContain('Mama');
    expect(names).toContain('Baba');

    const wallets = await repo.getWallets();
    expect(wallets).toHaveLength(9);
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
    expect(balances).toHaveLength(9);

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

  it('renames the old Arabic sample members to English on phones already seeded', async () => {
    await db.household_members.update([(await repo.getHousehold())!.id, USER_MAMA_ID], { display_name: 'ماما' });
    await db.household_members.update([(await repo.getHousehold())!.id, USER_BABA_ID], { display_name: 'بابا' });
    const fresh = new MockRepository(db);
    await fresh.ensureSeeded();
    const names = (await fresh.getMembers()).map((m) => m.displayName).sort();
    expect(names).toEqual(['Baba', 'Mama']);
  });

  it('gives entries saved before creators were recorded to the current member', async () => {
    const item = (await repo.getItems())[0];
    const added = await repo.addEntry({ type: 'expense', amount: 10, occurredOn: '2026-10-06', accountId: WALLET_CASH_ID, itemId: item.id });
    await db.transactions.update(added.id, { created_by: null, updated_by: null });
    // A new connection = the app starting again (the startup check runs once per connection)
    const fresh = new MockRepository(new FamilyAccountsDB(db.name));
    await fresh.ensureSeeded();
    const listed = (await fresh.listEntries()).find((e) => e.id === added.id);
    expect(listed?.createdBy).toBe(USER_MAMA_ID);
    expect(listed?.createdByName).toBe('Mama');
  });

  it('stamps who added and who last changed an entry', async () => {
    const item = (await repo.getItems())[0];
    const added = await repo.addEntry({
      type: 'expense',
      amount: 40,
      occurredOn: '2026-10-06',
      accountId: WALLET_CASH_ID,
      itemId: item.id,
    });
    expect(added.createdBy).toBe(USER_MAMA_ID);

    repo.currentUserId = USER_BABA_ID;
    await repo.updateEntry(added.id, { amount: 45 });
    const listed = (await repo.listEntries()).find((e) => e.id === added.id);
    expect(listed?.createdBy).toBe(USER_MAMA_ID);
    expect(listed?.createdByName).toBe('Mama');
    expect(listed?.updatedBy).toBe(USER_BABA_ID);
    expect(listed?.updatedByName).toBe('Baba');
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
      expect(v?.value).toBe(SEED_VERSION);
    });

    it('re-seeds a store that is marked seeded but has no entries left', async () => {
      const dbName = `test-empty-${Math.random().toString(36).substring(2, 9)}`;
      const emptyDb = new FamilyAccountsDB(dbName);
      const emptyRepo = new MockRepository(emptyDb);

      await emptyRepo.seed();
      await emptyDb.transactions.clear();
      expect(await emptyDb.transactions.count()).toBe(0);

      await new MockRepository(emptyDb).ensureSeeded();
      expect(await emptyDb.transactions.count()).toBeGreaterThan(0);
    });
  });

  it('seeds sample budgets once and keeps one active budget per category or group', async () => {
    const seeded = await repo.getBudgets();
    expect(seeded.length).toBeGreaterThanOrEqual(1);
    expect(seeded.every((b) => b.amount > 0 && b.isStarter)).toBe(true);
    // Starter budgets are the family's to change: saving one makes it theirs
    const changed = await repo.updateBudget(seeded[0].id, { amount: 777 });
    expect(changed.amount).toBe(777);
    expect(changed.isStarter).toBe(false);

    const [food] = await repo.getCategories('expense');
    const before = (await repo.getBudgets()).length;
    const first = await repo.addBudget({ categoryId: food.id, amount: 1234.567 });
    const again = await repo.addBudget({ categoryId: food.id, amount: 2000 });
    expect(again.id).toBe(first.id);
    expect(again.amount).toBe(2000);
    expect((await repo.getBudgets()).filter((b) => b.categoryId === food.id && !b.subcategoryId)).toHaveLength(1);

    const [group] = await repo.getSubcategories(food.id);
    const groupBudget = await repo.addBudget({ categoryId: food.id, subcategoryId: group.id, amount: 300 });
    expect(groupBudget.id).not.toBe(first.id);

    await repo.archiveBudget(first.id);
    expect((await repo.getBudgets()).some((b) => b.id === first.id)).toBe(false);
    expect((await repo.getBudgets(true)).some((b) => b.id === first.id)).toBe(true);
    await repo.archiveBudget(first.id, false);
    expect((await repo.getBudgets()).length).toBeGreaterThanOrEqual(before);

    await expect(repo.addBudget({ categoryId: food.id, amount: 0 })).rejects.toThrow();
  });

  describe('clearing the sample data', () => {
    it('removes entries and budgets, zeroes sample wallets, keeps categories, and never reseeds', async () => {
      const categoriesBefore = (await repo.getCategories()).length;
      expect(await repo.hasSampleData()).toBe(true);

      await repo.clearSampleData();

      expect(await repo.hasSampleData()).toBe(false);
      expect(await repo.listEntries({ includeDeleted: true })).toHaveLength(0);
      expect(await repo.getBudgets(true)).toHaveLength(0);
      expect((await repo.getCategories()).length).toBe(categoriesBefore);

      const visible = await repo.getWallets();
      expect(visible.map((w) => w.id)).toEqual([WALLET_CASH_ID]);
      const balances = await repo.walletBalances();
      expect(balances.every((b) => b.balance === 0)).toBe(true);

      // A fresh start on the same phone (new app session) must not bring the samples back
      const reopened = new MockRepository(db);
      await reopened.ensureSeeded();
      expect(await reopened.listEntries({ includeDeleted: true })).toHaveLength(0);
    });

    it('keeps entries added after clearing', async () => {
      await repo.clearSampleData();
      const item = (await repo.getItems())[0];
      await repo.addEntry({ type: 'expense', amount: 50, occurredOn: '2026-10-01', accountId: WALLET_CASH_ID, itemId: item.id });
      const reopened = new MockRepository(db);
      await reopened.ensureSeeded();
      expect(await reopened.listEntries()).toHaveLength(1);
    });

    it('undo puts everything back', async () => {
      const entriesBefore = (await repo.listEntries({ includeDeleted: true })).length;
      const walletsBefore = await repo.getWallets();

      const undo = await repo.clearSampleData();
      await undo();

      expect(await repo.hasSampleData()).toBe(true);
      expect(await repo.listEntries({ includeDeleted: true })).toHaveLength(entriesBefore);
      expect(await repo.getWallets()).toEqual(walletsBefore);
    });
  });

  describe('recurring rules (R3)', () => {
    it('creates and archives a recurring rule', async () => {
      const db = new FamilyAccountsDB('test-recurring-1');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const item = (await repo.getItems())[0];
      const wallet = (await repo.getWallets())[0];

      const rule = await repo.createRecurringRule({
        type: 'expense',
        amount: 1500,
        dayOfMonth: 10,
        startMonth: '2026-08',
        accountId: wallet.id,
        itemId: item.id,
        note: 'Monthly club membership',
      });

      expect(rule.amount).toBe(1500);
      expect(rule.dayOfMonth).toBe(10);
      expect(rule.startMonth).toBe('2026-08');
      expect(rule.isArchived).toBe(false);

      const activeRules = await repo.getRecurringRules();
      expect(activeRules.some((r) => r.id === rule.id)).toBe(true);

      // Archive rule
      await repo.archiveRecurringRule(rule.id, true);
      const afterArchive = await repo.getRecurringRules();
      expect(afterArchive.some((r) => r.id === rule.id)).toBe(false);

      const allRules = await repo.getRecurringRules(true);
      expect(allRules.some((r) => r.id === rule.id && r.isArchived)).toBe(true);

      // Restore rule
      await repo.archiveRecurringRule(rule.id, false);
      const afterRestore = await repo.getRecurringRules();
      expect(afterRestore.some((r) => r.id === rule.id && !r.isArchived)).toBe(true);
    });

    it('processes due recurring rules idempotently without duplicating entries', async () => {
      const db = new FamilyAccountsDB('test-recurring-2');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const item = (await repo.getItems())[0];
      const wallet = (await repo.getWallets())[0];

      const rule = await repo.createRecurringRule({
        type: 'expense',
        amount: 2000,
        dayOfMonth: 5,
        startMonth: '2026-08',
        accountId: wallet.id,
        itemId: item.id,
        note: 'Gym subscription',
      });

      // On 2026-10-12: months 2026-08, 2026-09, 2026-10 are due (since day 5 has passed)
      const createdCount = await repo.processDueRecurringRules('2026-10-12');
      expect(createdCount).toBe(3);

      const entries = await repo.listEntries();
      const ruleEntries = entries.filter((e) => e.recurringRuleId === rule.id);
      expect(ruleEntries).toHaveLength(3);
      expect(ruleEntries.map((e) => e.recurringMonth).sort()).toEqual(['2026-08', '2026-09', '2026-10']);
      expect(ruleEntries.map((e) => e.occurredOn).sort()).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);

      // Calling processDueRecurringRules again creates 0 duplicates
      const secondRun = await repo.processDueRecurringRules('2026-10-12');
      expect(secondRun).toBe(0);
      expect(await repo.listEntries()).toHaveLength(entries.length);
    });

    it('respects end-of-month clamping for shorter months (Feb 28/29, Apr 30)', async () => {
      const db = new FamilyAccountsDB('test-recurring-3');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const item = (await repo.getItems())[0];
      const wallet = (await repo.getWallets())[0];

      const rule = await repo.createRecurringRule({
        type: 'expense',
        amount: 800,
        dayOfMonth: 31,
        startMonth: '2026-02',
        accountId: wallet.id,
        itemId: item.id,
      });

      // In 2026-02 (28 days), should clamp to 2026-02-28
      await repo.processDueRecurringRules('2026-03-01');
      const entries = await repo.listEntries();
      const febEntry = entries.find((e) => e.recurringRuleId === rule.id && e.recurringMonth === '2026-02');
      expect(febEntry).toBeDefined();
      expect(febEntry?.occurredOn).toBe('2026-02-28');
    });

    it('editing or deleting a generated recurring entry does not alter the rule or duplicate', async () => {
      const db = new FamilyAccountsDB('test-recurring-4');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const item = (await repo.getItems())[0];
      const wallet = (await repo.getWallets())[0];

      const rule = await repo.createRecurringRule({
        type: 'expense',
        amount: 1000,
        dayOfMonth: 1,
        startMonth: '2026-10',
        accountId: wallet.id,
        itemId: item.id,
      });

      await repo.processDueRecurringRules('2026-10-12');
      const entries = await repo.listEntries();
      const generated = entries.find((e) => e.recurringRuleId === rule.id);
      expect(generated).toBeDefined();

      // Edit entry amount
      await repo.updateEntry(generated!.id, { amount: 1200 });
      const updated = await repo.getEntry(generated!.id);
      expect(updated?.amount).toBe(1200);

      // Rule remains unchanged
      const ruleAfter = await repo.getRecurringRule(rule.id);
      expect(ruleAfter?.amount).toBe(1000);

      // Soft-delete entry
      await repo.softDeleteEntry(generated!.id);
      expect((await repo.getEntry(generated!.id))?.deletedAt).not.toBeNull();
      expect((await repo.listEntries()).some((e) => e.id === generated!.id)).toBe(false);

      // processDueRecurringRules must not re-create the deleted month
      const rerun = await repo.processDueRecurringRules('2026-10-12');
      expect(rerun).toBe(0);
    });

    it('weekly rule: one entry per due day, the first saved entry is never repeated', async () => {
      const db = new FamilyAccountsDB('test-recurring-5');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const item = (await repo.getItems())[0];
      const wallet = (await repo.getWallets())[0];

      // 2026-10-05 is a Monday; Mondays and Thursdays
      const rule = await repo.createRecurringRule({
        type: 'expense',
        amount: 200,
        startDate: '2026-10-05',
        frequency: 'weekly',
        daysOfWeek: [4, 1, 1],
        accountId: wallet.id,
        itemId: item.id,
      });
      expect(rule.frequency).toBe('weekly');
      expect(rule.daysOfWeek).toEqual([1, 4]);
      expect(rule.startDate).toBe('2026-10-05');
      expect(rule.startMonth).toBe('2026-10');

      // The entry sheet saves the first entry itself
      await repo.addEntry({
        type: 'expense',
        amount: 200,
        occurredOn: '2026-10-05',
        accountId: wallet.id,
        itemId: item.id,
        recurringRuleId: rule.id,
        recurringMonth: '2026-10',
        recurringDate: '2026-10-05',
      });

      expect(await repo.processDueRecurringRules('2026-10-12')).toBe(2);
      const dates = (await repo.listEntries())
        .filter((e) => e.recurringRuleId === rule.id)
        .map((e) => e.recurringDate)
        .sort();
      expect(dates).toEqual(['2026-10-05', '2026-10-08', '2026-10-12']);
      expect(await repo.processDueRecurringRules('2026-10-12')).toBe(0);
    });

    it('a rule stops creating entries after its end date', async () => {
      const db = new FamilyAccountsDB('test-recurring-6');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const item = (await repo.getItems())[0];
      const wallet = (await repo.getWallets())[0];

      const rule = await repo.createRecurringRule({
        type: 'expense',
        amount: 50,
        startDate: '2026-10-01',
        frequency: 'daily',
        interval: 2,
        endDate: '2026-10-05',
        accountId: wallet.id,
        itemId: item.id,
      });

      expect(await repo.processDueRecurringRules('2026-10-12')).toBe(3);
      const dates = (await repo.listEntries())
        .filter((e) => e.recurringRuleId === rule.id)
        .map((e) => e.occurredOn)
        .sort();
      expect(dates).toEqual(['2026-10-01', '2026-10-03', '2026-10-05']);

      await expect(
        repo.createRecurringRule({
          type: 'expense',
          amount: 50,
          startDate: '2026-10-10',
          endDate: '2026-10-01',
          accountId: wallet.id,
          itemId: item.id,
        })
      ).rejects.toThrow();
    });

    it('entries made before custom schedules (month only) are not created a second time', async () => {
      const db = new FamilyAccountsDB('test-recurring-7');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const item = (await repo.getItems())[0];
      const wallet = (await repo.getWallets())[0];

      const rule = await repo.createRecurringRule({
        type: 'expense',
        amount: 900,
        dayOfMonth: 10,
        startMonth: '2026-09',
        accountId: wallet.id,
        itemId: item.id,
      });
      // As the previous version saved it: a month, no due date
      await repo.addEntry({
        type: 'expense',
        amount: 900,
        occurredOn: '2026-09-10',
        accountId: wallet.id,
        itemId: item.id,
        recurringRuleId: rule.id,
        recurringMonth: '2026-09',
      });

      expect(await repo.processDueRecurringRules('2026-10-12')).toBe(1);
      const months = (await repo.listEntries()).filter((e) => e.recurringRuleId === rule.id).map((e) => e.occurredOn).sort();
      expect(months).toEqual(['2026-09-10', '2026-10-10']);
    });

    it('creates and updates recurring rule subscription flag', async () => {
      const db = new FamilyAccountsDB('test-recurring-sub-1');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();
      const item = (await repo.getItems())[0];
      const wallet = (await repo.getWallets())[0];
      const sub = await repo.createRecurringRule({
        type: 'expense',
        amount: 250,
        startDate: '2026-10-01',
        frequency: 'monthly',
        accountId: wallet.id,
        itemId: item.id,
        isSubscription: true,
        note: 'Netflix 4K',
      });
      expect(sub.isSubscription).toBe(true);
      const rules = await repo.getRecurringRules();
      const found = rules.find((r) => r.id === sub.id);
      expect(found?.isSubscription).toBe(true);
      const updated = await repo.updateRecurringRule(sub.id, { isSubscription: false });
      expect(updated.isSubscription).toBe(false);
    });

    it('creates, enriches, archives, and tracks savings goals funded via wallet transfers', async () => {
      const db = new FamilyAccountsDB('test-savings-goals-1');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      // Create a dedicated wallet for the goal
      const wallet = await repo.addWallet({
        nameEn: 'Hajj Fund',
        nameAr: 'صندوق الحج',
        type: 'bank',
        openingBalance: 5000,
      });

      // Create savings goal
      const goal = await repo.createSavingsGoal({
        nameEn: 'Hajj 2027',
        nameAr: 'حج 2027',
        targetAmount: 50000,
        targetDate: '2027-05-01',
        icon: 'sparkles',
        walletId: wallet.id,
      });

      expect(goal.nameEn).toBe('Hajj 2027');
      expect(goal.targetAmount).toBe(50000);
      expect(goal.walletId).toBe(wallet.id);
      expect(goal.isArchived).toBe(false);

      // Verify enriched savings goal
      let goals = await repo.getSavingsGoals();
      let enriched = goals.find((g) => g.id === goal.id);
      expect(enriched).toBeDefined();
      expect(enriched?.currentAmount).toBe(5000);
      expect(enriched?.percent).toBe(10);
      expect(enriched?.barPercent).toBe(10);
      expect(enriched?.remaining).toBe(45000);
      expect(enriched?.isReached).toBe(false);
      expect(enriched?.walletNameEn).toBe('Hajj Fund');

      // Add a transfer of 45,000 from cash into this wallet
      const cashWallet = (await repo.getWallets()).find((w) => w.type === 'cash')!;
      await repo.addEntry({
        type: 'transfer',
        amount: 45000,
        occurredOn: '2026-10-12',
        accountId: cashWallet.id,
        toAccountId: wallet.id,
        note: 'Saved for Hajj',
      });

      // Check updated goal progress - now 50,000 / 50,000 (100% reached)
      goals = await repo.getSavingsGoals();
      enriched = goals.find((g) => g.id === goal.id);
      expect(enriched?.currentAmount).toBe(50000);
      expect(enriched?.percent).toBe(100);
      expect(enriched?.remaining).toBe(0);
      expect(enriched?.isReached).toBe(true);

      // Archive goal
      await repo.archiveSavingsGoal(goal.id, true);
      const afterArchive = await repo.getSavingsGoals();
      expect(afterArchive.some((g) => g.id === goal.id)).toBe(false);

      const allGoals = await repo.getSavingsGoals(true);
      expect(allGoals.some((g) => g.id === goal.id && g.isArchived)).toBe(true);

      // Restore goal
      await repo.archiveSavingsGoal(goal.id, false);
      const afterRestore = await repo.getSavingsGoals();
      expect(afterRestore.some((g) => g.id === goal.id && !g.isArchived)).toBe(true);
    });
  });

  describe('household currencies (M3)', () => {
    it('sets valid 1 or 2 currencies for household', async () => {
      let household = await repo.getHousehold();
      expect(household?.currencies).toEqual(['EGP']);

      await repo.setHouseholdCurrencies(['EGP', 'USD']);
      household = await repo.getHousehold();
      expect(household?.currencies).toEqual(['EGP', 'USD']);
      expect(household?.currency).toBe('EGP');

      // Change order / main currency (as long as wallets still covered)
      await repo.setHouseholdCurrencies(['USD', 'EGP']);
      household = await repo.getHousehold();
      expect(household?.currencies).toEqual(['USD', 'EGP']);
      expect(household?.currency).toBe('USD');
    });

    it('rejects empty, duplicate, invalid codes, or more than 2 currencies', async () => {
      await expect(repo.setHouseholdCurrencies([])).rejects.toThrow('Choose one or two currencies');
      await expect(repo.setHouseholdCurrencies(['EGP', 'USD', 'EUR'])).rejects.toThrow('Choose one or two currencies');
      await expect(repo.setHouseholdCurrencies(['EGP', 'EGP'])).rejects.toThrow('Choose one or two currencies');
      await expect(repo.setHouseholdCurrencies(['EG'])).rejects.toThrow('Choose one or two currencies');
      await expect(repo.setHouseholdCurrencies(['123'])).rejects.toThrow('Choose one or two currencies');
    });

    it('refuses to remove a currency that a wallet still uses', async () => {
      // Seeded wallets are all in EGP
      await expect(repo.setHouseholdCurrencies(['USD'])).rejects.toThrow(
        'A wallet still uses a currency you removed'
      );

      // Adding USD and creating a USD wallet
      await repo.setHouseholdCurrencies(['EGP', 'USD']);
      const usdWallet = await repo.addWallet({
        nameEn: 'USD Account',
        type: 'bank',
        currency: 'USD',
      });
      expect(usdWallet.currency).toBe('USD');

      // Trying to set only EGP should fail because USD wallet exists
      await expect(repo.setHouseholdCurrencies(['EGP'])).rejects.toThrow(
        'A wallet still uses a currency you removed'
      );
    });

    it('converts household currency and all balances, transactions, and goals', async () => {
      const db = new FamilyAccountsDB('test-convert-cur');
      const testRepo = new MockRepository(db);
      await testRepo.ensureSeeded();

      // Convert from EGP to USD at rate 0.02 (50 EGP = 1 USD)
      await testRepo.convertHouseholdCurrency('USD', 0.02);

      const household = await testRepo.getHousehold();
      expect(household?.currency).toBe('USD');
      expect(household?.currencies).toEqual(['USD']);

      const wallets = await testRepo.getWallets(true);
      expect(wallets.every((w) => w.currency === 'USD')).toBe(true);

      const entries = await testRepo.listEntries({ limit: 50 });
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        expect(Number.isFinite(e.amount)).toBe(true);
      }
    });
  });

  describe('investments (M1)', () => {
    it('rejects adding an investment wallet without investmentKind', async () => {
      const db = new FamilyAccountsDB('test-inv-1');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      await expect(
        repo.addWallet({
          nameEn: 'My Gold',
          type: 'wallet',
          purpose: 'investment',
        })
      ).rejects.toThrow('Investment account must have an investmentKind');
    });

    it('creates an investment wallet with kind and manages values', async () => {
      const db = new FamilyAccountsDB('test-inv-2');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const inv = await repo.addWallet({
        nameEn: 'Gold 24k',
        type: 'wallet',
        purpose: 'investment',
        investmentKind: 'gold',
        openingBalance: 80000,
      });

      expect(inv.purpose).toBe('investment');
      expect(inv.investmentKind).toBe('gold');

      let list = await repo.getInvestments();
      const created = list.find((i) => i.id === inv.id);
      expect(created).toBeDefined();
      expect(created?.putIn).toBe(80000);
      expect(created?.worth).toBe(80000);
      expect(created?.gain).toBe(0);

      // Add a value update
      const val = await repo.addInvestmentValue({
        accountId: inv.id,
        value: 96000,
        valuedOn: '2026-10-10',
      });
      expect(val.value).toBe(96000);

      list = await repo.getInvestments();
      const updated = list.find((i) => i.id === inv.id);
      expect(updated?.worth).toBe(96000);
      expect(updated?.gain).toBe(16000);
      expect(updated?.lastValuedOn).toBe('2026-10-10');

      const values = await repo.getInvestmentValues(inv.id);
      expect(values.length).toBe(1);
      expect(values[0].id).toBe(val.id);

      // Correct the value: same row, new amount
      const corrected = await repo.updateInvestmentValue(val.id, 90000);
      expect(corrected.id).toBe(val.id);
      expect(corrected.value).toBe(90000);
      expect(corrected.valuedOn).toBe('2026-10-10');
      list = await repo.getInvestments();
      expect(list.find((i) => i.id === inv.id)?.worth).toBe(90000);
      expect((await repo.getInvestmentValues(inv.id)).length).toBe(1);
      await expect(repo.updateInvestmentValue(val.id, -1)).rejects.toThrow(
        'Investment value cannot be negative'
      );

      // Soft delete value
      await repo.softDeleteInvestmentValue(val.id);
      const afterDelete = await repo.getInvestmentValues(inv.id);
      expect(afterDelete.length).toBe(0);

      // Undo brings it back
      await repo.restoreInvestmentValue(val.id);
      list = await repo.getInvestments();
      expect(list.find((i) => i.id === inv.id)?.worth).toBe(90000);
      await repo.softDeleteInvestmentValue(val.id);

      list = await repo.getInvestments();
      const reverted = list.find((i) => i.id === inv.id);
      expect(reverted?.worth).toBe(80000);
      expect(reverted?.gain).toBe(0);
    });

    it('rejects negative investment values', async () => {
      const db = new FamilyAccountsDB('test-inv-3');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const inv = await repo.addWallet({
        nameEn: 'Gold 21k',
        type: 'wallet',
        purpose: 'investment',
        investmentKind: 'gold',
      });

      await expect(
        repo.addInvestmentValue({
          accountId: inv.id,
          value: -100,
        })
      ).rejects.toThrow('Investment value cannot be negative');
    });
  });

  describe('investments by quantity and unit price (M6)', () => {
    it('adds gold by grams (both paths)', async () => {
      const db = new FamilyAccountsDB('test-m6-add-gold');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      // Path 1: I already had it
      const gold1 = await repo.addWallet({
        nameEn: 'Gold Ingot',
        type: 'wallet',
        purpose: 'investment',
        investmentKind: 'gold',
        unit: 'gram',
        karat: 21,
        openingQuantity: 10,
        openingBalance: 48000,
      });
      // Initial price row created
      await repo.addInvestmentPrice({
        accountId: gold1.id,
        unitPrice: 4800,
      });

      let invs = await repo.getInvestments();
      const item1 = invs.find((i) => i.id === gold1.id);
      expect(item1).toBeDefined();
      expect(item1?.unit).toBe('gram');
      expect(item1?.karat).toBe(21);
      expect(item1?.quantity).toBe(10);
      expect(item1?.unitPrice).toBe(4800);
      expect(item1?.putIn).toBe(48000);
      expect(item1?.worth).toBe(48000);

      // Path 2: Paid from a wallet (Cash)
      const gold2 = await repo.addWallet({
        nameEn: 'Gold Ring',
        type: 'wallet',
        purpose: 'investment',
        investmentKind: 'gold',
        unit: 'gram',
        karat: 18,
        openingQuantity: 0,
        openingBalance: 0,
      });
      // Transfer from cash
      await repo.addEntry({
        type: 'transfer',
        amount: 20000,
        quantity: 5,
        accountId: WALLET_CASH_ID,
        toAccountId: gold2.id,
        occurredOn: '2026-10-13',
      });
      await repo.addInvestmentPrice({
        accountId: gold2.id,
        unitPrice: 4000,
      });

      invs = await repo.getInvestments();
      const item2 = invs.find((i) => i.id === gold2.id);
      expect(item2).toBeDefined();
      expect(item2?.unit).toBe('gram');
      expect(item2?.karat).toBe(18);
      expect(item2?.quantity).toBe(5);
      expect(item2?.unitPrice).toBe(4000);
      expect(item2?.putIn).toBe(20000);
      expect(item2?.worth).toBe(20000);
    });

    it('addInvestmentPrice updates two same-karat golds and not an 18k one, not a different currency, not an archived one', async () => {
      const db = new FamilyAccountsDB('test-m6-cascade');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();
      await repo.setHouseholdCurrencies(['EGP', 'USD']);

      // Seeded contains Sample Gold (21k, 20g, EGP) and Gold coins (21k, 8g, EGP)
      // Create an 18k gold (EGP)
      const gold18k = await repo.addWallet({
        nameEn: 'Gold 18k',
        type: 'wallet',
        purpose: 'investment',
        investmentKind: 'gold',
        unit: 'gram',
        karat: 18,
        openingQuantity: 10,
        openingBalance: 35000,
      });
      await repo.addInvestmentPrice({ accountId: gold18k.id, unitPrice: 3500 });

      // Create a 21k gold in USD
      const goldUsd = await repo.addWallet({
        nameEn: 'Gold USD',
        type: 'wallet',
        purpose: 'investment',
        investmentKind: 'gold',
        unit: 'gram',
        karat: 21,
        currency: 'USD',
        openingQuantity: 5,
        openingBalance: 500,
      });
      await repo.addInvestmentPrice({ accountId: goldUsd.id, unitPrice: 100 });

      // Create an archived 21k gold
      const goldArchived = await repo.addWallet({
        nameEn: 'Old Gold',
        type: 'wallet',
        purpose: 'investment',
        investmentKind: 'gold',
        unit: 'gram',
        karat: 21,
        openingQuantity: 4,
        openingBalance: 16000,
      });
      await repo.archiveWallet(goldArchived.id, true);

      // Now update price of Sample Gold to 5,000
      const sampleGold = (await repo.getInvestments()).find((i) => i.nameEn === 'Gold')!;
      const writtenRows = await repo.addInvestmentPrice({
        accountId: sampleGold.id,
        unitPrice: 5000,
      });

      // Should have written 2 rows: Sample Gold (20g) & Gold coins (8g)
      expect(writtenRows).toHaveLength(2);
      const updatedAccountIds = writtenRows.map((r) => r.accountId);
      expect(updatedAccountIds).toContain(sampleGold.id);

      const goldCoins = (await repo.getInvestments()).find((i) => i.nameEn === 'Gold coins')!;
      expect(updatedAccountIds).toContain(goldCoins.id);

      // Verify worths
      const invs = await repo.getInvestments();
      const updatedSample = invs.find((i) => i.id === sampleGold.id)!;
      const updatedCoins = invs.find((i) => i.id === goldCoins.id)!;
      const untouched18k = invs.find((i) => i.id === gold18k.id)!;
      const untouchedUsd = invs.find((i) => i.id === goldUsd.id)!;

      expect(updatedSample.worth).toBe(100000); // 20 * 5000
      expect(updatedSample.unitPrice).toBe(5000);
      expect(updatedCoins.worth).toBe(40000); // 8 * 5000
      expect(updatedCoins.unitPrice).toBe(5000);

      expect(untouched18k.unitPrice).toBe(3500);
      expect(untouched18k.worth).toBe(35000);
      expect(untouchedUsd.unitPrice).toBe(100);
      expect(untouchedUsd.worth).toBe(500);

      // Archived wallet should not have received a new price row
      const archivedValues = await repo.getInvestmentValues(goldArchived.id);
      expect(archivedValues).toHaveLength(0);
    });

    it('undo of every returned row restores both', async () => {
      const db = new FamilyAccountsDB('test-m6-undo');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const sampleGold = (await repo.getInvestments()).find((i) => i.nameEn === 'Gold')!;
      const goldCoins = (await repo.getInvestments()).find((i) => i.nameEn === 'Gold coins')!;

      expect(sampleGold.worth).toBe(96000);
      expect(goldCoins.worth).toBe(38400);

      const writtenRows = await repo.addInvestmentPrice({
        accountId: sampleGold.id,
        unitPrice: 5000,
      });
      expect(writtenRows).toHaveLength(2);

      let invs = await repo.getInvestments();
      expect(invs.find((i) => i.id === sampleGold.id)?.worth).toBe(100000);
      expect(invs.find((i) => i.id === goldCoins.id)?.worth).toBe(40000);

      // Undo: soft-delete every returned row
      for (const row of writtenRows) {
        await repo.softDeleteInvestmentValue(row.id);
      }

      invs = await repo.getInvestments();
      expect(invs.find((i) => i.id === sampleGold.id)?.worth).toBe(96000);
      expect(invs.find((i) => i.id === goldCoins.id)?.worth).toBe(38400);
    });

    it('updateInvestmentPrice recomputes value for single row without cascading', async () => {
      const db = new FamilyAccountsDB('test-m6-update-price');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const sampleGold = (await repo.getInvestments()).find((i) => i.nameEn === 'Gold')!;
      const goldCoins = (await repo.getInvestments()).find((i) => i.nameEn === 'Gold coins')!;

      const sampleValues = await repo.getInvestmentValues(sampleGold.id);
      const rowToEdit = sampleValues[0];

      const updated = await repo.updateInvestmentPrice(rowToEdit.id, 5000);
      expect(updated.id).toBe(rowToEdit.id);
      expect(updated.unitPrice).toBe(5000);
      expect(updated.value).toBe(100000); // 20g * 5000

      const invs = await repo.getInvestments();
      expect(invs.find((i) => i.id === sampleGold.id)?.worth).toBe(100000);
      // Gold coins must remain untouched (38,400)
      expect(invs.find((i) => i.id === goldCoins.id)?.worth).toBe(38400);
    });

    it('trackByQuantity keeps worth intact', async () => {
      const db = new FamilyAccountsDB('test-m6-track');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      // Create gold with unit null
      const plainGold = await repo.addWallet({
        nameEn: 'Old Gold Holding',
        type: 'wallet',
        purpose: 'investment',
        investmentKind: 'gold',
        openingBalance: 50000,
      });

      let inv = (await repo.getInvestments()).find((i) => i.id === plainGold.id)!;
      expect(inv.unit).toBeNull();
      expect(inv.worth).toBe(50000);

      // Track by weight: 10 grams, 21k
      await repo.trackByQuantity(plainGold.id, { quantity: 10, karat: 21 });

      inv = (await repo.getInvestments()).find((i) => i.id === plainGold.id)!;
      expect(inv.unit).toBe('gram');
      expect(inv.karat).toBe(21);
      expect(inv.quantity).toBe(10);
      expect(inv.unitPrice).toBe(5000); // 50000 / 10
      expect(inv.worth).toBe(50000); // exactly unchanged
    });

    it('transfer quantity survives update', async () => {
      const db = new FamilyAccountsDB('test-m6-tx-quantity');
      const repo = new MockRepository(db);
      await repo.ensureSeeded();

      const sampleGold = (await repo.getInvestments()).find((i) => i.nameEn === 'Gold')!;
      const entry = await repo.addEntry({
        type: 'transfer',
        amount: 24000,
        quantity: 5,
        accountId: WALLET_CASH_ID,
        toAccountId: sampleGold.id,
        occurredOn: '2026-10-13',
        note: 'Bought 5g',
      });
      expect(entry.quantity).toBe(5);

      const updated = await repo.updateEntry(entry.id, {
        note: 'Bought 5g gold ingot',
        amount: 24500,
      });
      expect(updated.amount).toBe(24500);
      expect(updated.quantity).toBe(5);

      const fetched = await repo.getEntry(entry.id);
      expect(fetched?.amount).toBe(24500);
      expect(fetched?.quantity).toBe(5);
    });
  });
});


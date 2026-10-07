// =========================================================
// Mock Repository  ·  Family Accounts (حساباتنا)
// In-browser Dexie repository seeded with realistic sample data
// Implements the Repository interface for Phase A
// =========================================================

import { localISODate } from '../format';
import { db as defaultDb, FamilyAccountsDB } from '../offline/db';
import {
  roundMoney,
  toBudget,
  toCategory,
  toEntry,
  toHousehold,
  toItem,
  toMember,
  toSubcategory,
  toWallet,
} from './mappers';
import {
  DEFAULT_HOUSEHOLD,
  DEFAULT_MEMBERS,
  DEFAULT_WALLETS,
  DEMO_HOUSEHOLD_ID,
  generateRealisticEntries,
  getFlattenedCategoryTree,
  ITEM_EXPENSE_BALANCE_CORRECTION_ID,
  ITEM_INCOME_BALANCE_CORRECTION_ID,
  SEED_VERSION,
  USER_MAMA_ID,
} from './mock-seed';
import type {
  CreateBudgetInput,
  CreateCategoryInput,
  CreateEntryInput,
  CreateItemInput,
  CreateSubcategoryInput,
  CreateWalletInput,
  ListEntriesParams,
  Repository,
  UpdateBudgetInput,
  UpdateCategoryInput,
  UpdateEntryInput,
  UpdateItemInput,
  UpdateSubcategoryInput,
  UpdateWalletInput,
} from './repository';
import type {
  AccountRow,
  Budget,
  BudgetRow,
  Category,
  CategoryKind,
  CategoryLevel,
  CategoryRow,
  CategoryTotal,
  EnrichedEntry,
  Entry,
  Household,
  HouseholdMemberRow,
  Item,
  ItemRow,
  Member,
  MonthSummary,
  PivotEntry,
  PivotPeriod,
  RecentItem,
  Subcategory,
  SubcategoryRow,
  SyncStatus,
  TransactionRow,
  Wallet,
  WalletBalance,
} from './types';

export function getIsoWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export class MockRepository implements Repository {
  private static seedPromises = new WeakMap<FamilyAccountsDB, Promise<void>>();
  private db: FamilyAccountsDB;
  private seedPromise: Promise<void> | null = null;
  /**
   * Who is "signed in" on this phone in sample mode. New entries and edits are stamped with it,
   * the way the database stamps auth.uid() in live mode (set_txn_audit). Defaults to the owner.
   */
  currentUserId: string;

  constructor(customDb?: FamilyAccountsDB, currentUserId: string = USER_MAMA_ID) {
    this.db = customDb ?? defaultDb;
    this.currentUserId = currentUserId;
  }

  // Ensures database is seeded on first access (idempotent, StrictMode-safe via shared promise)
  async ensureSeeded(): Promise<void> {
    if (typeof window === 'undefined' && typeof indexedDB === 'undefined') {
      return;
    }

    let promise = MockRepository.seedPromises.get(this.db) ?? this.seedPromise;
    if (promise) {
      return promise;
    }

    promise = (async () => {
      try {
        const seeded = await this.db.meta.get('seeded');
        const seedVersion = await this.db.meta.get('seedVersion');
        // A store marked as seeded but holding no entries at all (not even deleted ones) lost its sample
        // entries somehow; reload the samples instead of showing an empty app forever.
        const hasEntries = (await this.db.transactions.count()) > 0;
        if (
          seeded &&
          seeded.value === true &&
          seedVersion &&
          seedVersion.value === SEED_VERSION &&
          hasEntries
        ) {
          await this.renameArabicSampleMembers();
          await this.backfillMissingCreators();
          await this.seedSampleBudgets();
          return;
        }

        await this.seed();
      } catch (err) {
        MockRepository.seedPromises.delete(this.db);
        this.seedPromise = null;
        throw err;
      }
    })();

    MockRepository.seedPromises.set(this.db, promise);
    this.seedPromise = promise;
    return promise;
  }

  // Seeds database with default household, wallets, categories, and sample entries
  async seed(): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.households,
        this.db.household_members,
        this.db.accounts,
        this.db.categories,
        this.db.subcategories,
        this.db.items,
        this.db.transactions,
        this.db.photos,
        this.db.meta,
      ],
      async () => {
        // Clear existing tables
        await Promise.all([
          this.db.households.clear(),
          this.db.household_members.clear(),
          this.db.accounts.clear(),
          this.db.categories.clear(),
          this.db.subcategories.clear(),
          this.db.items.clear(),
          this.db.transactions.clear(),
          this.db.photos.clear(),
        ]);

        // Insert household and members
        await this.db.households.put(DEFAULT_HOUSEHOLD);
        await this.db.household_members.bulkPut(DEFAULT_MEMBERS);

        // Insert wallets
        await this.db.accounts.bulkPut(DEFAULT_WALLETS);

        // Insert categories, subcategories, items
        const tree = getFlattenedCategoryTree(DEMO_HOUSEHOLD_ID);
        await this.db.categories.bulkPut(tree.categories);
        await this.db.subcategories.bulkPut(tree.subcategories);
        await this.db.items.bulkPut(tree.items);

        // Insert realistic entries
        const entries = generateRealisticEntries(new Date(), DEMO_HOUSEHOLD_ID);
        await this.db.transactions.bulkPut(entries);

        // Set metadata
        await this.db.meta.put({ key: 'seeded', value: true });
        await this.db.meta.put({ key: 'seedVersion', value: SEED_VERSION });
        await this.db.meta.put({ key: 'lastSyncedAt', value: new Date().toISOString() });
      }
    );
    await this.db.budgets.clear();
    await this.db.meta.delete('budgetsSeeded');
    await this.seedSampleBudgets();
  }

  // Sample budgets (once per phone, so existing practice entries are kept): the three biggest expense
  // categories, each set a little above its usual month
  // (average of the last 3 full months, rounded up to 500).
  private async seedSampleBudgets(): Promise<void> {
    if ((await this.db.meta.get('budgetsSeeded'))?.value === true) return;
    const now = new Date();
    const thisMonth = localISODate(now).slice(0, 7);
    const months = new Set<string>();
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.add(localISODate(d).slice(0, 7));
    }
    const rows = await this.listEntries({ type: 'expense' });
    const byCategory = new Map<string, number>();
    for (const e of rows) {
      const m = e.occurredOn.slice(0, 7);
      if (!months.has(m) || m === thisMonth || !e.categoryId) continue;
      if (e.itemId === ITEM_EXPENSE_BALANCE_CORRECTION_ID) continue;
      byCategory.set(e.categoryId, (byCategory.get(e.categoryId) ?? 0) + e.amount);
    }
    const roundUp = (monthly: number) => Math.max(500, Math.ceil((monthly * 1.05) / 500) * 500);
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [categoryId, total] of top) {
      await this.addBudget({ categoryId, amount: roundUp(total / months.size) });
    }
    await this.db.meta.put({ key: 'budgetsSeeded', value: true });
  }

  // Sample members were first seeded as ماما / بابا. Names are now English: rename them in place
  // (only those exact defaults), so phones keep their practice entries.
  // Entries added before who-added-it was recorded (2026-10-06) have no creator, so they showed
  // no initial. In sample mode the phone's user is the owner, so they get the current member.
  private async backfillMissingCreators(): Promise<void> {
    const missing = await this.db.transactions.filter((t) => !t.created_by).toArray();
    for (const row of missing) {
      await this.db.transactions.update(row.id, {
        created_by: this.currentUserId,
        updated_by: row.updated_by ?? this.currentUserId,
      });
    }
  }

  private async renameArabicSampleMembers(): Promise<void> {
    const renames: Record<string, string> = { 'ماما': 'Mama', 'بابا': 'Baba' };
    const rows = await this.db.household_members.toArray();
    for (const row of rows) {
      const english = renames[row.display_name];
      if (english) {
        await this.db.household_members.update([row.household_id, row.user_id], { display_name: english });
      }
    }
  }

  // Resets the mock database
  async reset(): Promise<void> {
    MockRepository.seedPromises.delete(this.db);
    this.seedPromise = null;
    await this.seed();
  }

  // ---------- Household & Members ----------

  async getHousehold(): Promise<Household | null> {
    const row = await this.db.households.get(DEMO_HOUSEHOLD_ID);
    return row ? toHousehold(row) : null;
  }

  async getMembers(): Promise<Member[]> {
    const rows = await this.db.household_members.toArray();
    return rows.map(toMember);
  }

  // ---------- Wallets (Accounts) ----------

  async getWallets(includeArchived = false): Promise<Wallet[]> {
    let rows = await this.db.accounts.toArray();
    if (!includeArchived) {
      rows = rows.filter((w) => !w.is_archived);
    }
    rows.sort((a, b) => a.sort_order - b.sort_order);
    return rows.map(toWallet);
  }

  async getWallet(id: string): Promise<Wallet | null> {
    const row = await this.db.accounts.get(id);
    return row ? toWallet(row) : null;
  }

  async addWallet(input: CreateWalletInput): Promise<Wallet> {
    await this.ensureSeeded();
    const now = new Date().toISOString();
    const id = input.id ?? crypto.randomUUID();
    const maxOrderRow = await this.db.accounts.orderBy('sort_order').last();
    const sortOrder = input.sortOrder ?? (maxOrderRow ? maxOrderRow.sort_order + 1 : 0);

    const row: AccountRow = {
      id,
      household_id: input.householdId ?? DEMO_HOUSEHOLD_ID,
      name_ar: input.nameAr ?? null,
      name_en: input.nameEn ?? null,
      type: input.type,
      opening_balance: roundMoney(input.openingBalance ?? 0),
      icon: input.icon ?? null,
      color: input.color ?? null,
      sort_order: sortOrder,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    await this.db.accounts.put(row);
    return toWallet(row);
  }

  async updateWallet(id: string, updates: UpdateWalletInput): Promise<Wallet> {
    await this.ensureSeeded();
    const row = await this.db.accounts.get(id);
    if (!row) {
      throw new Error(`Wallet not found: ${id}`);
    }

    const updatedRow: AccountRow = {
      ...row,
      name_ar: updates.nameAr !== undefined ? updates.nameAr : row.name_ar,
      name_en: updates.nameEn !== undefined ? updates.nameEn : row.name_en,
      type: updates.type ?? row.type,
      opening_balance:
        updates.openingBalance !== undefined
          ? roundMoney(updates.openingBalance)
          : row.opening_balance,
      icon: updates.icon !== undefined ? updates.icon : row.icon,
      color: updates.color !== undefined ? updates.color : row.color,
      sort_order: updates.sortOrder !== undefined ? updates.sortOrder : row.sort_order,
      updated_at: new Date().toISOString(),
    };

    await this.db.accounts.put(updatedRow);
    return toWallet(updatedRow);
  }

  async archiveWallet(id: string, archive = true): Promise<void> {
    await this.ensureSeeded();
    await this.db.accounts.update(id, {
      is_archived: archive,
      updated_at: new Date().toISOString(),
    });
  }

  async getWalletBalances(): Promise<WalletBalance[]> {
    return this.walletBalances();
  }

  async walletBalances(): Promise<WalletBalance[]> {
    const wallets = await this.getWallets(true);
    const transactions = await this.db.transactions
      .filter((t) => t.deleted_at === null)
      .toArray();

    return wallets.map((wallet) => {
      let balance = wallet.openingBalance;
      for (const t of transactions) {
        if (t.type === 'income' && t.account_id === wallet.id) {
          balance += Number(t.amount);
        } else if (t.type === 'expense' && t.account_id === wallet.id) {
          balance -= Number(t.amount);
        } else if (t.type === 'transfer') {
          if (t.account_id === wallet.id) {
            balance -= Number(t.amount);
          }
          if (t.to_account_id === wallet.id) {
            balance += Number(t.amount);
          }
        }
      }

      return {
        ...wallet,
        balance: roundMoney(balance),
      };
    });
  }

  private async getCorrectionItemId(kind: 'expense' | 'income'): Promise<string> {
    const defaultId =
      kind === 'expense'
        ? ITEM_EXPENSE_BALANCE_CORRECTION_ID
        : ITEM_INCOME_BALANCE_CORRECTION_ID;
    const item = await this.db.items.get(defaultId);
    if (item) return item.id;

    const cats = await this.db.categories.where('kind').equals(kind).toArray();
    const catIds = new Set(cats.map((c) => c.id));
    const subcats = await this.db.subcategories.filter((s) => catIds.has(s.category_id)).toArray();
    const subcatIds = new Set(subcats.map((s) => s.id));
    const found = await this.db.items
      .filter((i) => subcatIds.has(i.subcategory_id))
      .first();
    if (found) return found.id;

    throw new Error(`Balance correction item not found for kind: ${kind}`);
  }

  async adjustWalletBalance(
    walletId: string,
    actualBalance: number,
    occurredOn?: string
  ): Promise<Entry | null> {
    const balances = await this.walletBalances();
    const wallet = balances.find((w) => w.id === walletId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }

    const currentBalance = wallet.balance;
    const diff = roundMoney(actualBalance - currentBalance);

    if (diff === 0) {
      return null;
    }

    const isIncome = diff > 0;
    const amount = roundMoney(Math.abs(diff));
    const date = occurredOn ?? localISODate();
    const itemId = await this.getCorrectionItemId(isIncome ? 'income' : 'expense');

    return this.addEntry({
      type: isIncome ? 'income' : 'expense',
      amount,
      occurredOn: date,
      accountId: walletId,
      itemId,
      note: isIncome ? 'تصحيح الرصيد (زيادة)' : 'تصحيح الرصيد (عجز)',
    });
  }

  // ---------- Categories ----------

  async getCategories(kind?: CategoryKind, includeArchived = false): Promise<Category[]> {
    let rows = await this.db.categories.toArray();
    if (kind) {
      rows = rows.filter((c) => c.kind === kind);
    }
    if (!includeArchived) {
      rows = rows.filter((c) => !c.is_archived);
    }
    rows.sort((a, b) => a.sort_order - b.sort_order);
    return rows.map(toCategory);
  }

  async getCategory(id: string): Promise<Category | null> {
    const row = await this.db.categories.get(id);
    return row ? toCategory(row) : null;
  }

  async addCategory(input: CreateCategoryInput): Promise<Category> {
    await this.ensureSeeded();
    const now = new Date().toISOString();
    const id = input.id ?? crypto.randomUUID();
    const maxOrderRow = await this.db.categories.orderBy('sort_order').last();
    const sortOrder = input.sortOrder ?? (maxOrderRow ? maxOrderRow.sort_order + 1 : 0);

    const row: CategoryRow = {
      id,
      household_id: input.householdId ?? DEMO_HOUSEHOLD_ID,
      kind: input.kind,
      name_ar: input.nameAr ?? null,
      name_en: input.nameEn ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      sort_order: sortOrder,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    await this.db.categories.put(row);
    return toCategory(row);
  }

  async updateCategory(id: string, updates: UpdateCategoryInput): Promise<Category> {
    await this.ensureSeeded();
    const row = await this.db.categories.get(id);
    if (!row) {
      throw new Error(`Category not found: ${id}`);
    }

    const updatedRow: CategoryRow = {
      ...row,
      name_ar: updates.nameAr !== undefined ? updates.nameAr : row.name_ar,
      name_en: updates.nameEn !== undefined ? updates.nameEn : row.name_en,
      icon: updates.icon !== undefined ? updates.icon : row.icon,
      color: updates.color !== undefined ? updates.color : row.color,
      sort_order: updates.sortOrder !== undefined ? updates.sortOrder : row.sort_order,
      updated_at: new Date().toISOString(),
    };

    await this.db.categories.put(updatedRow);
    return toCategory(updatedRow);
  }

  async archiveCategory(id: string, archive = true): Promise<void> {
    await this.ensureSeeded();
    await this.db.categories.update(id, {
      is_archived: archive,
      updated_at: new Date().toISOString(),
    });
  }

  // ---------- Budgets ----------

  async getBudgets(includeArchived = false): Promise<Budget[]> {
    let rows = await this.db.budgets.toArray();
    if (!includeArchived) {
      rows = rows.filter((b) => !b.is_archived);
    }
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return rows.map(toBudget);
  }

  async addBudget(input: CreateBudgetInput): Promise<Budget> {
    const subcategoryId = input.subcategoryId ?? null;
    const amount = roundMoney(input.amount);
    if (!(amount > 0)) {
      throw new Error('A budget must be more than 0');
    }
    // One active budget per category/group: setting it again updates the amount
    const existing = (await this.db.budgets.where('category_id').equals(input.categoryId).toArray()).find(
      (b) => !b.is_archived && b.subcategory_id === subcategoryId
    );
    if (existing) {
      return this.updateBudget(existing.id, { amount });
    }

    const now = new Date().toISOString();
    const row: BudgetRow = {
      id: input.id ?? crypto.randomUUID(),
      household_id: input.householdId ?? DEMO_HOUSEHOLD_ID,
      category_id: input.categoryId,
      subcategory_id: subcategoryId,
      amount,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };
    await this.db.budgets.put(row);
    return toBudget(row);
  }

  async updateBudget(id: string, updates: UpdateBudgetInput): Promise<Budget> {
    const row = await this.db.budgets.get(id);
    if (!row) {
      throw new Error(`Budget not found: ${id}`);
    }
    const amount = updates.amount !== undefined ? roundMoney(updates.amount) : row.amount;
    if (!(amount > 0)) {
      throw new Error('A budget must be more than 0');
    }
    const updatedRow: BudgetRow = { ...row, amount, updated_at: new Date().toISOString() };
    await this.db.budgets.put(updatedRow);
    return toBudget(updatedRow);
  }

  async archiveBudget(id: string, archive = true): Promise<void> {
    await this.db.budgets.update(id, {
      is_archived: archive,
      updated_at: new Date().toISOString(),
    });
  }

  // ---------- Subcategories ----------

  async getSubcategories(categoryId?: string, includeArchived = false): Promise<Subcategory[]> {
    let rows = await this.db.subcategories.toArray();
    if (categoryId) {
      rows = rows.filter((s) => s.category_id === categoryId);
    }
    if (!includeArchived) {
      rows = rows.filter((s) => !s.is_archived);
    }
    rows.sort((a, b) => a.sort_order - b.sort_order);
    return rows.map(toSubcategory);
  }

  async getSubcategory(id: string): Promise<Subcategory | null> {
    const row = await this.db.subcategories.get(id);
    return row ? toSubcategory(row) : null;
  }

  async addSubcategory(input: CreateSubcategoryInput): Promise<Subcategory> {
    await this.ensureSeeded();
    const now = new Date().toISOString();
    const id = input.id ?? crypto.randomUUID();
    const maxOrderRow = await this.db.subcategories.orderBy('sort_order').last();
    const sortOrder = input.sortOrder ?? (maxOrderRow ? maxOrderRow.sort_order + 1 : 0);

    const row: SubcategoryRow = {
      id,
      household_id: input.householdId ?? DEMO_HOUSEHOLD_ID,
      category_id: input.categoryId,
      name_ar: input.nameAr ?? null,
      name_en: input.nameEn ?? null,
      sort_order: sortOrder,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    await this.db.subcategories.put(row);
    return toSubcategory(row);
  }

  async updateSubcategory(id: string, updates: UpdateSubcategoryInput): Promise<Subcategory> {
    await this.ensureSeeded();
    const row = await this.db.subcategories.get(id);
    if (!row) {
      throw new Error(`Subcategory not found: ${id}`);
    }

    const updatedRow: SubcategoryRow = {
      ...row,
      name_ar: updates.nameAr !== undefined ? updates.nameAr : row.name_ar,
      name_en: updates.nameEn !== undefined ? updates.nameEn : row.name_en,
      sort_order: updates.sortOrder !== undefined ? updates.sortOrder : row.sort_order,
      updated_at: new Date().toISOString(),
    };

    await this.db.subcategories.put(updatedRow);
    return toSubcategory(updatedRow);
  }

  async archiveSubcategory(id: string, archive = true): Promise<void> {
    await this.ensureSeeded();
    await this.db.subcategories.update(id, {
      is_archived: archive,
      updated_at: new Date().toISOString(),
    });
  }

  // ---------- Items ----------

  async getItems(subcategoryId?: string, includeArchived = false): Promise<Item[]> {
    let rows = await this.db.items.toArray();
    if (subcategoryId) {
      rows = rows.filter((i) => i.subcategory_id === subcategoryId);
    }
    if (!includeArchived) {
      rows = rows.filter((i) => !i.is_archived);
    }
    rows.sort((a, b) => a.sort_order - b.sort_order);
    return rows.map(toItem);
  }

  async getItem(id: string): Promise<Item | null> {
    const row = await this.db.items.get(id);
    return row ? toItem(row) : null;
  }

  async addItem(input: CreateItemInput): Promise<Item> {
    await this.ensureSeeded();
    const now = new Date().toISOString();
    const id = input.id ?? crypto.randomUUID();
    const maxOrderRow = await this.db.items.orderBy('sort_order').last();
    const sortOrder = input.sortOrder ?? (maxOrderRow ? maxOrderRow.sort_order + 1 : 0);

    const row: ItemRow = {
      id,
      household_id: input.householdId ?? DEMO_HOUSEHOLD_ID,
      subcategory_id: input.subcategoryId,
      name_ar: input.nameAr ?? null,
      name_en: input.nameEn ?? null,
      sort_order: sortOrder,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    await this.db.items.put(row);
    return toItem(row);
  }

  async updateItem(id: string, updates: UpdateItemInput): Promise<Item> {
    await this.ensureSeeded();
    const row = await this.db.items.get(id);
    if (!row) {
      throw new Error(`Item not found: ${id}`);
    }

    const updatedRow: ItemRow = {
      ...row,
      name_ar: updates.nameAr !== undefined ? updates.nameAr : row.name_ar,
      name_en: updates.nameEn !== undefined ? updates.nameEn : row.name_en,
      sort_order: updates.sortOrder !== undefined ? updates.sortOrder : row.sort_order,
      updated_at: new Date().toISOString(),
    };

    await this.db.items.put(updatedRow);
    return toItem(updatedRow);
  }

  async archiveItem(id: string, archive = true): Promise<void> {
    await this.ensureSeeded();
    await this.db.items.update(id, {
      is_archived: archive,
      updated_at: new Date().toISOString(),
    });
  }

  // ---------- Entries (Transactions) ----------

  private async enrichTransactions(rows: TransactionRow[]): Promise<EnrichedEntry[]> {
    const [accounts, items, subcategories, categories, members] = await Promise.all([
      this.db.accounts.toArray(),
      this.db.items.toArray(),
      this.db.subcategories.toArray(),
      this.db.categories.toArray(),
      this.db.household_members.toArray(),
    ]);

    const accountMap = new Map<string, AccountRow>(accounts.map((a) => [a.id, a]));
    const itemMap = new Map<string, ItemRow>(items.map((i) => [i.id, i]));
    const subMap = new Map<string, SubcategoryRow>(subcategories.map((s) => [s.id, s]));
    const catMap = new Map<string, CategoryRow>(categories.map((c) => [c.id, c]));
    const memberMap = new Map<string, HouseholdMemberRow>(members.map((m) => [m.user_id, m]));

    return rows.map((row) => {
      const entry = toEntry(row);
      const acc = accountMap.get(row.account_id);
      const toAcc = row.to_account_id ? accountMap.get(row.to_account_id) : undefined;
      const item = row.item_id ? itemMap.get(row.item_id) : undefined;
      const sub = item ? subMap.get(item.subcategory_id) : undefined;
      const cat = sub ? catMap.get(sub.category_id) : undefined;
      const creator = row.created_by ? memberMap.get(row.created_by) : undefined;
      const editor = row.updated_by ? memberMap.get(row.updated_by) : undefined;

      return {
        ...entry,
        accountNameAr: acc?.name_ar ?? null,
        accountNameEn: acc?.name_en ?? null,
        toAccountNameAr: toAcc?.name_ar ?? null,
        toAccountNameEn: toAcc?.name_en ?? null,
        itemNameAr: item?.name_ar ?? null,
        itemNameEn: item?.name_en ?? null,
        subcategoryId: sub?.id ?? null,
        subcategoryNameAr: sub?.name_ar ?? null,
        subcategoryNameEn: sub?.name_en ?? null,
        categoryId: cat?.id ?? null,
        categoryNameAr: cat?.name_ar ?? null,
        categoryNameEn: cat?.name_en ?? null,
        categoryIcon: cat?.icon ?? null,
        categoryColor: cat?.color ?? null,
        createdByName: creator?.display_name ?? null,
        updatedByName: editor?.display_name ?? null,
      };
    });
  }

  async listEntries(params?: ListEntriesParams): Promise<EnrichedEntry[]> {
    let rows = await this.db.transactions.toArray();

    // Soft delete filtering
    if (params?.onlyDeleted) {
      rows = rows.filter((r) => r.deleted_at !== null);
    } else if (!params?.includeDeleted) {
      rows = rows.filter((r) => r.deleted_at === null);
    }

    // Month filter: YYYY-MM
    if (params?.month) {
      rows = rows.filter((r) => r.occurred_on.startsWith(params.month!));
    }

    // Date range
    if (params?.startDate) {
      rows = rows.filter((r) => r.occurred_on >= params.startDate!);
    }
    if (params?.endDate) {
      rows = rows.filter((r) => r.occurred_on <= params.endDate!);
    }

    // Account (wallet) filter
    if (params?.accountId) {
      rows = rows.filter(
        (r) => r.account_id === params.accountId || r.to_account_id === params.accountId
      );
    }

    // Type filter
    if (params?.type) {
      rows = rows.filter((r) => r.type === params.type);
    }

    // Item filter
    if (params?.itemId) {
      rows = rows.filter((r) => r.item_id === params.itemId);
    }

    // Enrich rows for category/subcategory or query search
    let enriched = await this.enrichTransactions(rows);

    if (params?.subcategoryId) {
      enriched = enriched.filter((e) => e.subcategoryId === params.subcategoryId);
    }
    if (params?.categoryId) {
      enriched = enriched.filter((e) => e.categoryId === params.categoryId);
    }

    if (params?.searchQuery) {
      const q = params.searchQuery.toLowerCase();
      enriched = enriched.filter(
        (e) =>
          (e.note && e.note.toLowerCase().includes(q)) ||
          (e.itemNameAr && e.itemNameAr.toLowerCase().includes(q)) ||
          (e.itemNameEn && e.itemNameEn.toLowerCase().includes(q)) ||
          (e.categoryNameAr && e.categoryNameAr.toLowerCase().includes(q)) ||
          (e.categoryNameEn && e.categoryNameEn.toLowerCase().includes(q)) ||
          e.amount.toString().includes(q)
      );
    }

    // Sort by occurredOn desc, then createdAt desc
    enriched.sort((a, b) => {
      const dateCmp = b.occurredOn.localeCompare(a.occurredOn);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    });

    // Pagination
    const offset = params?.offset ?? 0;
    const limit = params?.limit !== undefined ? params.limit : enriched.length;
    return enriched.slice(offset, offset + limit);
  }

  async getEntry(id: string): Promise<EnrichedEntry | null> {
    const row = await this.db.transactions.get(id);
    if (!row) return null;
    const enriched = await this.enrichTransactions([row]);
    return enriched[0] ?? null;
  }

  async addEntry(input: CreateEntryInput): Promise<Entry> {
    await this.ensureSeeded();
    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const amount = roundMoney(input.amount);

    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    if (input.type === 'transfer') {
      if (!input.toAccountId) {
        throw new Error('Transfer requires toAccountId');
      }
      if (input.toAccountId === input.accountId) {
        throw new Error('Destination wallet cannot be the same as source wallet');
      }
      if (input.itemId) {
        throw new Error('Transfer cannot have an itemId');
      }
    } else {
      if (!input.itemId) {
        throw new Error(`${input.type} entry requires itemId`);
      }
      if (input.toAccountId) {
        throw new Error(`${input.type} entry cannot have toAccountId`);
      }
    }

    const row: TransactionRow = {
      id,
      household_id: input.householdId ?? DEMO_HOUSEHOLD_ID,
      type: input.type,
      amount,
      occurred_on: input.occurredOn,
      account_id: input.accountId,
      to_account_id: input.type === 'transfer' ? input.toAccountId! : null,
      item_id: input.type === 'transfer' ? null : input.itemId!,
      note: input.note ?? null,
      created_by: input.createdBy ?? this.currentUserId,
      updated_by: input.createdBy ?? this.currentUserId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await this.db.transactions.put(row);
    return toEntry(row);
  }

  async updateEntry(id: string, updates: UpdateEntryInput): Promise<Entry> {
    await this.ensureSeeded();
    const row = await this.db.transactions.get(id);
    if (!row) {
      throw new Error(`Entry not found: ${id}`);
    }

    const nextType = updates.type ?? row.type;
    const nextAmount =
      updates.amount !== undefined ? roundMoney(updates.amount) : Number(row.amount);
    const nextAccountId = updates.accountId ?? row.account_id;
    const nextToAccountId =
      updates.toAccountId !== undefined ? updates.toAccountId : row.to_account_id;
    const nextItemId = updates.itemId !== undefined ? updates.itemId : row.item_id;

    if (nextAmount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    if (nextType === 'transfer') {
      if (!nextToAccountId) {
        throw new Error('Transfer requires toAccountId');
      }
      if (nextToAccountId === nextAccountId) {
        throw new Error('Destination wallet cannot be the same as source wallet');
      }
    } else {
      if (!nextItemId) {
        throw new Error(`${nextType} entry requires itemId`);
      }
    }

    const updatedRow: TransactionRow = {
      ...row,
      type: nextType,
      amount: nextAmount,
      occurred_on: updates.occurredOn ?? row.occurred_on,
      account_id: nextAccountId,
      to_account_id: nextType === 'transfer' ? nextToAccountId : null,
      item_id: nextType === 'transfer' ? null : nextItemId,
      note: updates.note !== undefined ? updates.note : row.note,
      updated_by: updates.updatedBy ?? this.currentUserId,
      updated_at: new Date().toISOString(),
    };

    await this.db.transactions.put(updatedRow);
    return toEntry(updatedRow);
  }

  async softDeleteEntry(id: string): Promise<void> {
    await this.ensureSeeded();
    const now = new Date().toISOString();
    await this.db.transactions.update(id, {
      deleted_at: now,
      updated_at: now,
      updated_by: this.currentUserId,
    });
  }

  async restoreEntry(id: string): Promise<void> {
    await this.ensureSeeded();
    await this.db.transactions.update(id, {
      deleted_at: null,
      updated_at: new Date().toISOString(),
      updated_by: this.currentUserId,
    });
  }

  // ---------- Receipt photos (kept on the phone in mock mode) ----------

  async setEntryPhoto(entryId: string, blob: Blob): Promise<Entry> {
    await this.ensureSeeded();
    const row = await this.db.transactions.get(entryId);
    if (!row) {
      throw new Error(`Entry not found: ${entryId}`);
    }

    const now = new Date().toISOString();
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const updatedRow: TransactionRow = {
      ...row,
      photo_path: `${row.household_id}/${row.id}.${ext}`,
      updated_at: now,
    };

    await this.db.transaction('rw', this.db.transactions, this.db.photos, async () => {
      await this.db.photos.put({ id: entryId, blob, created_at: now });
      await this.db.transactions.put(updatedRow);
    });
    return toEntry(updatedRow);
  }

  async getEntryPhoto(entryId: string): Promise<Blob | null> {
    await this.ensureSeeded();
    const row = await this.db.transactions.get(entryId);
    if (!row?.photo_path) return null;
    const photo = await this.db.photos.get(entryId);
    return photo?.blob ?? null;
  }

  // Only clears the link; the stored photo stays, like everything else nothing is hard-deleted
  async removeEntryPhoto(entryId: string): Promise<Entry> {
    await this.ensureSeeded();
    const row = await this.db.transactions.get(entryId);
    if (!row) {
      throw new Error(`Entry not found: ${entryId}`);
    }

    const updatedRow: TransactionRow = {
      ...row,
      photo_path: null,
      updated_at: new Date().toISOString(),
    };
    await this.db.transactions.put(updatedRow);
    return toEntry(updatedRow);
  }

  // ---------- Aggregations & Reports ----------

  async recentItems(limit = 6): Promise<RecentItem[]> {
    const [txs, items, subcategories, categories] = await Promise.all([
      this.db.transactions
        .filter((t) => t.deleted_at === null && (t.type === 'expense' || t.type === 'income') && t.item_id !== null)
        .toArray(),
      this.db.items.toArray(),
      this.db.subcategories.toArray(),
      this.db.categories.toArray(),
    ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const subMap = new Map(subcategories.map((s) => [s.id, s]));
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const stats = new Map<string, { count: number; lastUsed: string }>();
    for (const t of txs) {
      if (!t.item_id) continue;
      const existing = stats.get(t.item_id);
      if (existing) {
        existing.count += 1;
        if (t.occurred_on > existing.lastUsed) {
          existing.lastUsed = t.occurred_on;
        }
      } else {
        stats.set(t.item_id, { count: 1, lastUsed: t.occurred_on });
      }
    }

    const sortedItemIds = Array.from(stats.entries())
      .sort((a, b) => {
        if (b[1].count !== a[1].count) {
          return b[1].count - a[1].count;
        }
        return b[1].lastUsed.localeCompare(a[1].lastUsed);
      })
      .slice(0, limit);

    const result: RecentItem[] = [];
    for (const [itemId, stat] of sortedItemIds) {
      const itemRow = itemMap.get(itemId);
      if (!itemRow) continue;
      const subRow = subMap.get(itemRow.subcategory_id);
      if (!subRow) continue;
      const catRow = catMap.get(subRow.category_id);
      if (!catRow) continue;

      result.push({
        item: toItem(itemRow),
        subcategory: toSubcategory(subRow),
        category: toCategory(catRow),
        usageCount: stat.count,
        lastUsedAt: stat.lastUsed,
      });
    }

    return result;
  }

  async monthSummary(month: string): Promise<MonthSummary> {
    const txs = await this.db.transactions
      .filter((t) => t.deleted_at === null && t.occurred_on.startsWith(month))
      .toArray();

    let income = 0;
    let expense = 0;

    for (const t of txs) {
      if (t.type === 'income') {
        income += Number(t.amount);
      } else if (t.type === 'expense') {
        expense += Number(t.amount);
      }
    }

    return {
      month,
      income: roundMoney(income),
      expense: roundMoney(expense),
      net: roundMoney(income - expense),
    };
  }

  async categoryTotals(
    month: string,
    kind: CategoryKind,
    level: CategoryLevel,
    parentId?: string
  ): Promise<CategoryTotal[]> {
    const [txs, items, subcategories, categories] = await Promise.all([
      this.db.transactions
        .filter(
          (t) =>
            t.deleted_at === null &&
            t.type === kind &&
            t.occurred_on.startsWith(month) &&
            t.item_id !== null
        )
        .toArray(),
      this.db.items.toArray(),
      this.db.subcategories.toArray(),
      this.db.categories.toArray(),
    ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const subMap = new Map(subcategories.map((s) => [s.id, s]));
    const catMap = new Map(categories.map((c) => [c.id, c]));

    // Map each item to subcategory and category
    interface EnrichedTx {
      amount: number;
      itemId: string;
      item: ItemRow;
      subId: string;
      sub: SubcategoryRow;
      catId: string;
      cat: CategoryRow;
    }

    const enrichedList: EnrichedTx[] = [];
    for (const t of txs) {
      if (!t.item_id) continue;
      const item = itemMap.get(t.item_id);
      if (!item) continue;
      const sub = subMap.get(item.subcategory_id);
      if (!sub) continue;
      const cat = catMap.get(sub.category_id);
      if (!cat) continue;
      if (cat.kind !== kind) continue;

      enrichedList.push({
        amount: Number(t.amount),
        itemId: item.id,
        item,
        subId: sub.id,
        sub,
        catId: cat.id,
        cat,
      });
    }

    let filtered = enrichedList;
    if (level === 'subcategory' && parentId) {
      filtered = filtered.filter((e) => e.catId === parentId);
    } else if (level === 'item' && parentId) {
      filtered = filtered.filter((e) => e.subId === parentId);
    }

    const groupMap = new Map<
      string,
      { total: number; count: number; nameAr: string | null; nameEn: string | null; icon?: string | null; color?: string | null }
    >();

    for (const e of filtered) {
      let key = '';
      let nameAr: string | null = null;
      let nameEn: string | null = null;
      let icon: string | null = null;
      let color: string | null = null;

      if (level === 'category') {
        key = e.catId;
        nameAr = e.cat.name_ar;
        nameEn = e.cat.name_en;
        icon = e.cat.icon;
        color = e.cat.color;
      } else if (level === 'subcategory') {
        key = e.subId;
        nameAr = e.sub.name_ar;
        nameEn = e.sub.name_en;
        icon = e.cat.icon;
        color = e.cat.color;
      } else {
        key = e.itemId;
        nameAr = e.item.name_ar;
        nameEn = e.item.name_en;
        icon = e.cat.icon;
        color = e.cat.color;
      }

      const existing = groupMap.get(key);
      if (existing) {
        existing.total += e.amount;
        existing.count += 1;
      } else {
        groupMap.set(key, { total: e.amount, count: 1, nameAr, nameEn, icon, color });
      }
    }

    const grandTotal = Array.from(groupMap.values()).reduce((sum, g) => sum + g.total, 0);

    const totals: CategoryTotal[] = Array.from(groupMap.entries()).map(([id, g]) => ({
      id,
      nameAr: g.nameAr,
      nameEn: g.nameEn,
      icon: g.icon,
      color: g.color,
      total: roundMoney(g.total),
      entriesCount: g.count,
      percentage: grandTotal > 0 ? roundMoney((g.total / grandTotal) * 100) : 0,
    }));

    totals.sort((a, b) => b.total - a.total);
    return totals;
  }

  async entriesForPivot(
    period: PivotPeriod | { startDate: string; endDate: string }
  ): Promise<PivotEntry[]> {
    let startDate: string | undefined;
    let endDate: string | undefined;
    const now = new Date();

    if (typeof period === 'object') {
      startDate = period.startDate;
      endDate = period.endDate;
    } else if (period === 'this-month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      startDate = `${y}-${m}-01`;
    } else if (period === 'last-3-months') {
      const past = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const y = past.getFullYear();
      const m = String(past.getMonth() + 1).padStart(2, '0');
      startDate = `${y}-${m}-01`;
    } else if (period === 'last-6-months') {
      const past = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const y = past.getFullYear();
      const m = String(past.getMonth() + 1).padStart(2, '0');
      startDate = `${y}-${m}-01`;
    } else if (period === 'this-year') {
      startDate = `${now.getFullYear()}-01-01`;
    }

    const txs = await this.listEntries({
      startDate,
      endDate,
      includeDeleted: false,
    });

    return txs
      .filter((t) => t.type === 'expense' || t.type === 'income')
      .map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        occurredOn: t.occurredOn,
        month: t.occurredOn.slice(0, 7),
        week: getIsoWeek(t.occurredOn),
        categoryId: t.categoryId ?? null,
        categoryNameAr: t.categoryNameAr ?? null,
        categoryNameEn: t.categoryNameEn ?? null,
        categoryIcon: t.categoryIcon ?? null,
        categoryColor: t.categoryColor ?? null,
        subcategoryId: t.subcategoryId ?? null,
        subcategoryNameAr: t.subcategoryNameAr ?? null,
        subcategoryNameEn: t.subcategoryNameEn ?? null,
        itemId: t.itemId ?? null,
        itemNameAr: t.itemNameAr ?? null,
        itemNameEn: t.itemNameEn ?? null,
        accountId: t.accountId,
        accountNameAr: t.accountNameAr ?? null,
        accountNameEn: t.accountNameEn ?? null,
        createdById: t.createdBy ?? null,
        createdByName: t.createdByName ?? null,
      }));
  }

  async syncStatus(): Promise<SyncStatus> {
    const lastSyncedMeta = await this.db.meta.get('lastSyncedAt');
    const pendingCount = await this.db.outbox.count();

    return {
      status: 'synced',
      lastSyncedAt: (lastSyncedMeta?.value as string) ?? null,
      pendingCount,
    };
  }
}

// Default mock repository instance
export const mockRepository = new MockRepository();

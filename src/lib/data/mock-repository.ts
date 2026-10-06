// =========================================================
// Mock Repository  ·  Family Accounts (حساباتنا)
// In-browser Dexie repository seeded with realistic sample data
// Implements the Repository interface for Phase A
// =========================================================

import { db as defaultDb, FamilyAccountsDB } from '../offline/db';
import {
  roundMoney,
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
} from './mock-seed';
import type {
  CreateCategoryInput,
  CreateEntryInput,
  CreateItemInput,
  CreateSubcategoryInput,
  CreateWalletInput,
  ListEntriesParams,
  Repository,
  UpdateCategoryInput,
  UpdateEntryInput,
  UpdateItemInput,
  UpdateSubcategoryInput,
  UpdateWalletInput,
} from './repository';
import type {
  AccountRow,
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
  private db: FamilyAccountsDB;
  private seedPromise: Promise<void> | null = null;

  constructor(customDb?: FamilyAccountsDB) {
    this.db = customDb ?? defaultDb;
  }

  // Ensures database is seeded on first access
  async ensureSeeded(): Promise<void> {
    if (this.seedPromise) {
      return this.seedPromise;
    }

    this.seedPromise = (async () => {
      const seeded = await this.db.meta.get('seeded');
      if (seeded && seeded.value === true) {
        return;
      }

      await this.seed();
    })();

    return this.seedPromise;
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
        await this.db.meta.put({ key: 'lastSyncedAt', value: new Date().toISOString() });
      }
    );
  }

  // Resets the mock database
  async reset(): Promise<void> {
    this.seedPromise = null;
    await this.seed();
  }

  // ---------- Household & Members ----------

  async getHousehold(): Promise<Household | null> {
    await this.ensureSeeded();
    const row = await this.db.households.get(DEMO_HOUSEHOLD_ID);
    return row ? toHousehold(row) : null;
  }

  async getMembers(): Promise<Member[]> {
    await this.ensureSeeded();
    const rows = await this.db.household_members.toArray();
    return rows.map(toMember);
  }

  // ---------- Wallets (Accounts) ----------

  async getWallets(includeArchived = false): Promise<Wallet[]> {
    await this.ensureSeeded();
    let rows = await this.db.accounts.toArray();
    if (!includeArchived) {
      rows = rows.filter((w) => !w.is_archived);
    }
    rows.sort((a, b) => a.sort_order - b.sort_order);
    return rows.map(toWallet);
  }

  async getWallet(id: string): Promise<Wallet | null> {
    await this.ensureSeeded();
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
    await this.ensureSeeded();
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

  // ---------- Categories ----------

  async getCategories(kind?: CategoryKind, includeArchived = false): Promise<Category[]> {
    await this.ensureSeeded();
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
    await this.ensureSeeded();
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

  // ---------- Subcategories ----------

  async getSubcategories(categoryId?: string, includeArchived = false): Promise<Subcategory[]> {
    await this.ensureSeeded();
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
    await this.ensureSeeded();
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
    await this.ensureSeeded();
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
    await this.ensureSeeded();
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
      };
    });
  }

  async listEntries(params?: ListEntriesParams): Promise<EnrichedEntry[]> {
    await this.ensureSeeded();
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
    await this.ensureSeeded();
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
      created_by: input.createdBy ?? null,
      updated_by: null,
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
      updated_by: updates.updatedBy ?? row.updated_by,
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
    });
  }

  async restoreEntry(id: string): Promise<void> {
    await this.ensureSeeded();
    await this.db.transactions.update(id, {
      deleted_at: null,
      updated_at: new Date().toISOString(),
    });
  }

  // ---------- Aggregations & Reports ----------

  async recentItems(limit = 6): Promise<RecentItem[]> {
    await this.ensureSeeded();
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
    await this.ensureSeeded();
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
    await this.ensureSeeded();
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
    await this.ensureSeeded();

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
    await this.ensureSeeded();
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

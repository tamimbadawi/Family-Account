// =========================================================
// Repository Interface  ·  Family Accounts (حساباتنا)
// The single door to data for all screens.
// Return types are plain objects.
// Phase A: MockRepository (Dexie on phone with sample data)
// Phase B: LiveRepository (Dexie + outbox + Supabase sync)
// =========================================================

import type {
  Category,
  CategoryKind,
  CategoryLevel,
  CategoryTotal,
  EnrichedEntry,
  Entry,
  EntryType,
  Household,
  Item,
  Member,
  MonthSummary,
  PivotEntry,
  PivotPeriod,
  RecentItem,
  Subcategory,
  SyncStatus,
  Wallet,
  WalletBalance,
  WalletType,
} from './types';

export interface ListEntriesParams {
  month?: string; // 'YYYY-MM'
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD'
  accountId?: string;
  categoryId?: string;
  subcategoryId?: string;
  itemId?: string;
  type?: EntryType;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  limit?: number;
  offset?: number;
  searchQuery?: string;
}

export interface CreateEntryInput {
  id?: string;
  householdId?: string;
  type: EntryType;
  amount: number;
  occurredOn: string; // YYYY-MM-DD
  accountId: string;
  toAccountId?: string | null;
  itemId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}

export interface UpdateEntryInput {
  type?: EntryType;
  amount?: number;
  occurredOn?: string;
  accountId?: string;
  toAccountId?: string | null;
  itemId?: string | null;
  note?: string | null;
  updatedBy?: string | null;
}

export interface CreateWalletInput {
  id?: string;
  householdId?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  type: WalletType;
  openingBalance?: number;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
}

export interface UpdateWalletInput {
  nameAr?: string | null;
  nameEn?: string | null;
  type?: WalletType;
  openingBalance?: number;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
}

export interface CreateCategoryInput {
  id?: string;
  householdId?: string;
  kind: CategoryKind;
  nameAr?: string | null;
  nameEn?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  nameAr?: string | null;
  nameEn?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
}

export interface CreateSubcategoryInput {
  id?: string;
  householdId?: string;
  categoryId: string;
  nameAr?: string | null;
  nameEn?: string | null;
  sortOrder?: number;
}

export interface UpdateSubcategoryInput {
  nameAr?: string | null;
  nameEn?: string | null;
  sortOrder?: number;
}

export interface CreateItemInput {
  id?: string;
  householdId?: string;
  subcategoryId: string;
  nameAr?: string | null;
  nameEn?: string | null;
  sortOrder?: number;
}

export interface UpdateItemInput {
  nameAr?: string | null;
  nameEn?: string | null;
  sortOrder?: number;
}

export interface Repository {
  // Household & Members
  getHousehold(): Promise<Household | null>;
  getMembers(): Promise<Member[]>;

  // Wallets (Accounts)
  getWallets(includeArchived?: boolean): Promise<Wallet[]>;
  getWallet(id: string): Promise<Wallet | null>;
  addWallet(input: CreateWalletInput): Promise<Wallet>;
  updateWallet(id: string, updates: UpdateWalletInput): Promise<Wallet>;
  archiveWallet(id: string, archive?: boolean): Promise<void>;
  getWalletBalances(): Promise<WalletBalance[]>;
  walletBalances(): Promise<WalletBalance[]>;

  // Categories
  getCategories(kind?: CategoryKind, includeArchived?: boolean): Promise<Category[]>;
  getCategory(id: string): Promise<Category | null>;
  addCategory(input: CreateCategoryInput): Promise<Category>;
  updateCategory(id: string, updates: UpdateCategoryInput): Promise<Category>;
  archiveCategory(id: string, archive?: boolean): Promise<void>;

  // Subcategories
  getSubcategories(categoryId?: string, includeArchived?: boolean): Promise<Subcategory[]>;
  getSubcategory(id: string): Promise<Subcategory | null>;
  addSubcategory(input: CreateSubcategoryInput): Promise<Subcategory>;
  updateSubcategory(id: string, updates: UpdateSubcategoryInput): Promise<Subcategory>;
  archiveSubcategory(id: string, archive?: boolean): Promise<void>;

  // Items
  getItems(subcategoryId?: string, includeArchived?: boolean): Promise<Item[]>;
  getItem(id: string): Promise<Item | null>;
  addItem(input: CreateItemInput): Promise<Item>;
  updateItem(id: string, updates: UpdateItemInput): Promise<Item>;
  archiveItem(id: string, archive?: boolean): Promise<void>;

  // Entries (Transactions)
  listEntries(params?: ListEntriesParams): Promise<EnrichedEntry[]>;
  getEntry(id: string): Promise<EnrichedEntry | null>;
  addEntry(input: CreateEntryInput): Promise<Entry>;
  updateEntry(id: string, updates: UpdateEntryInput): Promise<Entry>;
  softDeleteEntry(id: string): Promise<void>;
  restoreEntry(id: string): Promise<void>;

  // Aggregations & Reports
  recentItems(limit?: number): Promise<RecentItem[]>;
  monthSummary(month: string): Promise<MonthSummary>;
  categoryTotals(
    month: string,
    kind: CategoryKind,
    level: CategoryLevel,
    parentId?: string
  ): Promise<CategoryTotal[]>;
  entriesForPivot(period: PivotPeriod | { startDate: string; endDate: string }): Promise<PivotEntry[]>;
  syncStatus(): Promise<SyncStatus>;
}

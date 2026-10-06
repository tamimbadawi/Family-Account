// =========================================================
// Domain Types  ·  Family Accounts (حساباتنا)
// Mirrors the SQL schema in supabase/migrations/0001_schema.sql
// All domain types in TypeScript are camelCase.
// =========================================================

export type CategoryKind = 'expense' | 'income';
export type EntryType = 'expense' | 'income' | 'transfer';
export type WalletType = 'cash' | 'bank' | 'card' | 'wallet';
export type MemberRole = 'owner' | 'member';
export type MemberLocale = 'ar' | 'en';

// ---------- Domain entities (camelCase) ----------

export interface Household {
  id: string;
  name: string;
  currency: string; // 'EGP'
  createdAt: string;
}

export interface Member {
  householdId: string;
  userId: string;
  displayName: string;
  role: MemberRole;
  locale: MemberLocale;
  createdAt: string;
}

export interface Wallet {
  id: string;
  householdId: string;
  nameAr: string | null;
  nameEn: string | null;
  type: WalletType;
  openingBalance: number;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WalletBalance extends Wallet {
  balance: number;
}

export interface Category {
  id: string;
  householdId: string;
  kind: CategoryKind;
  nameAr: string | null;
  nameEn: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subcategory {
  id: string;
  householdId: string;
  categoryId: string;
  nameAr: string | null;
  nameEn: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  householdId: string;
  subcategoryId: string;
  nameAr: string | null;
  nameEn: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Entry {
  id: string;
  householdId: string;
  type: EntryType;
  amount: number;
  occurredOn: string; // 'YYYY-MM-DD'
  accountId: string;
  toAccountId: string | null;
  itemId: string | null;
  note: string | null;
  photoPath?: string | null; // receipt photo: '<household_id>/<entry_id>.jpg' (or .webp)
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface EnrichedEntry extends Entry {
  accountNameAr?: string | null;
  accountNameEn?: string | null;
  toAccountNameAr?: string | null;
  toAccountNameEn?: string | null;
  itemNameAr?: string | null;
  itemNameEn?: string | null;
  subcategoryId?: string | null;
  subcategoryNameAr?: string | null;
  subcategoryNameEn?: string | null;
  categoryId?: string | null;
  categoryNameAr?: string | null;
  categoryNameEn?: string | null;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  createdByName?: string | null;
  updatedByName?: string | null;
}

// ---------- Reports & Aggregations ----------

export interface MonthSummary {
  month: string; // 'YYYY-MM'
  income: number;
  expense: number;
  net: number;
}

export type CategoryLevel = 'category' | 'subcategory' | 'item';

export interface CategoryTotal {
  id: string;
  nameAr: string | null;
  nameEn: string | null;
  icon?: string | null;
  color?: string | null;
  total: number;
  entriesCount: number;
  percentage?: number; // 0–100
}

export interface RecentItem {
  item: Item;
  subcategory: Subcategory;
  category: Category;
  usageCount: number;
  lastUsedAt: string;
}

export interface PivotEntry {
  id: string;
  type: EntryType;
  amount: number;
  occurredOn: string; // 'YYYY-MM-DD'
  month: string; // 'YYYY-MM'
  week: string; // 'YYYY-Www'
  categoryId: string | null;
  categoryNameAr: string | null;
  categoryNameEn: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  subcategoryId: string | null;
  subcategoryNameAr: string | null;
  subcategoryNameEn: string | null;
  itemId: string | null;
  itemNameAr: string | null;
  itemNameEn: string | null;
  accountId: string;
  accountNameAr: string | null;
  accountNameEn: string | null;
  createdById: string | null;
  createdByName: string | null;
}

export type PivotPeriod = 'this-month' | 'last-3-months' | 'last-6-months' | 'this-year' | 'all';

export interface SyncStatus {
  status: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: string | null;
  pendingCount: number;
  error?: string | null;
}

// ---------- Database Rows (snake_case) ----------

export interface HouseholdRow {
  id: string;
  name: string;
  currency: string;
  created_at: string;
}

export interface HouseholdMemberRow {
  household_id: string;
  user_id: string;
  display_name: string;
  role: MemberRole;
  locale: MemberLocale;
  created_at: string;
}

export interface AccountRow {
  id: string;
  household_id: string;
  name_ar: string | null;
  name_en: string | null;
  type: WalletType;
  opening_balance: number;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  household_id: string;
  kind: CategoryKind;
  name_ar: string | null;
  name_en: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubcategoryRow {
  id: string;
  household_id: string;
  category_id: string;
  name_ar: string | null;
  name_en: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemRow {
  id: string;
  household_id: string;
  subcategory_id: string;
  name_ar: string | null;
  name_en: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  household_id: string;
  type: EntryType;
  amount: number;
  occurred_on: string;
  account_id: string;
  to_account_id: string | null;
  item_id: string | null;
  note: string | null;
  photo_path?: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Receipt photo kept on the phone (mock mode); Phase B uploads it to the `receipts` bucket. */
export interface PhotoRow {
  id: string; // transaction id
  blob: Blob;
  created_at: string;
}

export interface OutboxRow {
  id: string;
  table: string;
  op: 'upsert';
  row: Record<string, unknown>;
  attempts: number;
  error?: string | null;
  created_at: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

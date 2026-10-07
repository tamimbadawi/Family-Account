// =========================================================
// Mappers  ·  Family Accounts (حساباتنا)
// Converts between snake_case DB rows and camelCase domain types
// =========================================================

import type {
  AccountRow,
  Budget,
  BudgetRow,
  Category,
  CategoryRow,
  Entry,
  Household,
  HouseholdMemberRow,
  HouseholdRow,
  Item,
  ItemRow,
  Member,
  Subcategory,
  SubcategoryRow,
  TransactionRow,
  Wallet,
} from './types';

// Rounds money to 2 decimal places to avoid floating point drift
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ---------- Household ----------

export function toHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    createdAt: row.created_at,
  };
}

export function toHouseholdRow(h: Household): HouseholdRow {
  return {
    id: h.id,
    name: h.name,
    currency: h.currency,
    created_at: h.createdAt,
  };
}

// ---------- Member ----------

export function toMember(row: HouseholdMemberRow): Member {
  return {
    householdId: row.household_id,
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    locale: row.locale,
    createdAt: row.created_at,
  };
}

export function toMemberRow(m: Member): HouseholdMemberRow {
  return {
    household_id: m.householdId,
    user_id: m.userId,
    display_name: m.displayName,
    role: m.role,
    locale: m.locale,
    created_at: m.createdAt,
  };
}

// ---------- Wallet (Account) ----------

export function toWallet(row: AccountRow): Wallet {
  return {
    id: row.id,
    householdId: row.household_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    type: row.type,
    openingBalance: roundMoney(Number(row.opening_balance)),
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAccountRow(w: Wallet): AccountRow {
  return {
    id: w.id,
    household_id: w.householdId,
    name_ar: w.nameAr,
    name_en: w.nameEn,
    type: w.type,
    opening_balance: roundMoney(w.openingBalance),
    icon: w.icon,
    color: w.color,
    sort_order: w.sortOrder,
    is_archived: w.isArchived,
    created_at: w.createdAt,
    updated_at: w.updatedAt,
  };
}

// ---------- Category ----------

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    householdId: row.household_id,
    kind: row.kind,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCategoryRow(c: Category): CategoryRow {
  return {
    id: c.id,
    household_id: c.householdId,
    kind: c.kind,
    name_ar: c.nameAr,
    name_en: c.nameEn,
    icon: c.icon,
    color: c.color,
    sort_order: c.sortOrder,
    is_archived: c.isArchived,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

// ---------- Subcategory ----------

export function toSubcategory(row: SubcategoryRow): Subcategory {
  return {
    id: row.id,
    householdId: row.household_id,
    categoryId: row.category_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    sortOrder: row.sort_order,
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSubcategoryRow(s: Subcategory): SubcategoryRow {
  return {
    id: s.id,
    household_id: s.householdId,
    category_id: s.categoryId,
    name_ar: s.nameAr,
    name_en: s.nameEn,
    sort_order: s.sortOrder,
    is_archived: s.isArchived,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

// ---------- Item ----------

export function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    householdId: row.household_id,
    subcategoryId: row.subcategory_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    sortOrder: row.sort_order,
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toItemRow(i: Item): ItemRow {
  return {
    id: i.id,
    household_id: i.householdId,
    subcategory_id: i.subcategoryId,
    name_ar: i.nameAr,
    name_en: i.nameEn,
    sort_order: i.sortOrder,
    is_archived: i.isArchived,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  };
}

// ---------- Entry (Transaction) ----------

export function toEntry(row: TransactionRow): Entry {
  return {
    id: row.id,
    householdId: row.household_id,
    type: row.type,
    amount: roundMoney(Number(row.amount)),
    occurredOn: row.occurred_on,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    itemId: row.item_id,
    note: row.note,
    photoPath: row.photo_path ?? null,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function toTransactionRow(e: Entry): TransactionRow {
  return {
    id: e.id,
    household_id: e.householdId,
    type: e.type,
    amount: roundMoney(e.amount),
    occurred_on: e.occurredOn,
    account_id: e.accountId,
    to_account_id: e.toAccountId,
    item_id: e.itemId,
    note: e.note,
    photo_path: e.photoPath ?? null,
    created_by: e.createdBy,
    updated_by: e.updatedBy,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
    deleted_at: e.deletedAt,
  };
}

// ---------- Budget ----------

export function toBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    householdId: row.household_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    amount: roundMoney(Number(row.amount)),
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toBudgetRow(b: Budget): BudgetRow {
  return {
    id: b.id,
    household_id: b.householdId,
    category_id: b.categoryId,
    subcategory_id: b.subcategoryId,
    amount: roundMoney(b.amount),
    is_archived: b.isArchived,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
}

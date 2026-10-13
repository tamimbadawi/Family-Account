// =========================================================
// Dexie Database Schema  ·  Family Accounts (حساباتنا)
// Mirrors the server tables + outbox & meta for offline-first sync.
// Reused in Phase A (mock) and Phase B (live sync).
// =========================================================

import Dexie, { type Table } from 'dexie';
import type {
  AccountRow,
  BudgetRow,
  CategoryRow,
  HouseholdMemberRow,
  HouseholdRow,
  InvestmentValueRow,
  ItemRow,
  MetaRow,
  OutboxRow,
  PhotoRow,
  RecurringRuleRow,
  SavingsGoalRow,
  SubcategoryRow,
  TransactionRow,
} from '../data/types';

export function getDbName(mode?: string): string {
  const dataMode =
    mode ??
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DATA_MODE : undefined) ??
    'mock';
  return dataMode === 'live' ? 'fa-live' : 'fa-mock';
}

export class FamilyAccountsDB extends Dexie {
  households!: Table<HouseholdRow, string>;
  household_members!: Table<HouseholdMemberRow, [string, string]>;
  accounts!: Table<AccountRow, string>;
  categories!: Table<CategoryRow, string>;
  subcategories!: Table<SubcategoryRow, string>;
  items!: Table<ItemRow, string>;
  transactions!: Table<TransactionRow, string>;
  outbox!: Table<OutboxRow, string>;
  meta!: Table<MetaRow, string>;
  photos!: Table<PhotoRow, string>;
  budgets!: Table<BudgetRow, string>;
  recurring_rules!: Table<RecurringRuleRow, string>;
  savings_goals!: Table<SavingsGoalRow, string>;
  investment_values!: Table<InvestmentValueRow, string>;

  constructor(dbName: string = getDbName()) {
    super(dbName);

    this.version(1).stores({
      households: 'id',
      household_members: '[household_id+user_id], household_id, user_id',
      accounts: 'id, household_id, type, sort_order, is_archived, updated_at',
      categories: 'id, household_id, kind, sort_order, is_archived, updated_at',
      subcategories: 'id, household_id, category_id, sort_order, is_archived, updated_at',
      items: 'id, household_id, subcategory_id, sort_order, is_archived, updated_at',
      transactions:
        'id, household_id, occurred_on, account_id, to_account_id, item_id, type, deleted_at, updated_at, [household_id+occurred_on]',
      outbox: 'id, created_at, attempts',
      meta: 'key',
    });

    // v2 · receipt photos stored on the phone (A3c). v1 stays as-is so existing phones upgrade cleanly.
    this.version(2).stores({
      photos: 'id',
    });

    // v3 · monthly budgets per category or group.
    this.version(3).stores({
      budgets: 'id, household_id, category_id, subcategory_id, is_archived',
    });

    // v4 · recurring entries for monthly bills, salaries, rent (R3).
    this.version(4).stores({
      recurring_rules: 'id, household_id, is_archived, updated_at',
      transactions:
        'id, household_id, occurred_on, account_id, to_account_id, item_id, type, deleted_at, updated_at, recurring_rule_id, recurring_month, [household_id+occurred_on], [household_id+recurring_rule_id+recurring_month]',
    });

    // v5 · savings goals linked to wallets (R4).
    this.version(5).stores({
      savings_goals: 'id, household_id, wallet_id, is_archived, updated_at',
    });

    // v6 · investment values (M1).
    this.version(6).stores({
      investment_values: 'id, household_id, account_id, updated_at',
    });
  }
}

// Global default database instance for the configured mode
export const db = new FamilyAccountsDB();

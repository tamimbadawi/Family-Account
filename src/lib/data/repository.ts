// =========================================================
// Repository Interface  ·  Family Accounts (حساباتنا)
// The single door to data for all screens.
// Return types are plain objects.
// Phase A: MockRepository (Dexie on phone with sample data)
// Phase B: LiveRepository (saves go to Supabase; Dexie keeps a read copy)
// =========================================================

import type {
  Budget,
  Category,
  CategoryKind,
  CategoryLevel,
  CategoryTotal,
  EnrichedEntry,
  EnrichedInvestment,
  EnrichedRecurringRule,
  EnrichedSavingsGoal,
  Entry,
  EntryType,
  GoldKarat,
  Household,
  InvestmentKind,
  InvestmentUnit,
  InvestmentValue,
  Item,
  Member,
  MonthSummary,
  PivotEntry,
  PivotPeriod,
  RecentItem,
  RecurrenceFrequency,
  RecurringRule,
  SavingsGoal,
  Subcategory,
  SyncStatus,
  Wallet,
  WalletBalance,
  WalletPurpose,
  WalletType,
} from './types';

export interface CreateSavingsGoalInput {
  id?: string;
  householdId?: string;
  nameEn: string;
  nameAr?: string | null;
  targetAmount: number;
  targetDate?: string | null;
  icon?: string | null;
  color?: string | null;
  walletId: string;
  createdBy?: string | null;
}

export interface UpdateSavingsGoalInput {
  nameEn?: string;
  nameAr?: string | null;
  targetAmount?: number;
  targetDate?: string | null;
  icon?: string | null;
  color?: string | null;
  walletId?: string;
}

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
  toAmount?: number | null;
  quantity?: number | null;
  itemId?: string | null;
  note?: string | null;
  recurringRuleId?: string | null;
  recurringMonth?: string | null;
  recurringDate?: string | null;
  createdBy?: string | null;
}

export interface CreateRecurringRuleInput {
  id?: string;
  householdId?: string;
  type: EntryType;
  amount: number;
  /** First date the rule is due ('YYYY-MM-DD'). Older callers pass startMonth + dayOfMonth instead. */
  startDate?: string;
  startMonth?: string;
  dayOfMonth?: number;
  endDate?: string | null;
  frequency?: RecurrenceFrequency; // default 'monthly'
  interval?: number; // default 1
  daysOfWeek?: number[] | null; // weekly only: 0 = Sunday … 6 = Saturday
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
  toAmount?: number | null;
  quantity?: number | null;
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
  currency?: string;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  purpose?: WalletPurpose;
  investmentKind?: InvestmentKind | null;
  maturesOn?: string | null;
  unit?: InvestmentUnit | null;
  karat?: GoldKarat | null;
  openingQuantity?: number | null;
}

export interface UpdateWalletInput {
  nameAr?: string | null;
  nameEn?: string | null;
  type?: WalletType;
  openingBalance?: number;
  currency?: string;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  purpose?: WalletPurpose;
  investmentKind?: InvestmentKind | null;
  maturesOn?: string | null;
  unit?: InvestmentUnit | null;
  karat?: GoldKarat | null;
  openingQuantity?: number | null;
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

export interface CreateBudgetInput {
  id?: string;
  householdId?: string;
  categoryId: string;
  /** null or omitted = a budget for the whole category */
  subcategoryId?: string | null;
  amount: number; // per month
  /** Set only by the starter budgets a new family gets. */
  isStarter?: boolean;
}

export interface UpdateBudgetInput {
  amount?: number;
}

export interface Repository {
  // Household & Members
  getHousehold(): Promise<Household | null>;
  setHouseholdCurrencies(currencies: string[]): Promise<void>;
  getMembers(): Promise<Member[]>;

  // Wallets (Accounts)
  getWallets(includeArchived?: boolean): Promise<Wallet[]>;
  getWallet(id: string): Promise<Wallet | null>;
  addWallet(input: CreateWalletInput): Promise<Wallet>;
  updateWallet(id: string, updates: UpdateWalletInput): Promise<Wallet>;
  archiveWallet(id: string, archive?: boolean): Promise<void>;
  getWalletBalances(): Promise<WalletBalance[]>;
  walletBalances(): Promise<WalletBalance[]>;
  adjustWalletBalance(
    walletId: string,
    actualBalance: number,
    occurredOn?: string
  ): Promise<Entry | null>;

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

  // Budgets (monthly, per expense category or group)
  getBudgets(includeArchived?: boolean): Promise<Budget[]>;
  /** Adds a budget, or updates the active one for the same category/group (one budget per target). */
  addBudget(input: CreateBudgetInput): Promise<Budget>;
  updateBudget(id: string, updates: UpdateBudgetInput): Promise<Budget>;
  /** "Remove" a budget = archive it; archive=false brings it back (Undo). */
  archiveBudget(id: string, archive?: boolean): Promise<void>;

  // Recurring Rules (monthly bills, salaries, rent)
  getRecurringRules(includeArchived?: boolean): Promise<EnrichedRecurringRule[]>;
  getRecurringRule(id: string): Promise<RecurringRule | null>;
  createRecurringRule(input: CreateRecurringRuleInput): Promise<RecurringRule>;
  archiveRecurringRule(id: string, archive?: boolean): Promise<void>;
  /** Generates any due monthly entries not yet created. Returns count of created entries. */
  processDueRecurringRules(currentDate?: string): Promise<number>;

  // Savings Goals (R4)
  getSavingsGoals(includeArchived?: boolean): Promise<EnrichedSavingsGoal[]>;
  getSavingsGoal(id: string): Promise<EnrichedSavingsGoal | null>;
  createSavingsGoal(input: CreateSavingsGoalInput): Promise<SavingsGoal>;
  updateSavingsGoal(id: string, updates: UpdateSavingsGoalInput): Promise<SavingsGoal>;
  archiveSavingsGoal(id: string, archive?: boolean): Promise<void>;

  // Investments (M1)
  getInvestments(includeArchived?: boolean): Promise<EnrichedInvestment[]>;
  getInvestmentValues(accountId: string): Promise<InvestmentValue[]>;
  addInvestmentValue(input: { id?: string; accountId: string; value: number; unitPrice?: number | null; valuedOn?: string }): Promise<InvestmentValue>;
  addInvestmentPrice(input: { accountId: string; unitPrice: number; valuedOn?: string }): Promise<InvestmentValue[]>;
  updateInvestmentValue(id: string, value: number): Promise<InvestmentValue>;
  updateInvestmentPrice(id: string, unitPrice: number): Promise<InvestmentValue>;
  trackByQuantity(
    accountId: string,
    input: { quantity: number; karat?: number | null }
  ): Promise<{ account: Wallet; value: InvestmentValue }>;
  softDeleteInvestmentValue(id: string): Promise<void>;
  restoreInvestmentValue(id: string): Promise<void>;

  // Entries (Transactions)
  listEntries(params?: ListEntriesParams): Promise<EnrichedEntry[]>;
  getEntry(id: string): Promise<EnrichedEntry | null>;
  addEntry(input: CreateEntryInput): Promise<Entry>;
  updateEntry(id: string, updates: UpdateEntryInput): Promise<Entry>;
  softDeleteEntry(id: string): Promise<void>;
  restoreEntry(id: string): Promise<void>;

  // Receipt photos (one optional photo per entry)
  setEntryPhoto(entryId: string, blob: Blob): Promise<Entry>;
  getEntryPhoto(entryId: string): Promise<Blob | null>;
  /** Clears the entry's photo link only; nothing is hard-deleted. */
  removeEntryPhoto(entryId: string): Promise<Entry>;

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

  // Seeding / Initialization
  ensureSeeded?(): Promise<void>;
  /** Live mode: pull the latest rows from the server (app back in front, back online). */
  refresh?(): Promise<void>;
  /** Live mode: forget everything kept on this phone (sign-out). */
  clearCache?(): Promise<void>;

  /** ID of the user signed in on this phone. */
  currentUserId?: string;
  /** Subscribe to changes to currentUserId (e.g. when session loads after initial render). */
  onUserIdChange?(listener: (userId: string | null) => void): () => void;

  // Sample data (Phase A): every phone starts with made-up entries so people can look around.
  /** True while the phone still shows the sample entries. */
  hasSampleData?(): Promise<boolean>;
  /**
   * Removes the sample entries, photos and budgets, zeroes the sample wallets' opening balances
   * (Cash stays, the sample banks are hidden) and keeps the categories. The samples never come back.
   * Resolves to an undo that puts everything back exactly as it was.
   */
  clearSampleData?(): Promise<() => Promise<void>>;
}

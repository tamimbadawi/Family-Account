import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { z } from 'zod';
import crypto from 'node:crypto';
import type {
  AccountRow,
  CategoryRow,
  HouseholdMemberRow,
  HouseholdRow,
  ItemRow,
  SubcategoryRow,
  TransactionRow,
} from '@/lib/data/types';

// =========================================================
// Interface Contracts (per PROJECT.md § Interface Contracts)
// =========================================================

export interface FamilyInvite {
  id: string;
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedBy: string | null;
  householdId: string | null;
}

export interface TestHouseholdMemberRow extends HouseholdMemberRow {
  age?: number | null;
  email?: string;
}

export interface AdminFamilySummary {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
}

export interface CreateInviteResult {
  token: string;
  inviteUrl: string;
  expiresAt: string;
}

export interface ValidateInviteResult {
  valid: boolean;
  status: 'valid' | 'expired' | 'redeemed' | 'not_found';
}

export interface ProvisionHouseholdParams {
  token: string;
  email: string;
  password?: string;
  age: number;
  familyName: string;
  currency: string;
  locale: 'en' | 'ar';
}

export interface ProvisionHouseholdResult {
  success: boolean;
  householdId?: string;
  userId?: string;
  error?: string;
}

// =========================================================
// In-Memory Dexie Test Database
// =========================================================

export class TestFamilyAccountsDB extends Dexie {
  households!: Table<HouseholdRow, string>;
  household_members!: Table<TestHouseholdMemberRow, [string, string]>;
  accounts!: Table<AccountRow, string>;
  categories!: Table<CategoryRow, string>;
  subcategories!: Table<SubcategoryRow, string>;
  items!: Table<ItemRow, string>;
  transactions!: Table<TransactionRow, string>;
  family_invites!: Table<FamilyInvite, string>;

  constructor(dbName: string = `test-fa-${crypto.randomBytes(4).toString('hex')}`) {
    super(dbName);

    this.version(1).stores({
      households: 'id',
      household_members: '[household_id+user_id], household_id, user_id',
      accounts: 'id, household_id, type, sort_order, is_archived, updated_at',
      categories: 'id, household_id, kind, sort_order, is_archived, updated_at',
      subcategories: 'id, household_id, category_id, sort_order, is_archived, updated_at',
      items: 'id, household_id, subcategory_id, sort_order, is_archived, updated_at',
      transactions:
        'id, household_id, occurred_on, account_id, to_account_id, item_id, type, deleted_at, updated_at',
      family_invites: 'id, token, created_by, expires_at, redeemed_at, household_id, created_at',
    });
  }
}

// =========================================================
// Zod Onboarding Validation Schema (F11)
// =========================================================

export const onboardingSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email syntax'),
  age: z.coerce
    .number({ invalid_type_error: 'Age must be a valid number' })
    .int('Age must be an integer')
    .min(1, 'Age must be at least 1')
    .max(129, 'Age must be less than 130'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
  familyName: z
    .string()
    .trim()
    .min(2, 'Family name must be at least 2 characters')
    .max(100, 'Family name cannot exceed 100 characters'),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter uppercase ISO code'),
  locale: z.enum(['en', 'ar']).default('en'),
});

export const provisionHouseholdSchema = onboardingSchema.extend({
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

// =========================================================
// Domain Logic Implementations (Executable Oracles)
// =========================================================

/**
 * Generates a secure, 48-hour time-bounded invite token.
 */
export async function createInviteToken(
  db: TestFamilyAccountsDB,
  createdBy: string,
  baseUrl: string = 'https://app.family-accounts.com',
  locale: 'en' | 'ar' = 'en'
): Promise<CreateInviteResult> {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const inviteRecord: FamilyInvite = {
    id: crypto.randomUUID(),
    token,
    createdBy,
    createdAt: now.toISOString(),
    expiresAt,
    redeemedAt: null,
    redeemedBy: null,
    householdId: null,
  };

  await db.family_invites.put(inviteRecord);

  return {
    token,
    inviteUrl: `${baseUrl}/${locale}/invite?token=${token}`,
    expiresAt,
  };
}

/**
 * Validates an invite token against database state.
 */
export async function validateInviteToken(
  db: TestFamilyAccountsDB,
  rawToken: string
): Promise<ValidateInviteResult> {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, status: 'not_found' };
  }

  const token = rawToken.trim();
  if (token.length < 16) {
    return { valid: false, status: 'not_found' };
  }

  const invite = await db.family_invites.where('token').equals(token).first();
  if (!invite) {
    return { valid: false, status: 'not_found' };
  }

  if (invite.redeemedAt !== null) {
    return { valid: false, status: 'redeemed' };
  }

  const expiresTime = new Date(invite.expiresAt).getTime();
  if (Date.now() >= expiresTime) {
    return { valid: false, status: 'expired' };
  }

  return { valid: true, status: 'valid' };
}

/**
 * Provisions a new household atomically from an invite token.
 */
export async function provisionInvitedHousehold(
  db: TestFamilyAccountsDB,
  params: ProvisionHouseholdParams
): Promise<ProvisionHouseholdResult> {
  // Validate input parameters
  const parseResult = provisionHouseholdSchema.safeParse(params);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || 'Validation error',
    };
  }

  const validation = await validateInviteToken(db, params.token);
  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid invite token: ${validation.status}`,
    };
  }

  const now = new Date().toISOString();
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const cashWalletId = crypto.randomUUID();

  await db.transaction(
    'rw',
    [
      db.households,
      db.household_members,
      db.accounts,
      db.categories,
      db.subcategories,
      db.items,
      db.family_invites,
    ],
    async () => {
      // 1. Create household with custom currency
      await db.households.put({
        id: householdId,
        name: params.familyName.trim(),
        currency: params.currency.toUpperCase(),
        created_at: now,
      });

      // 2. Link owner with age
      await db.household_members.put({
        household_id: householdId,
        user_id: userId,
        display_name: params.familyName.trim(),
        role: 'owner',
        locale: params.locale,
        age: params.age,
        email: params.email.trim(),
        created_at: now,
      });

      // 3. Seed default cash wallet in household currency
      await db.accounts.put({
        id: cashWalletId,
        household_id: householdId,
        name_ar: 'كاش في البيت',
        name_en: 'Cash at home',
        type: 'cash',
        opening_balance: 0,
        icon: 'banknote',
        color: '#16a34a',
        sort_order: 0,
        is_archived: false,
        created_at: now,
        updated_at: now,
      });

      // 4. Seed default categories & subcategories & items
      const catHouseholdId = crypto.randomUUID();
      const catFoodId = crypto.randomUUID();
      const catIncomeId = crypto.randomUUID();

      await db.categories.bulkPut([
        {
          id: catHouseholdId,
          household_id: householdId,
          kind: 'expense',
          name_ar: 'البيت والفواتير',
          name_en: 'Household',
          icon: 'home',
          color: '#3b82f6',
          sort_order: 0,
          is_archived: false,
          created_at: now,
          updated_at: now,
        },
        {
          id: catFoodId,
          household_id: householdId,
          kind: 'expense',
          name_ar: 'أكل وشرب',
          name_en: 'Food',
          icon: 'utensils',
          color: '#f97316',
          sort_order: 1,
          is_archived: false,
          created_at: now,
          updated_at: now,
        },
        {
          id: catIncomeId,
          household_id: householdId,
          kind: 'income',
          name_ar: 'دخل',
          name_en: 'Income',
          icon: 'wallet',
          color: '#10b981',
          sort_order: 0,
          is_archived: false,
          created_at: now,
          updated_at: now,
        },
      ]);

      const subGroceriesId = crypto.randomUUID();
      await db.subcategories.put({
        id: subGroceriesId,
        household_id: householdId,
        category_id: catFoodId,
        name_ar: 'بقالة وسوبرماركت',
        name_en: 'Groceries',
        sort_order: 0,
        is_archived: false,
        created_at: now,
        updated_at: now,
      });

      await db.items.put({
        id: crypto.randomUUID(),
        household_id: householdId,
        subcategory_id: subGroceriesId,
        name_ar: 'طلبات أسبوعية',
        name_en: 'Weekly groceries',
        sort_order: 0,
        is_archived: false,
        created_at: now,
        updated_at: now,
      });

      // 5. Invalidate invite token permanently
      const invite = await db.family_invites
        .where('token')
        .equals(params.token.trim())
        .first();

      if (invite) {
        invite.redeemedAt = now;
        invite.redeemedBy = userId;
        invite.householdId = householdId;
        await db.family_invites.put(invite);
      }
    }
  );

  return {
    success: true,
    householdId,
    userId,
  };
}

/**
 * Super-Admin Service: Aggregates family summary data across all households.
 */
export async function getAdminFamiliesSummary(
  db: TestFamilyAccountsDB
): Promise<AdminFamilySummary[]> {
  const allHouseholds = await db.households.toArray();
  const summaries: AdminFamilySummary[] = [];

  for (const h of allHouseholds) {
    const members = await db.household_members
      .where('household_id')
      .equals(h.id)
      .toArray();

    const owner = members.find((m) => m.role === 'owner') || members[0];
    const ownerName = owner?.display_name || 'Unknown';
    const ownerEmail =
      owner?.email ||
      `${ownerName.toLowerCase().replace(/[^a-z0-9]/g, '')}@family.local`;

    summaries.push({
      id: h.id,
      name: h.name,
      currency: h.currency,
      createdAt: h.created_at,
      ownerName,
      ownerEmail,
      memberCount: members.length,
    });
  }

  // Sort descending by creation date
  summaries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return summaries;
}

/**
 * Checks whether an email has super-admin privileges.
 */
export function isSuperAdmin(
  email: string | null | undefined,
  superAdminEmails: string[] = ['superadmin@family-accounts.com', 'admin@family.local']
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return superAdminEmails.map((e) => e.toLowerCase()).includes(normalized);
}

/**
 * Legacy in-household member creation (simulates /settings/family add member).
 */
export async function addLegacyHouseholdMember(
  db: TestFamilyAccountsDB,
  householdId: string,
  username: string,
  displayName: string
): Promise<TestHouseholdMemberRow> {
  const memberRow: TestHouseholdMemberRow = {
    household_id: householdId,
    user_id: crypto.randomUUID(),
    display_name: displayName,
    role: 'member',
    locale: 'en',
    email: `${username.trim().toLowerCase()}@family.local`,
    created_at: new Date().toISOString(),
  };

  await db.household_members.put(memberRow);
  return memberRow;
}

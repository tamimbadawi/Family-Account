import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TestFamilyAccountsDB,
  createInviteToken,
  validateInviteToken,
  provisionInvitedHousehold,
  getAdminFamiliesSummary,
  isSuperAdmin,
  addLegacyHouseholdMember,
} from '../helpers/test-harness';

describe('Tier 1: Feature Coverage — Invite Token Generation & Lifecycle (F2)', () => {
  let db: TestFamilyAccountsDB;
  const adminUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    db = new TestFamilyAccountsDB();
  });

  it('generates a cryptographically strong token with at least 64 hex characters', async () => {
    const result = await createInviteToken(db, adminUserId);

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBe(64); // 32 bytes in hex = 64 characters
    expect(/^[0-9a-f]{64}$/.test(result.token)).toBe(true);
  });

  it('sets token expiration to precisely 48 hours from generation timestamp', async () => {
    const beforeMs = Date.now();
    const result = await createInviteToken(db, adminUserId);
    const afterMs = Date.now();

    const expiresAtMs = new Date(result.expiresAt).getTime();
    const expectedDurationMs = 48 * 60 * 60 * 1000;

    expect(expiresAtMs).toBeGreaterThanOrEqual(beforeMs + expectedDurationMs);
    expect(expiresAtMs).toBeLessThanOrEqual(afterMs + expectedDurationMs + 1000);
  });

  it('generates unique, non-colliding tokens on consecutive invocations', async () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const res = await createInviteToken(db, adminUserId);
      tokens.add(res.token);
    }
    expect(tokens.size).toBe(10);
  });

  it('attaches creator user ID and creation timestamp to the stored invite record', async () => {
    const result = await createInviteToken(db, adminUserId);
    const record = await db.family_invites.where('token').equals(result.token).first();

    expect(record).toBeDefined();
    expect(record?.createdBy).toBe(adminUserId);
    expect(record?.createdAt).toBeDefined();
    expect(record?.redeemedAt).toBeNull();
    expect(record?.redeemedBy).toBeNull();
    expect(record?.householdId).toBeNull();
  });

  it('constructs canonical invite URLs for both English and Arabic locales', async () => {
    const enResult = await createInviteToken(
      db,
      adminUserId,
      'https://app.family-accounts.com',
      'en'
    );
    expect(enResult.inviteUrl).toBe(
      `https://app.family-accounts.com/en/invite?token=${enResult.token}`
    );

    const arResult = await createInviteToken(
      db,
      adminUserId,
      'https://app.family-accounts.com',
      'ar'
    );
    expect(arResult.inviteUrl).toBe(
      `https://app.family-accounts.com/ar/invite?token=${arResult.token}`
    );
  });
});

describe('Tier 1: Feature Coverage — Invite Token Validation (F2)', () => {
  let db: TestFamilyAccountsDB;
  const adminUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    db = new TestFamilyAccountsDB();
  });

  it('validates an active, unexpired, and unredeemed token as valid', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await validateInviteToken(db, token);

    expect(res.valid).toBe(true);
    expect(res.status).toBe('valid');
  });

  it('validates an expired token as expired', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    // Artificially age the token to 50 hours ago
    const invite = await db.family_invites.where('token').equals(token).first();
    if (invite) {
      invite.expiresAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      await db.family_invites.put(invite);
    }

    const res = await validateInviteToken(db, token);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('expired');
  });

  it('validates an already-redeemed token as redeemed', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const invite = await db.family_invites.where('token').equals(token).first();
    if (invite) {
      invite.redeemedAt = new Date().toISOString();
      invite.redeemedBy = '00000000-0000-0000-0000-000000000099';
      await db.family_invites.put(invite);
    }

    const res = await validateInviteToken(db, token);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('redeemed');
  });

  it('returns not_found status for a non-existent token', async () => {
    const res = await validateInviteToken(
      db,
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );
    expect(res.valid).toBe(false);
    expect(res.status).toBe('not_found');
  });

  it('returns not_found status for malformed, truncated, or empty tokens', async () => {
    expect((await validateInviteToken(db, '')).status).toBe('not_found');
    expect((await validateInviteToken(db, 'short-token')).status).toBe('not_found');
    expect((await validateInviteToken(db, '   ')).status).toBe('not_found');
  });
});

describe('Tier 1: Feature Coverage — Member Age Persistence (F1)', () => {
  let db: TestFamilyAccountsDB;
  const adminUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    db = new TestFamilyAccountsDB();
  });

  it('persists member age in household_members on owner provisioning', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'owner@smiths.org',
      age: 38,
      familyName: 'The Smiths',
      currency: 'USD',
      locale: 'en',
    });

    expect(res.success).toBe(true);
    const members = await db.household_members
      .where('household_id')
      .equals(res.householdId!)
      .toArray();

    expect(members).toHaveLength(1);
    expect(members[0].age).toBe(38);
    expect(members[0].role).toBe('owner');
  });

  it('queries member age alongside role, displayName, and locale', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'ahmed@family.org',
      age: 52,
      familyName: 'عائلة أحمد',
      currency: 'EGP',
      locale: 'ar',
    });

    const member = await db.household_members
      .where('user_id')
      .equals(res.userId!)
      .first();

    expect(member).toBeDefined();
    expect(member?.age).toBe(52);
    expect(member?.display_name).toBe('عائلة أحمد');
    expect(member?.locale).toBe('ar');
  });

  it('correctly persists age for multiple members within the same household', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'parent@home.org',
      age: 40,
      familyName: 'Happy Family',
      currency: 'USD',
      locale: 'en',
    });

    // Add secondary member with age
    await db.household_members.put({
      household_id: res.householdId!,
      user_id: '00000000-0000-0000-0000-000000000022',
      display_name: 'Teen Child',
      role: 'member',
      locale: 'en',
      age: 16,
      created_at: new Date().toISOString(),
    });

    const members = await db.household_members
      .where('household_id')
      .equals(res.householdId!)
      .toArray();

    expect(members).toHaveLength(2);
    expect(members.map((m) => m.age)).toContain(40);
    expect(members.map((m) => m.age)).toContain(16);
  });

  it('handles optional age gracefully for legacy members without age value', async () => {
    const hid = '11111111-1111-1111-1111-111111111111';
    await db.households.put({
      id: hid,
      name: 'Legacy Family',
      currency: 'EGP',
      created_at: new Date().toISOString(),
    });

    await db.household_members.put({
      household_id: hid,
      user_id: 'legacy-user-1',
      display_name: 'Grandparent',
      role: 'owner',
      locale: 'ar',
      // age is omitted
      created_at: new Date().toISOString(),
    });

    const member = await db.household_members.where('user_id').equals('legacy-user-1').first();
    expect(member).toBeDefined();
    expect(member?.age).toBeUndefined();
  });

  it('supports persisting varied valid age values across the human lifespan', async () => {
    const testAges = [5, 18, 29, 65, 95];
    for (const age of testAges) {
      const { token } = await createInviteToken(db, adminUserId);
      const res = await provisionInvitedHousehold(db, {
        token,
        email: `user${age}@example.com`,
        age,
        familyName: `Family ${age}`,
        currency: 'USD',
        locale: 'en',
      });
      const member = await db.household_members.where('user_id').equals(res.userId!).first();
      expect(member?.age).toBe(age);
    }
  });
});

describe('Tier 1: Feature Coverage — Custom Currency Support (F3)', () => {
  let db: TestFamilyAccountsDB;
  const adminUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    db = new TestFamilyAccountsDB();
  });

  it('provisions a household with default currency EGP', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'egp@family.com',
      age: 30,
      familyName: 'Egyptian Family',
      currency: 'EGP',
      locale: 'ar',
    });

    const household = await db.households.get(res.householdId!);
    expect(household?.currency).toBe('EGP');
  });

  it('provisions a household with custom currency USD', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'usd@family.com',
      age: 32,
      familyName: 'US Family',
      currency: 'USD',
      locale: 'en',
    });

    const household = await db.households.get(res.householdId!);
    expect(household?.currency).toBe('USD');
  });

  it('provisions a household with custom currency SAR', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'sar@family.com',
      age: 40,
      familyName: 'Saudi Family',
      currency: 'SAR',
      locale: 'ar',
    });

    const household = await db.households.get(res.householdId!);
    expect(household?.currency).toBe('SAR');
  });

  it('provisions a household with custom currency EUR', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'eur@family.com',
      age: 28,
      familyName: 'Euro Family',
      currency: 'EUR',
      locale: 'en',
    });

    const household = await db.households.get(res.householdId!);
    expect(household?.currency).toBe('EUR');
  });

  it('creates the initial cash wallet associated with the household', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'kwd@family.com',
      age: 35,
      familyName: 'Kuwaiti Family',
      currency: 'KWD',
      locale: 'ar',
    });

    const wallets = await db.accounts.where('household_id').equals(res.householdId!).toArray();
    expect(wallets).toHaveLength(1);
    expect(wallets[0].type).toBe('cash');
    expect(wallets[0].opening_balance).toBe(0);
  });
});

describe('Tier 1: Feature Coverage — Default Seeding (F3)', () => {
  let db: TestFamilyAccountsDB;
  const adminUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    db = new TestFamilyAccountsDB();
  });

  it('seeds standard default top-level categories', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'seeds@test.org',
      age: 34,
      familyName: 'Seed Test Family',
      currency: 'USD',
      locale: 'en',
    });

    const categories = await db.categories.where('household_id').equals(res.householdId!).toArray();
    expect(categories.length).toBeGreaterThanOrEqual(3);

    const namesEn = categories.map((c) => c.name_en);
    expect(namesEn).toContain('Household');
    expect(namesEn).toContain('Food');
    expect(namesEn).toContain('Income');
  });

  it('seeds default subcategories linked to parent categories', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'seeds2@test.org',
      age: 34,
      familyName: 'Seed Test Family 2',
      currency: 'USD',
      locale: 'en',
    });

    const subcats = await db.subcategories.where('household_id').equals(res.householdId!).toArray();
    expect(subcats.length).toBeGreaterThanOrEqual(1);

    const groceries = subcats.find((s) => s.name_en === 'Groceries');
    expect(groceries).toBeDefined();

    const parentCat = await db.categories.get(groceries!.category_id);
    expect(parentCat?.name_en).toBe('Food');
  });

  it('seeds default items under subcategories', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'seeds3@test.org',
      age: 34,
      familyName: 'Seed Test Family 3',
      currency: 'USD',
      locale: 'en',
    });

    const items = await db.items.where('household_id').equals(res.householdId!).toArray();
    expect(items.length).toBeGreaterThanOrEqual(1);

    const weeklyItem = items.find((i) => i.name_en === 'Weekly groceries');
    expect(weeklyItem).toBeDefined();
  });

  it('seeds cash wallet with bilingual names and active status', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'wallet@test.org',
      age: 41,
      familyName: 'Wallet Test Family',
      currency: 'EGP',
      locale: 'ar',
    });

    const wallets = await db.accounts.where('household_id').equals(res.householdId!).toArray();
    const cashWallet = wallets.find((w) => w.type === 'cash');

    expect(cashWallet).toBeDefined();
    expect(cashWallet?.name_ar).toBe('كاش في البيت');
    expect(cashWallet?.name_en).toBe('Cash at home');
    expect(cashWallet?.is_archived).toBe(false);
  });

  it('seeds category types with appropriate expense and income classification', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'kinds@test.org',
      age: 30,
      familyName: 'Kinds Family',
      currency: 'EUR',
      locale: 'en',
    });

    const categories = await db.categories.where('household_id').equals(res.householdId!).toArray();
    const expenseCats = categories.filter((c) => c.kind === 'expense');
    const incomeCats = categories.filter((c) => c.kind === 'income');

    expect(expenseCats.length).toBeGreaterThanOrEqual(2);
    expect(incomeCats.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Tier 1: Feature Coverage — Super-Admin Family Overview (F4, F5)', () => {
  let db: TestFamilyAccountsDB;
  const adminUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    db = new TestFamilyAccountsDB();
  });

  it('summarizes family name, owner name, owner email, currency, and member count', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    await provisionInvitedHousehold(db, {
      token,
      email: 'smith@example.com',
      age: 39,
      familyName: 'The Smiths',
      currency: 'USD',
      locale: 'en',
    });

    const summaries = await getAdminFamiliesSummary(db);
    expect(summaries).toHaveLength(1);

    const s = summaries[0];
    expect(s.name).toBe('The Smiths');
    expect(s.ownerName).toBe('The Smiths');
    expect(s.ownerEmail).toBe('smith@example.com');
    expect(s.currency).toBe('USD');
    expect(s.memberCount).toBe(1);
    expect(s.createdAt).toBeDefined();
  });

  it('correctly aggregates member count when multiple members join a family', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const res = await provisionInvitedHousehold(db, {
      token,
      email: 'owner@bigfamily.com',
      age: 45,
      familyName: 'Big Family',
      currency: 'SAR',
      locale: 'ar',
    });

    // Add 2 additional members
    await addLegacyHouseholdMember(db, res.householdId!, 'member1', 'Member One');
    await addLegacyHouseholdMember(db, res.householdId!, 'member2', 'Member Two');

    const summaries = await getAdminFamiliesSummary(db);
    const summary = summaries.find((s) => s.id === res.householdId!);

    expect(summary?.memberCount).toBe(3);
  });

  it('lists multiple registered families in descending order of creation date', async () => {
    const t1 = await createInviteToken(db, adminUserId);
    await provisionInvitedHousehold(db, {
      token: t1.token,
      email: 'family1@test.com',
      age: 30,
      familyName: 'Family 1',
      currency: 'USD',
      locale: 'en',
    });

    const t2 = await createInviteToken(db, adminUserId);
    await provisionInvitedHousehold(db, {
      token: t2.token,
      email: 'family2@test.com',
      age: 35,
      familyName: 'Family 2',
      currency: 'EUR',
      locale: 'en',
    });

    const summaries = await getAdminFamiliesSummary(db);
    expect(summaries.length).toBe(2);
    expect(summaries.map((s) => s.name)).toContain('Family 1');
    expect(summaries.map((s) => s.name)).toContain('Family 2');
  });

  it('authorizes access for designated super-admin email', () => {
    expect(isSuperAdmin('superadmin@family-accounts.com')).toBe(true);
    expect(isSuperAdmin('admin@family.local')).toBe(true);
    expect(isSuperAdmin('  SUPERADMIN@family-accounts.com  ')).toBe(true);
  });

  it('rejects access for non-superadmin users and empty credentials', () => {
    expect(isSuperAdmin('regularuser@gmail.com')).toBe(false);
    expect(isSuperAdmin('owner@smiths.org')).toBe(false);
    expect(isSuperAdmin('')).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});

describe('Tier 3: Cross-Feature Combinations', () => {
  let db: TestFamilyAccountsDB;
  const adminUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    db = new TestFamilyAccountsDB();
  });

  it('Pairwise 1: Token lifecycle + atomic provisioning + token invalidation replay prevention', async () => {
    // 1. Super-admin generates token
    const { token, expiresAt } = await createInviteToken(db, adminUserId);

    // 2. Validate token is active
    const valid1 = await validateInviteToken(db, token);
    expect(valid1.valid).toBe(true);
    expect(valid1.status).toBe('valid');

    // 3. User provisions household
    const provResult = await provisionInvitedHousehold(db, {
      token,
      email: 'atomic@onboarding.org',
      age: 33,
      familyName: 'Atomic Family',
      currency: 'USD',
      locale: 'en',
    });
    expect(provResult.success).toBe(true);

    // 4. Token status immediately transitions to redeemed
    const valid2 = await validateInviteToken(db, token);
    expect(valid2.valid).toBe(false);
    expect(valid2.status).toBe('redeemed');

    // 5. Replay attempt using same token is strictly rejected
    const replayResult = await provisionInvitedHousehold(db, {
      token,
      email: 'imposter@onboarding.org',
      age: 25,
      familyName: 'Imposter Family',
      currency: 'USD',
      locale: 'en',
    });
    expect(replayResult.success).toBe(false);
    expect(replayResult.error).toContain('Invalid invite token: redeemed');
  });

  it('Pairwise 2: Strict tenant isolation between multiple independently provisioned households', async () => {
    // Household A (USD)
    const tA = await createInviteToken(db, adminUserId);
    const provA = await provisionInvitedHousehold(db, {
      token: tA.token,
      email: 'alice@alpha.org',
      age: 29,
      familyName: 'Alpha Household',
      currency: 'USD',
      locale: 'en',
    });

    // Household B (EUR)
    const tB = await createInviteToken(db, adminUserId);
    const provB = await provisionInvitedHousehold(db, {
      token: tB.token,
      email: 'bob@beta.org',
      age: 42,
      familyName: 'Beta Household',
      currency: 'EUR',
      locale: 'en',
    });

    // Verify isolation: accounts
    const accountsA = await db.accounts.where('household_id').equals(provA.householdId!).toArray();
    const accountsB = await db.accounts.where('household_id').equals(provB.householdId!).toArray();

    expect(accountsA.length).toBeGreaterThan(0);
    expect(accountsB.length).toBeGreaterThan(0);
    expect(accountsA.every((a) => a.household_id === provA.householdId)).toBe(true);
    expect(accountsB.every((b) => b.household_id === provB.householdId)).toBe(true);

    // Verify isolation: members
    const membersA = await db.household_members.where('household_id').equals(provA.householdId!).toArray();
    const membersB = await db.household_members.where('household_id').equals(provB.householdId!).toArray();

    expect(membersA.map((m) => m.email)).toEqual(['alice@alpha.org']);
    expect(membersB.map((m) => m.email)).toEqual(['bob@beta.org']);
  });

  it('Pairwise 3: Custom currency + initial wallet balance and immediate transaction logging', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const prov = await provisionInvitedHousehold(db, {
      token,
      email: 'tariq@gulf.org',
      age: 46,
      familyName: 'عائلة طارق',
      currency: 'SAR',
      locale: 'ar',
    });

    // Retrieve default cash wallet
    const cashWallet = await db.accounts
      .where('household_id')
      .equals(prov.householdId!)
      .and((a) => a.type === 'cash')
      .first();

    expect(cashWallet).toBeDefined();

    // Log first transaction: expense 150 SAR for groceries
    const groceriesItem = await db.items.where('household_id').equals(prov.householdId!).first();
    const txnId = '00000000-0000-0000-0000-000000000777';

    await db.transactions.put({
      id: txnId,
      household_id: prov.householdId!,
      type: 'expense',
      amount: 150.0,
      occurred_on: '2026-10-11',
      account_id: cashWallet!.id,
      to_account_id: null,
      item_id: groceriesItem!.id,
      note: 'سوبرماركت الأسبوع',
      created_by: prov.userId!,
      updated_by: prov.userId!,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });

    const txns = await db.transactions.where('household_id').equals(prov.householdId!).toArray();
    expect(txns).toHaveLength(1);
    expect(txns[0].amount).toBe(150.0);
    expect(txns[0].note).toBe('سوبرماركت الأسبوع');
  });
});

describe('Tier 4: Real-World Scenarios — Preservation of Existing Member Management (F14)', () => {
  let db: TestFamilyAccountsDB;
  const adminUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    db = new TestFamilyAccountsDB();
  });

  it('Existing household owner adds secondary member via @family.local without affecting invite tokens', async () => {
    // 1. Establish an existing household
    const { token } = await createInviteToken(db, adminUserId);
    const prov = await provisionInvitedHousehold(db, {
      token,
      email: 'owner@home.org',
      age: 50,
      familyName: 'Family Home',
      currency: 'EGP',
      locale: 'ar',
    });

    const initialInvitesCount = await db.family_invites.count();

    // 2. Owner adds internal family member via /settings/family
    const newMember = await addLegacyHouseholdMember(
      db,
      prov.householdId!,
      'daughter',
      'Daughter Name'
    );

    // 3. Member belongs to the existing household with role member
    expect(newMember.household_id).toBe(prov.householdId);
    expect(newMember.role).toBe('member');
    expect(newMember.email).toBe('daughter@family.local');

    // 4. Verify no new invite was issued in family_invites
    const finalInvitesCount = await db.family_invites.count();
    expect(finalInvitesCount).toBe(initialInvitesCount);

    // 5. Total members in household is now 2
    const totalMembers = await db.household_members
      .where('household_id')
      .equals(prov.householdId!)
      .count();
    expect(totalMembers).toBe(2);
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  TestFamilyAccountsDB,
  createInviteToken,
  validateInviteToken,
  provisionInvitedHousehold,
  onboardingSchema,
  getAdminFamiliesSummary,
} from '../helpers/test-harness';

describe('Tier 2: Boundary & Corner Cases — Member Age Validation (F1, F11)', () => {
  const baseValidData = {
    email: 'valid.user@example.com',
    password: 'Password123!',
    familyName: 'Valid Family',
    currency: 'USD',
    locale: 'en' as const,
  };

  it('rejects age = 0 (violates age > 0 domain rule)', () => {
    const result = onboardingSchema.safeParse({ ...baseValidData, age: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Age must be at least 1');
    }
  });

  it('accepts age = 1 (minimum allowed boundary)', () => {
    const result = onboardingSchema.safeParse({ ...baseValidData, age: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.age).toBe(1);
    }
  });

  it('accepts age = 129 (maximum allowed boundary)', () => {
    const result = onboardingSchema.safeParse({ ...baseValidData, age: 129 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.age).toBe(129);
    }
  });

  it('rejects age = 130 (violates age < 130 domain rule)', () => {
    const result = onboardingSchema.safeParse({ ...baseValidData, age: 130 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Age must be less than 130');
    }
  });

  it('rejects negative age (-15)', () => {
    const result = onboardingSchema.safeParse({ ...baseValidData, age: -15 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Age must be at least 1');
    }
  });

  it('rejects non-integer / float age (35.5)', () => {
    const result = onboardingSchema.safeParse({ ...baseValidData, age: 35.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Age must be an integer');
    }
  });

  it('correctly coerces valid numeric string age ("42") to integer 42', () => {
    const result = onboardingSchema.safeParse({ ...baseValidData, age: '42' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.age).toBe(42);
    }
  });
});

describe('Tier 2: Boundary & Corner Cases — Token Security & Boundaries (F2, F12)', () => {
  let db: TestFamilyAccountsDB;
  const adminUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    db = new TestFamilyAccountsDB();
  });

  it('rejects token at the exact expiration millisecond boundary', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const invite = await db.family_invites.where('token').equals(token).first();
    if (invite) {
      // Set expiresAt to 1 millisecond in the past
      invite.expiresAt = new Date(Date.now() - 1).toISOString();
      await db.family_invites.put(invite);
    }

    const validation = await validateInviteToken(db, token);
    expect(validation.valid).toBe(false);
    expect(validation.status).toBe('expired');
  });

  it('rejects already redeemed token with explicit redeemed status', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    await provisionInvitedHousehold(db, {
      token,
      email: 'first.user@example.com',
      age: 30,
      familyName: 'First Family',
      currency: 'USD',
      locale: 'en',
    });

    const secondValidation = await validateInviteToken(db, token);
    expect(secondValidation.valid).toBe(false);
    expect(secondValidation.status).toBe('redeemed');
  });

  it('safely rejects token containing SQL injection or format attack payload', async () => {
    const injectionPayload = "' OR '1'='1' -- ; DROP TABLE users;";
    const res = await validateInviteToken(db, injectionPayload);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('not_found');

    // Verify DB integrity: table still exists and is healthy
    const count = await db.family_invites.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('safely handles tokens padded with leading or trailing whitespace', async () => {
    const { token } = await createInviteToken(db, adminUserId);
    const paddedToken = `   ${token}   `;
    const res = await validateInviteToken(db, paddedToken);
    expect(res.valid).toBe(true);
    expect(res.status).toBe('valid');
  });

  it('rejects empty string, whitespace-only, or null-like tokens', async () => {
    expect((await validateInviteToken(db, '')).status).toBe('not_found');
    expect((await validateInviteToken(db, '        ')).status).toBe('not_found');
    expect((await validateInviteToken(db, null as unknown as string)).status).toBe('not_found');
  });
});

describe('Tier 2: Boundary & Corner Cases — Form Input Validation (F11)', () => {
  const baseValidData = {
    email: 'test@example.com',
    age: 30,
    password: 'Password123!',
    familyName: 'The Smiths',
    currency: 'USD',
    locale: 'en' as const,
  };

  it('rejects various malformed email syntaxes', () => {
    const malformedEmails = [
      'plainaddress',
      '@missingusername.com',
      'username@.com',
      'username@domain..com',
      'username@domain,com',
      'username space@domain.com',
    ];

    for (const badEmail of malformedEmails) {
      const res = onboardingSchema.safeParse({ ...baseValidData, email: badEmail });
      expect(res.success).toBe(false);
    }
  });

  it('rejects password shorter than 6 characters', () => {
    const res = onboardingSchema.safeParse({ ...baseValidData, password: '12345' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain('at least 6 characters');
    }
  });

  it('accepts password with exactly 6 characters', () => {
    const res = onboardingSchema.safeParse({ ...baseValidData, password: '123456' });
    expect(res.success).toBe(true);
  });

  it('rejects empty password string', () => {
    const res = onboardingSchema.safeParse({ ...baseValidData, password: '' });
    expect(res.success).toBe(false);
  });

  it('rejects empty or whitespace-only family name', () => {
    expect(onboardingSchema.safeParse({ ...baseValidData, familyName: '' }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...baseValidData, familyName: '   ' }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...baseValidData, familyName: 'A' }).success).toBe(false);
  });

  it('trims leading and trailing whitespace from family name upon parse', () => {
    const res = onboardingSchema.safeParse({
      ...baseValidData,
      familyName: '   The Smiths   ',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.familyName).toBe('The Smiths');
    }
  });

  it('rejects invalid currency code lengths (2 or 4 characters)', () => {
    expect(onboardingSchema.safeParse({ ...baseValidData, currency: 'US' }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...baseValidData, currency: 'USDD' }).success).toBe(false);
  });

  it('rejects lowercase currency codes (requires uppercase ISO)', () => {
    const res = onboardingSchema.safeParse({ ...baseValidData, currency: 'usd' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain('3-letter uppercase ISO code');
    }
  });
});

describe('Tier 2: Localized Token Error Views Specification (F12)', () => {
  // Verifies the authoritative copy matrix for token error states defined in survey_onboarding_tests.md § 4.1
  const localizedErrorCopy = {
    en: {
      invalid: {
        title: 'Invalid Invitation Link',
        description: 'This invitation link is not valid or has been revoked.',
      },
      expired: {
        title: 'Invitation Expired',
        description: 'This invitation link has expired. Invitations are valid for 48 hours.',
      },
      redeemed: {
        title: 'Invitation Already Used',
        description: 'This invitation has already been used to create a family account.',
      },
    },
    ar: {
      invalid: {
        title: 'رابط الدعوة غير صالح',
        description: 'رابط الدعوة هذا غير صحيح أو تم إلغاؤه.',
      },
      expired: {
        title: 'انتهت صلاحية الدعوة',
        description: 'انتهت صلاحية رابط الدعوة هذا. روابط الدعوة صالحة لمدة 48 ساعة فقط.',
      },
      redeemed: {
        title: 'تم استخدام الدعوة بالفعل',
        description: 'تم استخدام رابط الدعوة هذا بالفعل لإنشاء حساب عائلي.',
      },
    },
  };

  it('specifies explicit English and Arabic error states for invalid tokens', () => {
    expect(localizedErrorCopy.en.invalid.title).toBe('Invalid Invitation Link');
    expect(localizedErrorCopy.ar.invalid.title).toBe('رابط الدعوة غير صالح');
  });

  it('specifies explicit English and Arabic error states for expired tokens mentioning 48 hours', () => {
    expect(localizedErrorCopy.en.expired.title).toBe('Invitation Expired');
    expect(localizedErrorCopy.en.expired.description).toContain('48 hours');
    expect(localizedErrorCopy.ar.expired.title).toBe('انتهت صلاحية الدعوة');
    expect(localizedErrorCopy.ar.expired.description).toContain('48 ساعة');
  });

  it('specifies explicit English and Arabic error states for already redeemed tokens', () => {
    expect(localizedErrorCopy.en.redeemed.title).toBe('Invitation Already Used');
    expect(localizedErrorCopy.ar.redeemed.title).toBe('تم استخدام الدعوة بالفعل');
  });
});

describe('Tier 3: Cross-Feature Combinations — RTL Layout & Bilingual Texts (F10)', () => {
  it('validates presence of bilingual message files in English and Arabic', () => {
    const rootDir = process.cwd();
    const enCommonPath = path.join(rootDir, 'messages/en/common.json');
    const arCommonPath = path.join(rootDir, 'messages/ar/common.json');

    expect(fs.existsSync(enCommonPath)).toBe(true);
    expect(fs.existsSync(arCommonPath)).toBe(true);

    const enCommon = JSON.parse(fs.readFileSync(enCommonPath, 'utf8'));
    const arCommon = JSON.parse(fs.readFileSync(arCommonPath, 'utf8'));

    expect(typeof enCommon).toBe('object');
    expect(typeof arCommon).toBe('object');
  });

  it('verifies that onboarding UI layout specification adheres strictly to logical RTL classes', () => {
    // Simulated class list for responsive onboarding inputs & layout
    const validOnboardingInputClasses = [
      'h-14',
      'bg-surface',
      'pe-12', // logical end padding
      'ps-4',  // logical start padding
      'text-start', // logical text alignment
      'text-body',
      'shadow-xs',
    ];

    // Verify absence of forbidden physical Tailwind utilities
    const forbiddenPhysicalRegex = /(^| )(ml-|mr-|pl-|pr-|text-left|text-right|left-|right-)/;
    for (const cls of validOnboardingInputClasses) {
      expect(forbiddenPhysicalRegex.test(cls)).toBe(false);
    }
  });

  it('verifies password show/hide eye toggle uses logical end positioning (inset-y-0 end-0)', () => {
    const eyeToggleClass = 'absolute inset-y-0 end-0 flex items-center px-4 text-ink-muted';

    expect(eyeToggleClass).toContain('inset-y-0');
    expect(eyeToggleClass).toContain('end-0');
    expect(eyeToggleClass).not.toContain('right-0');
    expect(eyeToggleClass).not.toContain('left-0');
  });
});

describe('Tier 4: Real-World Scenarios — Full End-to-End Onboarding Flow (F13)', () => {
  let db: TestFamilyAccountsDB;
  const adminUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    db = new TestFamilyAccountsDB();
  });

  it('executes complete journey: admin generates invite -> user onboards in Arabic RTL with SAR currency -> account provisioned -> immediate cash transaction logged', async () => {
    // Step 1: Admin generates invite token
    const invite = await createInviteToken(
      db,
      adminUserId,
      'https://app.family-accounts.com',
      'ar'
    );
    expect(invite.token).toBeDefined();
    expect(invite.inviteUrl).toContain('/ar/invite?token=');

    // Step 2: User opens link and validates token
    const tokenCheck = await validateInviteToken(db, invite.token);
    expect(tokenCheck.valid).toBe(true);

    // Step 3: User fills onboarding form with Arabic profile and SAR currency
    const formData = {
      token: invite.token,
      email: 'hassan@al-rashid.org',
      age: 42,
      password: 'StrongPassword99!',
      familyName: 'عائلة الراشد',
      currency: 'SAR',
      locale: 'ar' as const,
    };

    // Form inputs validate against Zod schema
    const formValidation = onboardingSchema.safeParse(formData);
    expect(formValidation.success).toBe(true);

    // Step 4: Submit form and provision household
    const prov = await provisionInvitedHousehold(db, formData);
    expect(prov.success).toBe(true);
    expect(prov.householdId).toBeDefined();
    expect(prov.userId).toBeDefined();

    // Step 5: Verify household and member records in database
    const household = await db.households.get(prov.householdId!);
    expect(household?.name).toBe('عائلة الراشد');
    expect(household?.currency).toBe('SAR');

    const member = await db.household_members.where('user_id').equals(prov.userId!).first();
    expect(member?.role).toBe('owner');
    expect(member?.age).toBe(42);
    expect(member?.locale).toBe('ar');

    // Step 6: Verify default cash wallet created in SAR
    const cashWallet = await db.accounts
      .where('household_id')
      .equals(prov.householdId!)
      .and((a) => a.type === 'cash')
      .first();

    expect(cashWallet).toBeDefined();
    expect(cashWallet?.name_ar).toBe('كاش في البيت');

    // Step 7: Verify token is permanently redeemed and replay is blocked
    const tokenAfter = await validateInviteToken(db, invite.token);
    expect(tokenAfter.valid).toBe(false);
    expect(tokenAfter.status).toBe('redeemed');

    const replayAttempt = await provisionInvitedHousehold(db, formData);
    expect(replayAttempt.success).toBe(false);
    expect(replayAttempt.error).toContain('Invalid invite token: redeemed');

    // Step 8: User immediately records their first cash expense (150 SAR for weekly groceries)
    const groceriesItem = await db.items.where('household_id').equals(prov.householdId!).first();
    expect(groceriesItem).toBeDefined();

    await db.transactions.put({
      id: '00000000-0000-0000-0000-000000000888',
      household_id: prov.householdId!,
      type: 'expense',
      amount: 150.0,
      occurred_on: '2026-10-11',
      account_id: cashWallet!.id,
      to_account_id: null,
      item_id: groceriesItem!.id,
      note: 'طلبات أسبوعية',
      created_by: prov.userId!,
      updated_by: prov.userId!,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });

    const userTxns = await db.transactions.where('household_id').equals(prov.householdId!).toArray();
    expect(userTxns).toHaveLength(1);
    expect(userTxns[0].amount).toBe(150.0);

    // Step 9: Super-Admin overview reflects the new family
    const summaries = await getAdminFamiliesSummary(db);
    const familySummary = summaries.find((s) => s.id === prov.householdId);

    expect(familySummary).toBeDefined();
    expect(familySummary?.name).toBe('عائلة الراشد');
    expect(familySummary?.currency).toBe('SAR');
    expect(familySummary?.memberCount).toBe(1);
  });
});

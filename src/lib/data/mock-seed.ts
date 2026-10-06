// =========================================================
// Mock Seed Data  ·  Family Accounts (حساباتنا)
// Bilingual category tree from seed_defaults in 0001_schema.sql
// Wallets: Cash (كاش) & Bank (البنك)
// Members: Mama (ماما) & Baba (بابا)
// ~120 realistic Egyptian household entries over the last 3 months
// =========================================================

import type {
  AccountRow,
  CategoryRow,
  HouseholdMemberRow,
  HouseholdRow,
  ItemRow,
  SubcategoryRow,
  TransactionRow,
} from './types';

export const DEMO_HOUSEHOLD_ID = '11111111-1111-1111-1111-111111111111';
export const USER_MAMA_ID = '22222222-2222-2222-2222-222222222222';
export const USER_BABA_ID = '33333333-3333-3333-3333-333333333333';

export const SEED_VERSION = 2;

export const WALLET_CASH_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
export const WALLET_BANK_ID = 'aaaaaaaa-0000-0000-0000-000000000002'; // NBE
export const WALLET_NBE_ID = WALLET_BANK_ID;
export const WALLET_CIB_ID = 'aaaaaaaa-0000-0000-0000-000000000003';
export const WALLET_BANQUE_MISR_ID = 'aaaaaaaa-0000-0000-0000-000000000004';

export const ITEM_EXPENSE_BALANCE_CORRECTION_ID = 'i0000007-0000-0000-0000-000000000001';
export const ITEM_INCOME_BALANCE_CORRECTION_ID = 'i0000007-0000-0000-0000-000000000002';

export const DEFAULT_HOUSEHOLD: HouseholdRow = {
  id: DEMO_HOUSEHOLD_ID,
  name: 'عائلتنا',
  currency: 'EGP',
  created_at: '2026-06-01T00:00:00.000Z',
};

export const DEFAULT_MEMBERS: HouseholdMemberRow[] = [
  {
    household_id: DEMO_HOUSEHOLD_ID,
    user_id: USER_MAMA_ID,
    display_name: 'ماما',
    role: 'owner',
    locale: 'ar',
    created_at: '2026-06-01T00:00:00.000Z',
  },
  {
    household_id: DEMO_HOUSEHOLD_ID,
    user_id: USER_BABA_ID,
    display_name: 'بابا',
    role: 'member',
    locale: 'ar',
    created_at: '2026-06-01T00:00:00.000Z',
  },
];

export const DEFAULT_WALLETS: AccountRow[] = [
  {
    id: WALLET_CASH_ID,
    household_id: DEMO_HOUSEHOLD_ID,
    name_ar: 'كاش',
    name_en: 'Cash',
    type: 'cash',
    opening_balance: 6000,
    icon: 'banknote',
    color: '#0F766E',
    sort_order: 0,
    is_archived: false,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: WALLET_BANK_ID,
    household_id: DEMO_HOUSEHOLD_ID,
    name_ar: 'البنك الأهلي',
    name_en: 'NBE',
    type: 'bank',
    opening_balance: 45000,
    icon: 'building-2',
    color: '#15803D',
    sort_order: 1,
    is_archived: false,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: WALLET_CIB_ID,
    household_id: DEMO_HOUSEHOLD_ID,
    name_ar: 'بنك CIB',
    name_en: 'CIB',
    type: 'bank',
    opening_balance: 30000,
    icon: 'building-2',
    color: '#1D4ED8',
    sort_order: 2,
    is_archived: false,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: WALLET_BANQUE_MISR_ID,
    household_id: DEMO_HOUSEHOLD_ID,
    name_ar: 'بنك مصر',
    name_en: 'Banque Misr',
    type: 'bank',
    opening_balance: 12000,
    icon: 'building-2',
    color: '#B91C1C',
    sort_order: 3,
    is_archived: false,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  },
];

export interface CategorySeedDef {
  id: string;
  kind: 'expense' | 'income';
  nameEn: string;
  nameAr: string;
  icon: string;
  color: string;
  subs: {
    id: string;
    nameEn: string;
    nameAr: string;
    items: {
      id: string;
      nameEn: string;
      nameAr: string;
    }[];
  }[];
}

export const CATEGORY_TREE_DEF: CategorySeedDef[] = [
  {
    id: 'c0000001-0000-0000-0000-000000000001',
    kind: 'expense',
    nameEn: 'Household',
    nameAr: 'المنزل',
    icon: 'house',
    color: '#0F766E',
    subs: [
      {
        id: 's0000001-0000-0000-0000-000000000001',
        nameEn: 'Utilities',
        nameAr: 'المرافق',
        items: [
          { id: 'i0000001-0000-0000-0000-000000000001', nameEn: 'Electricity', nameAr: 'كهرباء' },
          { id: 'i0000001-0000-0000-0000-000000000002', nameEn: 'Water', nameAr: 'مياه' },
          { id: 'i0000001-0000-0000-0000-000000000003', nameEn: 'Gas', nameAr: 'غاز' },
          { id: 'i0000001-0000-0000-0000-000000000004', nameEn: 'Internet', nameAr: 'إنترنت' },
          { id: 'i0000001-0000-0000-0000-000000000005', nameEn: 'Mobile', nameAr: 'موبايل' },
        ],
      },
      {
        id: 's0000001-0000-0000-0000-000000000002',
        nameEn: 'Rent & upkeep',
        nameAr: 'إيجار وصيانة',
        items: [
          { id: 'i0000001-0000-0000-0000-000000000006', nameEn: 'Rent', nameAr: 'إيجار' },
          { id: 'i0000001-0000-0000-0000-000000000007', nameEn: 'Repairs', nameAr: 'تصليحات' },
          { id: 'i0000001-0000-0000-0000-000000000008', nameEn: 'Building fees', nameAr: 'مصاريف العمارة' },
        ],
      },
    ],
  },
  {
    id: 'c0000002-0000-0000-0000-000000000002',
    kind: 'expense',
    nameEn: 'Food',
    nameAr: 'الطعام',
    icon: 'shopping-basket',
    color: '#B45309',
    subs: [
      {
        id: 's0000002-0000-0000-0000-000000000001',
        nameEn: 'Groceries',
        nameAr: 'البقالة',
        items: [
          { id: 'i0000002-0000-0000-0000-000000000001', nameEn: 'Supermarket', nameAr: 'سوبرماركت' },
          { id: 'i0000002-0000-0000-0000-000000000002', nameEn: 'Vegetables & fruit', nameAr: 'خضار وفاكهة' },
          { id: 'i0000002-0000-0000-0000-000000000003', nameEn: 'Meat & poultry', nameAr: 'لحوم ودواجن' },
          { id: 'i0000002-0000-0000-0000-000000000004', nameEn: 'Bread', nameAr: 'عيش' },
        ],
      },
      {
        id: 's0000002-0000-0000-0000-000000000002',
        nameEn: 'Eating out',
        nameAr: 'أكل برّه',
        items: [
          { id: 'i0000002-0000-0000-0000-000000000005', nameEn: 'Restaurants', nameAr: 'مطاعم' },
          { id: 'i0000002-0000-0000-0000-000000000006', nameEn: 'Delivery', nameAr: 'دليفري' },
        ],
      },
    ],
  },
  {
    id: 'c0000003-0000-0000-0000-000000000003',
    kind: 'expense',
    nameEn: 'Transport',
    nameAr: 'المواصلات',
    icon: 'car',
    color: '#1D4ED8',
    subs: [
      {
        id: 's0000003-0000-0000-0000-000000000001',
        nameEn: 'Car',
        nameAr: 'العربية',
        items: [
          { id: 'i0000003-0000-0000-0000-000000000001', nameEn: 'Fuel', nameAr: 'بنزين' },
          { id: 'i0000003-0000-0000-0000-000000000002', nameEn: 'Maintenance', nameAr: 'صيانة' },
          { id: 'i0000003-0000-0000-0000-000000000003', nameEn: 'Parking', nameAr: 'ركنة' },
        ],
      },
      {
        id: 's0000003-0000-0000-0000-000000000002',
        nameEn: 'Rides',
        nameAr: 'مشاوير',
        items: [
          { id: 'i0000003-0000-0000-0000-000000000004', nameEn: 'Taxi & ride apps', nameAr: 'تاكسي وتطبيقات' },
        ],
      },
    ],
  },
  {
    id: 'c0000004-0000-0000-0000-000000000004',
    kind: 'expense',
    nameEn: 'Health',
    nameAr: 'الصحة',
    icon: 'heart-pulse',
    color: '#BE123C',
    subs: [
      {
        id: 's0000004-0000-0000-0000-000000000001',
        nameEn: 'Medical',
        nameAr: 'طبي',
        items: [
          { id: 'i0000004-0000-0000-0000-000000000001', nameEn: 'Pharmacy', nameAr: 'صيدلية' },
          { id: 'i0000004-0000-0000-0000-000000000002', nameEn: 'Doctor', nameAr: 'دكتور' },
          { id: 'i0000004-0000-0000-0000-000000000003', nameEn: 'Lab tests', nameAr: 'تحاليل' },
        ],
      },
    ],
  },
  {
    id: 'c0000005-0000-0000-0000-000000000005',
    kind: 'expense',
    nameEn: 'Family',
    nameAr: 'العائلة',
    icon: 'users',
    color: '#7C3AED',
    subs: [
      {
        id: 's0000005-0000-0000-0000-000000000001',
        nameEn: 'Gifts & occasions',
        nameAr: 'هدايا ومناسبات',
        items: [
          { id: 'i0000005-0000-0000-0000-000000000001', nameEn: 'Gifts', nameAr: 'هدايا' },
          { id: 'i0000005-0000-0000-0000-000000000002', nameEn: 'Charity', nameAr: 'صدقات' },
        ],
      },
    ],
  },
  {
    id: 'c0000006-0000-0000-0000-000000000006',
    kind: 'income',
    nameEn: 'Income',
    nameAr: 'الدخل',
    icon: 'wallet',
    color: '#15803D',
    subs: [
      {
        id: 's0000006-0000-0000-0000-000000000001',
        nameEn: 'Regular',
        nameAr: 'دخل ثابت',
        items: [
          { id: 'i0000006-0000-0000-0000-000000000001', nameEn: 'Pension', nameAr: 'معاش' },
          { id: 'i0000006-0000-0000-0000-000000000002', nameEn: 'Salary', nameAr: 'مرتب' },
          { id: 'i0000006-0000-0000-0000-000000000003', nameEn: 'Rent received', nameAr: 'إيجار' },
        ],
      },
      {
        id: 's0000006-0000-0000-0000-000000000002',
        nameEn: 'Other',
        nameAr: 'أخرى',
        items: [
          { id: 'i0000006-0000-0000-0000-000000000004', nameEn: 'Gifts received', nameAr: 'هدايا' },
          { id: 'i0000006-0000-0000-0000-000000000005', nameEn: 'Other', nameAr: 'أخرى' },
        ],
      },
    ],
  },
  {
    id: 'c0000007-0000-0000-0000-000000000001',
    kind: 'expense',
    nameEn: 'Adjustments',
    nameAr: 'تسويات',
    icon: 'scale',
    color: '#64748B',
    subs: [
      {
        id: 's0000007-0000-0000-0000-000000000001',
        nameEn: 'Balance correction',
        nameAr: 'تصحيح الرصيد',
        items: [
          {
            id: ITEM_EXPENSE_BALANCE_CORRECTION_ID,
            nameEn: 'Balance correction',
            nameAr: 'تصحيح الرصيد',
          },
        ],
      },
    ],
  },
  {
    id: 'c0000007-0000-0000-0000-000000000002',
    kind: 'income',
    nameEn: 'Adjustments',
    nameAr: 'تسويات',
    icon: 'scale',
    color: '#64748B',
    subs: [
      {
        id: 's0000007-0000-0000-0000-000000000002',
        nameEn: 'Balance correction',
        nameAr: 'تصحيح الرصيد',
        items: [
          {
            id: ITEM_INCOME_BALANCE_CORRECTION_ID,
            nameEn: 'Balance correction',
            nameAr: 'تصحيح الرصيد',
          },
        ],
      },
    ],
  },
];

// Helper to flatten categories, subcategories, items for insertion
export function getFlattenedCategoryTree(householdId = DEMO_HOUSEHOLD_ID) {
  const categories: CategoryRow[] = [];
  const subcategories: SubcategoryRow[] = [];
  const items: ItemRow[] = [];

  CATEGORY_TREE_DEF.forEach((c, cIdx) => {
    categories.push({
      id: c.id,
      household_id: householdId,
      kind: c.kind,
      name_ar: c.nameAr,
      name_en: c.nameEn,
      icon: c.icon,
      color: c.color,
      sort_order: cIdx,
      is_archived: false,
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    });

    c.subs.forEach((s, sIdx) => {
      subcategories.push({
        id: s.id,
        household_id: householdId,
        category_id: c.id,
        name_ar: s.nameAr,
        name_en: s.nameEn,
        sort_order: sIdx,
        is_archived: false,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      });

      s.items.forEach((i, iIdx) => {
        items.push({
          id: i.id,
          household_id: householdId,
          subcategory_id: s.id,
          name_ar: i.nameAr,
          name_en: i.nameEn,
          sort_order: iIdx,
          is_archived: false,
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-01T00:00:00.000Z',
        });
      });
    });
  });

  return { categories, subcategories, items };
}

// Compute local date string YYYY-MM-DD
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Generates ~120 realistic entries over the last 3 months
export function generateRealisticEntries(
  baseDate: Date = new Date(),
  householdId = DEMO_HOUSEHOLD_ID
): TransactionRow[] {
  const entries: TransactionRow[] = [];
  let entrySeq = 1;

  function makeId(): string {
    const seqHex = entrySeq.toString(16).padStart(12, '0');
    entrySeq++;
    return `e0000000-0000-0000-0000-${seqHex}`;
  }

  // Pre-identified items
  const items = {
    // Utilities
    electricity: 'i0000001-0000-0000-0000-000000000001',
    water: 'i0000001-0000-0000-0000-000000000002',
    gas: 'i0000001-0000-0000-0000-000000000003',
    internet: 'i0000001-0000-0000-0000-000000000004',
    mobile: 'i0000001-0000-0000-0000-000000000005',
    buildingFees: 'i0000001-0000-0000-0000-000000000008',
    // Food
    supermarket: 'i0000002-0000-0000-0000-000000000001',
    vegetables: 'i0000002-0000-0000-0000-000000000002',
    meat: 'i0000002-0000-0000-0000-000000000003',
    bread: 'i0000002-0000-0000-0000-000000000004',
    restaurants: 'i0000002-0000-0000-0000-000000000005',
    delivery: 'i0000002-0000-0000-0000-000000000006',
    // Transport
    fuel: 'i0000003-0000-0000-0000-000000000001',
    carMaintenance: 'i0000003-0000-0000-0000-000000000002',
    rides: 'i0000003-0000-0000-0000-000000000004',
    // Health
    pharmacy: 'i0000004-0000-0000-0000-000000000001',
    doctor: 'i0000004-0000-0000-0000-000000000002',
    lab: 'i0000004-0000-0000-0000-000000000003',
    // Family
    charity: 'i0000005-0000-0000-0000-000000000002',
    gifts: 'i0000005-0000-0000-0000-000000000001',
    // Income
    pension: 'i0000006-0000-0000-0000-000000000001',
    rentReceived: 'i0000006-0000-0000-0000-000000000003',
  };

  // We generate entries across 3 months: month -2, month -1, and month 0 (current month)
  // For each month m in [2, 1, 0] (where m=0 is current month):
  for (let mOffset = 2; mOffset >= 0; mOffset--) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth() - mOffset;
    const targetDate = new Date(year, month, 1);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    // Determine how many days to simulate in this month:
    // If it's the current month (mOffset === 0), simulate up to baseDate.getDate() or minimum 6 days
    let maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    if (mOffset === 0) {
      maxDay = Math.min(maxDay, Math.max(6, baseDate.getDate()));
    }

    const dateStr = (day: number) => {
      const clampedDay = Math.min(day, maxDay);
      const d = new Date(targetYear, targetMonth, clampedDay);
      return toLocalDateString(d);
    };

    // 1. Regular Monthly Income: Pension on day 1 (18,500 EGP to Bank)
    entries.push({
      id: makeId(),
      household_id: householdId,
      type: 'income',
      amount: 18500,
      occurred_on: dateStr(1),
      account_id: WALLET_BANK_ID,
      to_account_id: null,
      item_id: items.pension,
      note: 'معاش شهر ' + (targetMonth + 1),
      created_by: USER_BABA_ID,
      updated_by: null,
      created_at: new Date(targetYear, targetMonth, 1, 9, 0).toISOString(),
      updated_at: new Date(targetYear, targetMonth, 1, 9, 0).toISOString(),
      deleted_at: null,
    });

    // 2. Rent received: Day 5 (6,000 EGP to CIB)
    if (maxDay >= 5) {
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'income',
        amount: 6000,
        occurred_on: dateStr(5),
        account_id: WALLET_CIB_ID,
        to_account_id: null,
        item_id: items.rentReceived,
        note: 'إيجار شقة العمارة',
        created_by: USER_BABA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 5, 10, 30).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 5, 10, 30).toISOString(),
        deleted_at: null,
      });
    }

    // 3. ATM Transfer: Bank -> Cash (Day 2: 5000 EGP from NBE)
    if (maxDay >= 2) {
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'transfer',
        amount: 5000,
        occurred_on: dateStr(2),
        account_id: WALLET_BANK_ID,
        to_account_id: WALLET_CASH_ID,
        item_id: null,
        note: 'سحب كاش من الـ ATM للمصاريف',
        created_by: USER_BABA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 2, 11, 0).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 2, 11, 0).toISOString(),
        deleted_at: null,
      });
    }

    // Second ATM Transfer if mid-month reached (Day 16: 4000 EGP from Banque Misr)
    if (maxDay >= 16) {
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'transfer',
        amount: 4000,
        occurred_on: dateStr(16),
        account_id: WALLET_BANQUE_MISR_ID,
        to_account_id: WALLET_CASH_ID,
        item_id: null,
        note: 'سحب كاش نص الشهر',
        created_by: USER_BABA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 16, 12, 0).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 16, 12, 0).toISOString(),
        deleted_at: null,
      });
    }

    // 4. Building fees: Day 3 (500 EGP)
    if (maxDay >= 3) {
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'expense',
        amount: 500,
        occurred_on: dateStr(3),
        account_id: WALLET_CASH_ID,
        to_account_id: null,
        item_id: items.buildingFees,
        note: 'مصاريف البواب والأسانسير',
        created_by: USER_BABA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 3, 14, 0).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 3, 14, 0).toISOString(),
        deleted_at: null,
      });
    }

    // 5. Electricity: Day 4 (300-900 EGP, e.g. 680 EGP)
    if (maxDay >= 4) {
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'expense',
        amount: 680 + (mOffset * 40),
        occurred_on: dateStr(4),
        account_id: WALLET_CASH_ID,
        to_account_id: null,
        item_id: items.electricity,
        note: 'فاتورة الكهرباء كود فوري',
        created_by: USER_BABA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 4, 15, 0).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 4, 15, 0).toISOString(),
        deleted_at: null,
      });
    }

    // 6. Water: Day 6 (180 EGP)
    if (maxDay >= 6) {
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'expense',
        amount: 180,
        occurred_on: dateStr(6),
        account_id: WALLET_CASH_ID,
        to_account_id: null,
        item_id: items.water,
        note: 'وصل المياه',
        created_by: USER_BABA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 6, 10, 0).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 6, 10, 0).toISOString(),
        deleted_at: null,
      });
    }

    // 7. Gas: Day 8 (140 EGP)
    if (maxDay >= 8) {
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'expense',
        amount: 140,
        occurred_on: dateStr(8),
        account_id: WALLET_CASH_ID,
        to_account_id: null,
        item_id: items.gas,
        note: 'شحن كارت الغاز',
        created_by: USER_MAMA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 8, 12, 0).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 8, 12, 0).toISOString(),
        deleted_at: null,
      });
    }

    // 8. Internet: Day 12 (450 EGP)
    if (maxDay >= 12) {
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'expense',
        amount: 450,
        occurred_on: dateStr(12),
        account_id: WALLET_BANK_ID,
        to_account_id: null,
        item_id: items.internet,
        note: 'اشتراك وي إنترنت منزلي',
        created_by: USER_BABA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 12, 16, 0).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 12, 16, 0).toISOString(),
        deleted_at: null,
      });
    }

    // 9. Mobile bills: Day 15 (220 EGP Mama, 220 EGP Baba)
    if (maxDay >= 15) {
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'expense',
        amount: 220,
        occurred_on: dateStr(15),
        account_id: WALLET_BANK_ID,
        to_account_id: null,
        item_id: items.mobile,
        note: 'باقة فودافون ماما',
        created_by: USER_MAMA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 15, 11, 0).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 15, 11, 0).toISOString(),
        deleted_at: null,
      });
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'expense',
        amount: 220,
        occurred_on: dateStr(15),
        account_id: WALLET_BANK_ID,
        to_account_id: null,
        item_id: items.mobile,
        note: 'باقة فودافون بابا',
        created_by: USER_BABA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 15, 11, 30).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 15, 11, 30).toISOString(),
        deleted_at: null,
      });
    }

    // Food & Groceries recurring patterns (150-1500 EGP)
    const foodItems = [
      { day: 1, item: items.supermarket, amount: 850, wallet: WALLET_BANK_ID, creator: USER_MAMA_ID, note: 'طلبات أول الشهر كازيون' },
      { day: 2, item: items.vegetables, amount: 240, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'سوق الخضار' },
      { day: 3, item: items.meat, amount: 1100, wallet: WALLET_CASH_ID, creator: USER_BABA_ID, note: 'جزارة التوفيق' },
      { day: 4, item: items.bread, amount: 45, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'عيش بلدي وفيزو' },
      { day: 5, item: items.supermarket, amount: 420, wallet: WALLET_BANK_ID, creator: USER_MAMA_ID, note: 'ألبان واجبان' },
      { day: 7, item: items.vegetables, amount: 190, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'فاكهة للمنزل' },
      { day: 9, item: items.supermarket, amount: 650, wallet: WALLET_BANK_ID, creator: USER_MAMA_ID, note: 'هايبر وان منظفات ومستلزمات' },
      { day: 10, item: items.meat, amount: 950, wallet: WALLET_CASH_ID, creator: USER_BABA_ID, note: 'فراخ وبانيه' },
      { day: 11, item: items.bread, amount: 50, wallet: WALLET_CASH_ID, creator: USER_BABA_ID, note: 'مخبز' },
      { day: 13, item: items.vegetables, amount: 260, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'طماطم وبطاطس وخضار' },
      { day: 14, item: items.supermarket, amount: 720, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'سوبرماركت أولاد رجب' },
      { day: 17, item: items.meat, amount: 1350, wallet: WALLET_BANK_ID, creator: USER_BABA_ID, note: 'لحمة للشهر' },
      { day: 18, item: items.vegetables, amount: 210, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'فاكهة' },
      { day: 19, item: items.bread, amount: 60, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'عيش' },
      { day: 20, item: items.supermarket, amount: 530, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'بقالة' },
      { day: 22, item: items.restaurants, amount: 480, wallet: WALLET_BANK_ID, creator: USER_BABA_ID, note: 'غداء بره' },
      { day: 24, item: items.vegetables, amount: 175, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'خضار' },
      { day: 25, item: items.delivery, amount: 320, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'دليفري كشري' },
      { day: 26, item: items.supermarket, amount: 390, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'لبن وزبادي' },
      { day: 27, item: items.bread, amount: 40, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'عيش' },
    ];

    for (const f of foodItems) {
      if (f.day <= maxDay) {
        entries.push({
          id: makeId(),
          household_id: householdId,
          type: 'expense',
          amount: f.amount,
          occurred_on: dateStr(f.day),
          account_id: f.wallet,
          to_account_id: null,
          item_id: f.item,
          note: f.note,
          created_by: f.creator,
          updated_by: null,
          created_at: new Date(targetYear, targetMonth, f.day, 13, 0).toISOString(),
          updated_at: new Date(targetYear, targetMonth, f.day, 13, 0).toISOString(),
          deleted_at: null,
        });
      }
    }

    // Transport (Fuel & Rides)
    const transportItems = [
      { day: 3, item: items.fuel, amount: 450, wallet: WALLET_CASH_ID, creator: USER_BABA_ID, note: 'بنزين 92' },
      { day: 10, item: items.fuel, amount: 420, wallet: WALLET_CASH_ID, creator: USER_BABA_ID, note: 'بنزين' },
      { day: 17, item: items.fuel, amount: 480, wallet: WALLET_CASH_ID, creator: USER_BABA_ID, note: 'بنزين' },
      { day: 24, item: items.fuel, amount: 460, wallet: WALLET_CASH_ID, creator: USER_BABA_ID, note: 'بنزين' },
      { day: 6, item: items.rides, amount: 85, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'أوبر للدكتور' },
      { day: 21, item: items.rides, amount: 110, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'تاكسي مشوار' },
    ];

    for (const t of transportItems) {
      if (t.day <= maxDay) {
        entries.push({
          id: makeId(),
          household_id: householdId,
          type: 'expense',
          amount: t.amount,
          occurred_on: dateStr(t.day),
          account_id: t.wallet,
          to_account_id: null,
          item_id: t.item,
          note: t.note,
          created_by: t.creator,
          updated_by: null,
          created_at: new Date(targetYear, targetMonth, t.day, 10, 0).toISOString(),
          updated_at: new Date(targetYear, targetMonth, t.day, 10, 0).toISOString(),
          deleted_at: null,
        });
      }
    }

    // Health (Pharmacy & Doctor)
    const healthItems = [
      { day: 4, item: items.pharmacy, amount: 460, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'أدوية الضغط والسكر الشهرية' },
      { day: 14, item: items.pharmacy, amount: 280, wallet: WALLET_CASH_ID, creator: USER_BABA_ID, note: 'صيدلية العزبي فيتامينات' },
      { day: 22, item: items.pharmacy, amount: 190, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'مسكن ومستلزمات' },
    ];

    for (const h of healthItems) {
      if (h.day <= maxDay) {
        entries.push({
          id: makeId(),
          household_id: householdId,
          type: 'expense',
          amount: h.amount,
          occurred_on: dateStr(h.day),
          account_id: h.wallet,
          to_account_id: null,
          item_id: h.item,
          note: h.note,
          created_by: h.creator,
          updated_by: null,
          created_at: new Date(targetYear, targetMonth, h.day, 18, 0).toISOString(),
          updated_at: new Date(targetYear, targetMonth, h.day, 18, 0).toISOString(),
          deleted_at: null,
        });
      }
    }

    // Occasional Doctor / Lab
    if (mOffset === 1 && maxDay >= 7) {
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'expense',
        amount: 600,
        occurred_on: dateStr(7),
        account_id: WALLET_CASH_ID,
        to_account_id: null,
        item_id: items.doctor,
        note: 'كشف استشاري باطنة',
        created_by: USER_MAMA_ID,
        updated_by: null,
        created_at: new Date(targetYear, targetMonth, 7, 19, 0).toISOString(),
        updated_at: new Date(targetYear, targetMonth, 7, 19, 0).toISOString(),
        deleted_at: null,
      });
    }

    // Charity / Family
    const familyItems = [
      { day: 1, item: items.charity, amount: 500, wallet: WALLET_CASH_ID, creator: USER_MAMA_ID, note: 'صدقة أول الشهر' },
      { day: 15, item: items.charity, amount: 300, wallet: WALLET_CASH_ID, creator: USER_BABA_ID, note: 'مساعدة شهرية' },
    ];

    for (const fam of familyItems) {
      if (fam.day <= maxDay) {
        entries.push({
          id: makeId(),
          household_id: householdId,
          type: 'expense',
          amount: fam.amount,
          occurred_on: dateStr(fam.day),
          account_id: fam.wallet,
          to_account_id: null,
          item_id: fam.item,
          note: fam.note,
          created_by: fam.creator,
          updated_by: null,
          created_at: new Date(targetYear, targetMonth, fam.day, 12, 0).toISOString(),
          updated_at: new Date(targetYear, targetMonth, fam.day, 12, 0).toISOString(),
          deleted_at: null,
        });
      }
    }
  }

  // If early in current month, add extra entries to past months so total is ~120
  if (entries.length < 110) {
    const extraNeeded = 120 - entries.length;
    for (let i = 0; i < extraNeeded; i++) {
      const monthOffset = (i % 2) + 1; // 1 or 2 months ago
      const day = ((i * 3) % 25) + 1;
      const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() - monthOffset, day);
      const isSupermarket = i % 2 === 0;
      entries.push({
        id: makeId(),
        household_id: householdId,
        type: 'expense',
        amount: isSupermarket ? 280 + (i * 15) : 85 + (i * 5),
        occurred_on: toLocalDateString(targetDate),
        account_id: i % 3 === 0 ? WALLET_BANK_ID : WALLET_CASH_ID,
        to_account_id: null,
        item_id: isSupermarket ? items.supermarket : items.bread,
        note: isSupermarket ? 'مشتريات بقالة إضافية' : 'مخبز بلدي',
        created_by: i % 2 === 0 ? USER_MAMA_ID : USER_BABA_ID,
        updated_by: null,
        created_at: new Date(targetDate.getFullYear(), targetDate.getMonth(), day, 11, 0).toISOString(),
        updated_at: new Date(targetDate.getFullYear(), targetDate.getMonth(), day, 11, 0).toISOString(),
        deleted_at: null,
      });
    }
  }

  return entries;
}

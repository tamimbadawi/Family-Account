import { describe, expect, it } from 'vitest';
import {
  roundMoney,
  toAccountRow,
  toCategory,
  toCategoryRow,
  toEntry,
  toHousehold,
  toHouseholdRow,
  toItem,
  toItemRow,
  toMember,
  toMemberRow,
  toSubcategory,
  toSubcategoryRow,
  toTransactionRow,
  toWallet,
} from './mappers';
import type {
  AccountRow,
  CategoryRow,
  HouseholdMemberRow,
  HouseholdRow,
  ItemRow,
  SubcategoryRow,
  TransactionRow,
} from './types';

describe('mappers', () => {
  it('roundMoney correctly rounds numbers to 2 decimal places', () => {
    expect(roundMoney(10.555)).toBe(10.56);
    expect(roundMoney(10.554)).toBe(10.55);
    expect(roundMoney(100)).toBe(100);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('converts household row to domain and back', () => {
    const row: HouseholdRow = {
      id: 'h-1',
      name: 'Family',
      currency: 'EGP',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const domain = toHousehold(row);
    expect(domain).toEqual({
      id: 'h-1',
      name: 'Family',
      currency: 'EGP',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(toHouseholdRow(domain)).toEqual(row);
  });

  it('converts member row to domain and back', () => {
    const row: HouseholdMemberRow = {
      household_id: 'h-1',
      user_id: 'u-1',
      display_name: 'ماما',
      role: 'owner',
      locale: 'ar',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const domain = toMember(row);
    expect(domain).toEqual({
      householdId: 'h-1',
      userId: 'u-1',
      displayName: 'ماما',
      role: 'owner',
      locale: 'ar',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(toMemberRow(domain)).toEqual(row);
  });

  it('converts account/wallet row to domain and back', () => {
    const row: AccountRow = {
      id: 'w-1',
      household_id: 'h-1',
      name_ar: 'كاش',
      name_en: 'Cash',
      type: 'cash',
      opening_balance: 5000.5,
      icon: 'banknote',
      color: '#0F766E',
      sort_order: 1,
      is_archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const domain = toWallet(row);
    expect(domain.openingBalance).toBe(5000.5);
    expect(domain.nameAr).toBe('كاش');
    expect(toAccountRow(domain)).toEqual(row);
  });

  it('converts category row to domain and back', () => {
    const row: CategoryRow = {
      id: 'c-1',
      household_id: 'h-1',
      kind: 'expense',
      name_ar: 'المنزل',
      name_en: 'Household',
      icon: 'house',
      color: '#0F766E',
      sort_order: 0,
      is_archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const domain = toCategory(row);
    expect(domain.kind).toBe('expense');
    expect(domain.nameEn).toBe('Household');
    expect(toCategoryRow(domain)).toEqual(row);
  });

  it('converts subcategory row to domain and back', () => {
    const row: SubcategoryRow = {
      id: 's-1',
      household_id: 'h-1',
      category_id: 'c-1',
      name_ar: 'المرافق',
      name_en: 'Utilities',
      sort_order: 0,
      is_archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const domain = toSubcategory(row);
    expect(domain.categoryId).toBe('c-1');
    expect(toSubcategoryRow(domain)).toEqual(row);
  });

  it('converts item row to domain and back', () => {
    const row: ItemRow = {
      id: 'i-1',
      household_id: 'h-1',
      subcategory_id: 's-1',
      name_ar: 'كهرباء',
      name_en: 'Electricity',
      sort_order: 0,
      is_archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const domain = toItem(row);
    expect(domain.subcategoryId).toBe('s-1');
    expect(toItemRow(domain)).toEqual(row);
  });

  it('converts transaction row to entry and back', () => {
    const row: TransactionRow = {
      id: 't-1',
      household_id: 'h-1',
      type: 'expense',
      amount: 450.75,
      occurred_on: '2026-10-06',
      account_id: 'w-1',
      to_account_id: null,
      item_id: 'i-1',
      note: 'فاتورة الكهرباء',
      photo_path: 'h-1/t-1.jpg',
      created_by: 'u-1',
      updated_by: null,
      created_at: '2026-10-06T10:00:00.000Z',
      updated_at: '2026-10-06T10:00:00.000Z',
      deleted_at: null,
    };
    const domain = toEntry(row);
    expect(domain.amount).toBe(450.75);
    expect(domain.occurredOn).toBe('2026-10-06');
    expect(domain.photoPath).toBe('h-1/t-1.jpg');
    expect(toTransactionRow(domain)).toEqual(row);
  });
});

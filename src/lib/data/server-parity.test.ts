import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { FamilyAccountsDB } from '../offline/db';
import { MockRepository } from './mock-repository';

// PROGRESS P6: the app's report totals must equal the server views to the piaster on the same data.
// The expected numbers below were read from v_monthly_summary, v_account_balances and
// v_monthly_category_totals on production (2026-10-07) after inserting exactly these entries in a
// rolled-back transaction. If the app's maths drifts from the views, this test fails.
const SERVER = {
  months: {
    '2026-09': { income: 0, expense: 12.34, net: -12.34 },
    '2026-10': { income: 5000.7, expense: 370.79, net: 4629.91 },
  },
  balances: { Cash: 637.57, Bank: 5214.56 },
  categoryTotals: { '2026-09': { Household: 12.34 }, '2026-10': { Household: 370.79 } },
};

const H = 'h';
const now = '2026-10-07T00:00:00Z';
const base = { household_id: H, sort_order: 0, is_archived: false, created_at: now, updated_at: now };

describe('report totals equal the server views (P6)', () => {
  let repo: MockRepository;

  beforeAll(async () => {
    const db = new FamilyAccountsDB(`test-p6-${Math.random().toString(36).slice(2, 9)}`);
    await db.accounts.bulkPut([
      { ...base, id: 'cash', name_ar: null, name_en: 'Cash', type: 'cash', opening_balance: 0, icon: null, color: null },
      { ...base, id: 'bank', name_ar: null, name_en: 'Bank', type: 'bank', opening_balance: 1234.56, icon: null, color: null },
    ]);
    await db.categories.bulkPut([
      { ...base, id: 'c-exp', kind: 'expense', name_ar: null, name_en: 'Household', icon: null, color: null },
      { ...base, id: 'c-inc', kind: 'income', name_ar: null, name_en: 'Income', icon: null, color: null },
    ]);
    await db.subcategories.bulkPut([
      { ...base, id: 's-exp', category_id: 'c-exp', name_ar: null, name_en: 'Bills' },
      { ...base, id: 's-inc', category_id: 'c-inc', name_ar: null, name_en: 'Regular' },
    ]);
    await db.items.bulkPut([
      { ...base, id: 'elec', subcategory_id: 's-exp', name_ar: null, name_en: 'Electricity' },
      { ...base, id: 'pension', subcategory_id: 's-inc', name_ar: null, name_en: 'Pension' },
    ]);
    let n = 0;
    const tx = (type: 'expense' | 'income' | 'transfer', amount: number, occurred_on: string, account_id: string, rest: object = {}) => ({
      id: `t${n++}`,
      household_id: H,
      type,
      amount,
      occurred_on,
      account_id,
      to_account_id: null,
      item_id: type === 'expense' ? 'elec' : type === 'income' ? 'pension' : null,
      note: null,
      created_by: 'u',
      updated_by: 'u',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      ...rest,
    });
    await db.transactions.bulkPut([
      tx('expense', 350.5, '2026-10-03', 'cash'),
      tx('expense', 0.1, '2026-10-04', 'cash'),
      tx('expense', 0.2, '2026-10-04', 'cash'),
      tx('expense', 19.99, '2026-10-05', 'bank'),
      tx('income', 5000, '2026-10-01', 'bank'),
      tx('income', 0.7, '2026-10-02', 'cash'),
      tx('expense', 12.34, '2026-09-30', 'cash'),
      tx('transfer', 1000.01, '2026-10-06', 'bank', { to_account_id: 'cash' }),
      tx('expense', 77, '2026-10-07', 'cash', { deleted_at: now }),
    ]);
    repo = new MockRepository(db);
  });

  it('monthly income, expense and net', async () => {
    for (const [month, expected] of Object.entries(SERVER.months)) {
      const s = await repo.monthSummary(month);
      expect({ income: s.income, expense: s.expense, net: s.net }).toEqual(expected);
    }
  });

  it('wallet balances', async () => {
    const balances = await repo.walletBalances();
    expect(Object.fromEntries(balances.map((b) => [b.nameEn, b.balance]))).toEqual(SERVER.balances);
  });

  it('category totals', async () => {
    for (const [month, expected] of Object.entries(SERVER.categoryTotals)) {
      const totals = await repo.categoryTotals(month, 'expense', 'category');
      expect(Object.fromEntries(totals.map((t) => [t.nameEn, t.total]))).toEqual(expected);
    }
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { FamilyAccountsDB } from '@/lib/offline/db';
import { MockRepository } from '@/lib/data/mock-repository';
import { WALLET_CASH_ID } from '@/lib/data/mock-seed';

describe('Income Category Flow (Requirement 3c)', () => {
  let db: FamilyAccountsDB;
  let repo: MockRepository;

  beforeEach(async () => {
    const dbName = `test-income-flow-${Math.random().toString(36).substring(2, 9)}`;
    db = new FamilyAccountsDB(dbName);
    repo = new MockRepository(db);
    await repo.seed();
  });

  it('filters categories by kind and saves income entry with Pension item', async () => {
    // 1. Fetch income categories (kind === 'income')
    const incomeCategories = await repo.getCategories('income');
    expect(incomeCategories.length).toBeGreaterThan(0);
    const incomeCat = incomeCategories.find(
      (c) => c.nameEn === 'Income' || c.nameAr === 'دخل'
    );
    expect(incomeCat).toBeDefined();
    expect(incomeCat?.kind).toBe('income');

    // Expense categories should NOT contain Income category
    const expenseCategories = await repo.getCategories('expense');
    expect(expenseCategories.some((c) => c.id === incomeCat!.id)).toBe(false);
    expect(expenseCategories.map((c) => c.nameEn)).toContain('Household');

    // 2. Fetch subcategories for Income category -> Regular
    const subcategories = await repo.getSubcategories(incomeCat!.id);
    const regularSub = subcategories.find(
      (s) => s.nameEn === 'Regular' || s.nameAr === 'ثابت'
    );
    expect(regularSub).toBeDefined();

    // 3. Fetch items for Regular subcategory -> Pension
    const items = await repo.getItems(regularSub!.id);
    const pensionItem = items.find(
      (i) => i.nameEn === 'Pension' || i.nameAr === 'معاش'
    );
    expect(pensionItem).toBeDefined();

    // 4. Save income entry
    const saved = await repo.addEntry({
      type: 'income',
      amount: 6500,
      accountId: WALLET_CASH_ID,
      itemId: pensionItem!.id,
      occurredOn: '2026-10-06',
      note: 'Monthly pension',
    });

    expect(saved.id).toBeDefined();
    expect(saved.type).toBe('income');
    expect(saved.amount).toBe(6500);
    expect(saved.itemId).toBe(pensionItem!.id);

    // 5. Verify retrieved entry has full details
    const retrieved = await repo.getEntry(saved.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.type).toBe('income');
    expect(retrieved?.amount).toBe(6500);
    expect(retrieved?.itemNameEn).toBe('Pension');
    expect(retrieved?.categoryNameEn).toBe('Income');

    // 6. Switching back to expense yields expense categories
    const switchBackExpenses = await repo.getCategories('expense');
    expect(switchBackExpenses.length).toBeGreaterThanOrEqual(5);
    expect(switchBackExpenses.every((c) => c.kind === 'expense')).toBe(true);
  });
});

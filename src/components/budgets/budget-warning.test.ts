import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { FamilyAccountsDB } from '@/lib/offline/db';
import { MockRepository } from '@/lib/data/mock-repository';
import { WALLET_CASH_ID } from '@/lib/data/mock-seed';
import { localISODate } from '@/lib/format';
import { budgetWarningsForEntry, resetAlertedThresholds } from './budget-warning';

describe('budgetWarningsForEntry', () => {
  let repo: MockRepository;

  beforeEach(async () => {
    resetAlertedThresholds();
    repo = new MockRepository(new FamilyAccountsDB(`test-bw-${Math.random().toString(36).slice(2, 9)}`));
    await repo.seed();
    for (const b of await repo.getBudgets()) await repo.archiveBudget(b.id);
  });

  async function firstItem() {
    const [category] = await repo.getCategories('expense');
    const [group] = await repo.getSubcategories(category.id);
    const [item] = await repo.getItems(group.id);
    return { category, group, item };
  }

  it('warns when crossing 80% and 100%, and skips intermediate or later entries', async () => {
    const { category, item } = await firstItem();
    const today = localISODate();
    const month = today.slice(0, 7);
    const small = await repo.addEntry({ type: 'expense', amount: 100, occurredOn: today, accountId: WALLET_CASH_ID, itemId: item.id });
    const spent = (await repo.listEntries({ month, type: 'expense', categoryId: category.id })).reduce(
      (s, e) => s + e.amount,
      0,
    );
    // Budget set so this month is exactly half used
    const budget = Math.round(spent * 2 * 100) / 100;
    await repo.addBudget({ categoryId: category.id, amount: budget });
    expect(await budgetWarningsForEntry(repo, small.id, 'en')).toEqual([]);

    const add = (amount: number) =>
      repo.addEntry({ type: 'expense', amount: Math.round(amount * 100) / 100, occurredOn: today, accountId: WALLET_CASH_ID, itemId: item.id });

    // 1. Crosses 80% (takes it to 85%) -> warns once with level: near
    const big = await add(budget * 0.35);
    const [warning] = await budgetWarningsForEntry(repo, big.id, 'en');
    expect(warning.progress.level).toBe('near');
    expect(warning.threshold).toBe('80');
    expect(warning.label).toBe(category.nameEn);

    // 2. Next entry takes it to 90% (stays in 80-100% bracket) -> NO warning!
    const mid = await add(budget * 0.05);
    expect(await budgetWarningsForEntry(repo, mid.id, 'en')).toEqual([]);

    // 3. Crosses 100% (takes it to 105%) -> warns once with level: over
    const over = await add(budget * 0.15);
    const [overWarning] = await budgetWarningsForEntry(repo, over.id, 'en');
    expect(overWarning.progress.level).toBe('over');
    expect(overWarning.threshold).toBe('100');

    // 4. Later entry (already above 100%) -> NO warning!
    const afterOver = await add(budget * 0.1);
    expect(await budgetWarningsForEntry(repo, afterOver.id, 'en')).toEqual([]);
  });

  it('labels a group budget as "Category · Group"', async () => {
    const { category, group, item } = await firstItem();
    const month = localISODate().slice(0, 7);
    const spent = (await repo.listEntries({ month, type: 'expense', subcategoryId: group.id })).reduce(
      (s, e) => s + e.amount,
      0,
    );
    const budget = Math.round((spent + 100) / 0.85);
    await repo.addBudget({ categoryId: category.id, subcategoryId: group.id, amount: budget });
    const entry = await repo.addEntry({ type: 'expense', amount: 100, occurredOn: localISODate(), accountId: WALLET_CASH_ID, itemId: item.id });
    const [warning] = await budgetWarningsForEntry(repo, entry.id, 'en');
    expect(warning.label).toBe(`${category.nameEn} · ${group.nameEn}`);
  });
});

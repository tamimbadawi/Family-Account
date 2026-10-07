import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { FamilyAccountsDB } from '@/lib/offline/db';
import { MockRepository } from '@/lib/data/mock-repository';
import { WALLET_CASH_ID } from '@/lib/data/mock-seed';
import { localISODate } from '@/lib/format';
import { budgetWarningsForEntry } from './budget-warning';

describe('budgetWarningsForEntry', () => {
  let repo: MockRepository;

  beforeEach(async () => {
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

  it('warns from 80% of the month and names the budget', async () => {
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
    const big = await add(budget * 0.35); // 85%
    const [warning] = await budgetWarningsForEntry(repo, big.id, 'en');
    expect(warning.progress.level).toBe('near');
    expect(warning.label).toBe(category.nameEn);

    const over = await add(budget * 0.2); // 105%
    const [overWarning] = await budgetWarningsForEntry(repo, over.id, 'en');
    expect(overWarning.progress.level).toBe('over');
  });

  it('labels a group budget as "Category · Group"', async () => {
    const { category, group, item } = await firstItem();
    await repo.addBudget({ categoryId: category.id, subcategoryId: group.id, amount: 1 });
    const entry = await repo.addEntry({ type: 'expense', amount: 10, occurredOn: localISODate(), accountId: WALLET_CASH_ID, itemId: item.id });
    const [warning] = await budgetWarningsForEntry(repo, entry.id, 'en');
    expect(warning.label).toBe(`${category.nameEn} · ${group.nameEn}`);
  });
});

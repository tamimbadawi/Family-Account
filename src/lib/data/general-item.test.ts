import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { FamilyAccountsDB } from '@/lib/offline/db';
import { MockRepository } from './mock-repository';
import { generalItemFor } from './general-item';

async function freshRepo() {
  const repo = new MockRepository(new FamilyAccountsDB(`test-general-${Math.random().toString(36).slice(2, 9)}`));
  await repo.ensureSeeded();
  return repo;
}

describe('generalItemFor', () => {
  it('files a group-level entry under an item named like the group, created once', async () => {
    const repo = await freshRepo();
    const category = (await repo.getCategories('expense'))[0];
    const group = (await repo.getSubcategories(category.id))[0];
    const before = (await repo.getItems(group.id)).length;

    const first = await generalItemFor(repo, category, group);
    const second = await generalItemFor(repo, category, group);

    expect(first.id).toBe(second.id);
    expect(first.subcategoryId).toBe(group.id);
    expect(first.nameEn).toBe(group.nameEn);
    expect((await repo.getItems(group.id)).length).toBe(before + 1);
  });

  it('files a category-level entry under a group and item named like the category', async () => {
    const repo = await freshRepo();
    const category = (await repo.getCategories('expense'))[0];

    const item = await generalItemFor(repo, category, null);
    const again = await generalItemFor(repo, category, null);
    const groups = await repo.getSubcategories(category.id);
    const own = groups.filter((g) => g.nameEn === category.nameEn && g.nameAr === category.nameAr);

    expect(again.id).toBe(item.id);
    expect(own).toHaveLength(1);
    expect(item.subcategoryId).toBe(own[0].id);
    expect(item.nameEn).toBe(category.nameEn);
  });
});

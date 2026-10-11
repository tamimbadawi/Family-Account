// scripts/ui/flows/categories.mjs
// Category management flows: newgroup, newcategory, settings_categories.

import { tap, btn, sleep, assertUsable } from '../helpers.mjs';

export async function newgroup(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  // Open entry sheet
  const addBtn = page.getByRole('button', { name: locale === 'ar' ? 'إضافة' : 'Add entry', exact: true }).first();
  await addBtn.click();
  await page.locator('[data-slot="drawer-content"], [role="dialog"]').first().waitFor({ state: 'visible', timeout: 8000 });
  await sleep(400);

  // Pick Food category
  const foodBtn = page.getByRole('button', { name: locale === 'ar' ? 'طعام' : 'Food' }).first();
  if (await foodBtn.isVisible().catch(() => false)) {
    await foodBtn.click();
    await sleep(300);
  }

  // Look for + New Group
  const newGroupBtn = page.getByRole('button', { name: locale === 'ar' ? /مجموعة جديدة|\+ مجموعة/ : /\+ New Group|New Group/i }).first();
  if (await newGroupBtn.isVisible().catch(() => false)) {
    await newGroupBtn.click();
    await sleep(400);
    await page.keyboard.press('Escape');
  } else {
    await page.keyboard.press('Escape');
  }
}

export async function newcategory(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}/settings/categories`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  const addCatBtn = page.getByRole('button', { name: locale === 'ar' ? /إضافة تصنيف|تصنيف جديد/ : /Add category|New category/i }).first();
  if (await addCatBtn.isVisible().catch(() => false)) {
    await addCatBtn.click();
    await sleep(400);
    await page.keyboard.press('Escape');
  }
}

export async function settings_categories(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}/settings/categories`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  // Verify list rendered
  const firstCat = page.locator('div, button').filter({ hasText: locale === 'ar' ? 'طعام' : 'Food' }).first();
  await assertUsable(page, firstCat, 'Category tree Food item');
  await firstCat.click();
  await sleep(400);
}

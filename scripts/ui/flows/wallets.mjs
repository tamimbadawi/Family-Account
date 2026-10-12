// scripts/ui/flows/wallets.mjs
// Wallet flows: bank management and wallet switcher.

import { sleep, assertUsable } from '../helpers.mjs';

export async function bank(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  // Open entry sheet
  const addBtn = page.getByRole('button', { name: locale === 'ar' ? 'إضافة' : 'Add entry', exact: true }).first();
  await addBtn.click();
  await page.locator('[data-slot="drawer-content"], [role="dialog"]').first().waitFor({ state: 'visible', timeout: 8000 });
  await sleep(400);

  // Click wallet chip
  const walletChip = page.getByRole('button', { name: locale === 'ar' ? /محفظة|كاش/ : /Wallet|Cash/ }).first();
  if (await walletChip.isVisible().catch(() => false)) {
    await walletChip.click();
    await sleep(400);
    await page.keyboard.press('Escape');
  } else {
    await page.keyboard.press('Escape');
  }
}

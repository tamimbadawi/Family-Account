// scripts/ui/flows/preferences.mjs
// User preference flows: language switch and theme switch.

import { sleep, assertUsable } from '../helpers.mjs';

export async function language_switch(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  // Check language toggle button or link
  const otherLocale = locale === 'en' ? 'ar' : 'en';
  const langToggle = page.locator(`a[href*="/${otherLocale}"], button`).filter({
    hasText: locale === 'en' ? /عربي|العربية/ : /English/i,
  }).first();

  if (await langToggle.isVisible().catch(() => false)) {
    await langToggle.click();
    await page.waitForURL(`**\/${otherLocale}*`, { timeout: 10000 }).catch(() => {});
    await sleep(400);

    // Verify dir attribute matches target language
    const dir = await page.locator('html').getAttribute('dir');
    const expectedDir = otherLocale === 'ar' ? 'rtl' : 'ltr';
    if (dir && dir !== expectedDir) {
      throw new Error(`Expected html dir="${expectedDir}" but got "${dir}" after language switch`);
    }
  }
}

export async function theme_switch(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  // Toggle theme button if available
  const themeBtn = page.getByRole('button', { name: locale === 'ar' ? /مظهر|وضع داكن|وضع فاتح/ : /Theme|Dark|Light/i }).first();
  if (await themeBtn.isVisible().catch(() => false)) {
    await themeBtn.click();
    await sleep(400);
  }
}

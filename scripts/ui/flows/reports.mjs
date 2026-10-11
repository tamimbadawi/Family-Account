// scripts/ui/flows/reports.mjs
// Reports screen flows: reports_tabs, reports_library, reports_sheets.

import { sleep, assertUsable } from '../helpers.mjs';

export async function reports_tabs(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}/reports`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  // 1. Switch to All Reports tab
  const allTab = page.getByRole('button', { name: locale === 'ar' ? 'كل التقارير' : 'All reports' }).first();
  if (await allTab.isVisible().catch(() => false)) {
    await allTab.click();
    await sleep(400);
  }

  // 2. Switch to Breakdown tab
  const breakdownTab = page.getByRole('button', { name: locale === 'ar' ? 'تفصيل' : 'Breakdown' }).first();
  if (await breakdownTab.isVisible().catch(() => false)) {
    await breakdownTab.click();
    await sleep(400);
  }

  // 3. Switch back to Overview
  const overviewTab = page.getByRole('button', { name: locale === 'ar' ? 'نظرة عامة' : 'Overview' }).first();
  if (await overviewTab.isVisible().catch(() => false)) {
    await overviewTab.click();
    await sleep(400);
  }
}

export async function reports_library(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}/reports?tab=all`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  // Click first report card link
  const firstLink = page.locator('a[href*="/reports/r/"]').first();
  if (await firstLink.isVisible().catch(() => false)) {
    await firstLink.click();
    await page.waitForURL(`**\/reports/r\/**`, { timeout: 10000 }).catch(() => {});
    await sleep(400);

    // Navigate back to reports
    const backBtn = page.locator('a[href*="/reports"]').first();
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await sleep(400);
    }
  }
}

export async function reports_sheets(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}/reports`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  // Test "See all categories" sheet if present
  const seeAllBtn = page.getByRole('button', { name: locale === 'ar' ? /كل التصنيفات/ : /See all categories/i }).first();
  if (await seeAllBtn.isVisible().catch(() => false)) {
    await seeAllBtn.click();
    await sleep(400);
    await page.keyboard.press('Escape');
    await sleep(300);
  }
}

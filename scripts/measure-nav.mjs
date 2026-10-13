import { chromium } from 'playwright-core';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH;

async function main() {
  const browser = await chromium.launch(
    CHROME ? { executablePath: CHROME, headless: true } : { headless: true, channel: 'chrome' }
  );

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });

  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('fa_tour_seen', '1'); } catch {}
  });

  // 1. Home
  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 2. Home → History
  const hStart = performance.now();
  await page.locator('a[data-tour="tab-history"]').click();
  await page.locator('h1:has-text("History")').waitFor({ state: 'visible' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const hTime = Math.round(performance.now() - hStart);

  // 3. History → Reports
  const rStart = performance.now();
  await page.locator('a[data-tour="tab-reports"]').click();
  await page.locator('h1:has-text("Reports")').waitFor({ state: 'visible' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const rTime = Math.round(performance.now() - rStart);

  // 4. Reports → Settings
  const sStart = performance.now();
  await page.locator('a[data-tour="tab-settings"]').click();
  await page.locator('h1:has-text("Settings")').waitFor({ state: 'visible' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const sTime = Math.round(performance.now() - sStart);

  // 5. Settings → Family
  const fStart = performance.now();
  const fLink = page.locator('a[href="/settings/family"], a[href="/en/settings/family"]').first();
  await fLink.scrollIntoViewIfNeeded();
  await fLink.click();
  await page.locator('h1:has-text("Family")').waitFor({ state: 'visible' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fTime = Math.round(performance.now() - fStart);

  // Back to Settings
  console.log('Navigating back to Settings...');
  await page.locator('a[aria-label="Back"]').first().click();
  await page.locator('h1:has-text("Settings")').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);

  // Open "More" accordion in Settings
  console.log('Opening More accordion...');
  const moreBtn = page.locator('button[aria-controls="settings-more"]');
  await moreBtn.scrollIntoViewIfNeeded();
  if (await moreBtn.isVisible()) {
    await moreBtn.click();
    await page.waitForTimeout(300);
  }

  // 6. Settings → Currencies
  const cStart = performance.now();
  await page.locator('a[href="/en/settings/currencies"]').click();
  await page.locator('h1:has-text("Currencies")').waitFor({ state: 'visible' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const cTime = Math.round(performance.now() - cStart);

  const results = [
    { route: 'Home → History', durationMs: hTime },
    { route: 'History → Reports', durationMs: rTime },
    { route: 'Reports → Settings', durationMs: sTime },
    { route: 'Settings → Family', durationMs: fTime },
    { route: 'Settings → Currencies', durationMs: cTime },
  ];

  console.log('TIMINGS_RESULT:' + JSON.stringify(results));
  await browser.close();
}

main().catch((err) => {
  console.error('TIMINGS_ERROR:', err);
  process.exit(1);
});

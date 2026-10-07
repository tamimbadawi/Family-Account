// User-action tests (headless Chrome, no IDE browser). Each flow runs in a fresh browser profile (fresh sample data).
//   BASE_URL=https://<preview> npm run ui:flows                 (all flows, all viewports)
//   BASE_URL=... npm run ui:flows -- income newgroup            (only some flows)
// Exit code 1 if any flow fails; screenshots of failures go to .ui-check/flows/.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.resolve('.ui-check/flows');
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [[390, 844], [375, 667], [412, 700]];
const KEYBOARD = [390, 420]; // what is left of an iPhone screen with the keyboard open

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const btn = (page, name) => page.getByRole('button', { name, exact: true }).or(page.getByRole('radio', { name, exact: true })).first();

/** Visible, inside the viewport and not covered by anything else at its centre. */
async function assertUsable(page, locator, what) {
  await locator.waitFor({ state: 'visible', timeout: 8000 }).catch(() => { throw new Error(`${what}: not visible`); });
  const ok = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (r.width < 1 || y < 0 || y > innerHeight || x < 0 || x > innerWidth) return 'outside the screen';
    const top = document.elementFromPoint(x, y);
    if (top?.tagName === 'NEXTJS-PORTAL') return 'ok';
    return top && (el === top || el.contains(top) || top.contains(el)) ? 'ok' : 'covered by ' + (top?.tagName + '.' + String(top?.className).slice(0, 40));
  });
  if (ok !== 'ok') throw new Error(`${what}: ${ok}`);
}
async function tap(page, name) {
  const b = btn(page, name);
  await assertUsable(page, b, `button "${name}"`);
  await b.click();
  await sleep(350);
}
async function typeAmount(page, digits) {
  for (const d of digits) await tap(page, d);
}
async function homeNumbers(page) {
  const text = await page.locator('body').innerText();
  const num = (re) => Number((text.match(re)?.[1] || '0').replace(/,/g, ''));
  return { spent: num(/Spent this month\s*([\d,]+)/), moneyIn: num(/Money in ([\d,]+)/) };
}
async function openSheet(page) {
  await tap(page, 'Add entry');
  await page.getByText('New entry').first().waitFor({ timeout: 8000 });
}
/** One popup: the typed amount is shown and Save is on screen, no Next step, no scrolling. */
async function assertOnePopup(page, amountText) {
  const amount = page.locator("[data-amount]").first();
  await assertUsable(page, amount, "amount display");
  const shown = (await amount.innerText()).trim();
  if (shown !== amountText) throw new Error(`amount shows "${shown}" (should be "${amountText}")`);
  if (await btn(page, "Next").count()) throw new Error("a Next step is back; everything should be in one popup");
  await assertUsable(page, page.getByRole("button", { name: /^(Save|Saved)$/ }).last(), "Save button without scrolling");
}
async function saveButton(page) {
  return page.getByRole('button', { name: /^(Save|Saved)$/ }).last();
}

const FLOWS = {
  async income(page) {
    const before = await homeNumbers(page);
    await openSheet(page);
    await tap(page, 'Money in');
    await typeAmount(page, ['5', '0', '0', '0']);
    await assertOnePopup(page, '5,000');
    await tap(page, 'Income');
    await tap(page, 'Regular');
    await tap(page, 'Pension');
    const save = await saveButton(page);
    await assertUsable(page, save, 'Save button');
    if (await save.isDisabled()) throw new Error('Save is disabled after choosing amount + item');
    const label = (await save.innerText()).trim();
    if (label !== 'Save') throw new Error(`Save button label is "${label}" (should be "Save")`);
    await save.click();
    await sleep(1500);
    const after = await homeNumbers(page);
    if (after.moneyIn !== before.moneyIn + 5000) throw new Error(`Money in did not go up by 5000 (${before.moneyIn} -> ${after.moneyIn})`);
  },
  async expense(page) {
    const before = await homeNumbers(page);
    await openSheet(page);
    await typeAmount(page, ['2', '5', '0']);
    await assertOnePopup(page, '250');
    await tap(page, 'Food');
    await tap(page, 'Groceries');
    await tap(page, 'Supermarket');
    const save = await saveButton(page);
    await assertUsable(page, save, 'Save button');
    await save.click();
    await sleep(1500);
    const after = await homeNumbers(page);
    if (after.spent !== before.spent + 250) throw new Error(`Spent did not go up by 250 (${before.spent} -> ${after.spent})`);
  },
  async switchtype(page) {
    await openSheet(page);
    await tap(page, 'Money in');
    await typeAmount(page, ['1', '0', '0']);
    await assertOnePopup(page, '100');
    await assertUsable(page, btn(page, 'Income'), 'income category after choosing Money in');
    if (await btn(page, 'Food').isVisible().catch(() => false)) throw new Error('expense category "Food" shown for Money in');
    await tap(page, 'Money out');
    await assertOnePopup(page, '100'); // switching type keeps the amount
    await assertUsable(page, btn(page, 'Food'), 'expense category after switching back to Money out');
    if (await btn(page, 'Income').isVisible().catch(() => false)) throw new Error('income category still shown after switching to Money out');
  },
  async newgroup(page) {
    // The keyboard only opens when the name field does: type the amount at full height first
    const keyboard = page.viewportSize();
    if (keyboard.height < 600) await page.setViewportSize({ width: keyboard.width, height: 844 });
    await openSheet(page);
    await typeAmount(page, ['5', '0']);
    await assertOnePopup(page, '50');
    await tap(page, 'Food');
    // "+ New Group" is the last chip of a sideways-swiping row
    await btn(page, '+ New Group').scrollIntoViewIfNeeded();
    await tap(page, '+ New Group');
    if (keyboard.height < 600) {
      await page.setViewportSize(keyboard);
      await sleep(400);
    }
    const input = page.getByRole('textbox').first();
    await assertUsable(page, input, 'new group name field');
    await input.fill('Bakery test');
    const save = page.getByRole('button', { name: /^(Save|Saved)$/ }).first();
    await assertUsable(page, save, 'Save for the new group');
    const label = (await save.innerText()).trim();
    if (label !== 'Save') throw new Error(`new-group button label is "${label}" (should be "Save")`);
    if (await save.isDisabled()) throw new Error('new-group Save disabled after typing a name');
    await save.click();
    await sleep(800);
    await assertUsable(page, page.getByText('Bakery test').first(), 'the new group after saving');
  },
  async photo(page) {
    await page.goto(BASE + '/en/history', { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);
    // A big camera-sized JPEG, made in the page
    const jpeg = Buffer.from(await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 4032; c.height = 3024;
      const g = c.getContext('2d');
      for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${i * 37 % 360} 70% 50%)`; g.fillRect((i * 97) % 4032, (i * 61) % 3024, 300, 200); }
      return c.toDataURL('image/jpeg', 0.95).split(',')[1];
    }), 'base64');
    await openSheet(page);
    await typeAmount(page, ['1', '2', '0']);
    await tap(page, 'Food');
    await tap(page, 'Groceries');
    await tap(page, 'Supermarket');
    await page.getByLabel('Add a receipt photo').setInputFiles({ name: 'receipt.jpg', mimeType: 'image/jpeg', buffer: jpeg });
    const thumb = btn(page, 'View receipt photo');
    await assertUsable(page, thumb, 'photo thumbnail');
    await assertOnePopup(page, '120'); // the photo chip still fits with Save on screen
    const width = await thumb.locator('img').evaluate((img) => img.naturalWidth);
    if (width > 1600) throw new Error(`photo was not shrunk (${width}px wide)`);
    // Viewer: Remove → Undo brings it back
    await tap(page, 'View receipt photo');
    await assertUsable(page, btn(page, 'Remove'), 'Remove in the photo viewer');
    await assertUsable(page, page.getByText('Replace', { exact: true }), 'Replace in the photo viewer');
    await tap(page, 'Remove');
    await assertUsable(page, page.getByLabel('Add a receipt photo').locator('..'), 'camera chip after Remove');
    await page.getByRole('button', { name: 'Undo' }).first().click();
    await sleep(400);
    await assertUsable(page, btn(page, 'View receipt photo'), 'photo thumbnail after Undo');
    const save = await saveButton(page);
    await assertUsable(page, save, 'Save button');
    await save.click();
    await sleep(1500);
    // History marks the entry, and editing it shows the photo again
    const clip = page.getByLabel('Has a photo').first();
    await assertUsable(page, clip, 'photo mark on the history row');
    await clip.click();
    await page.getByText('Edit').first().waitFor({ timeout: 8000 });
    await sleep(700); // let the sheet finish sliding up
    await assertUsable(page, btn(page, 'View receipt photo'), 'photo thumbnail when editing');
  },
  async date(page) {
    await openSheet(page);
    // The app's own calendar (the hidden native date input did not open inside the sheet)
    await tap(page, 'Pick a day');
    const dialog = page.getByRole('dialog', { name: 'Pick a day' });
    await assertUsable(page, dialog.getByRole('button', { name: 'Yesterday', exact: true }), 'Yesterday in the calendar');
    await dialog.getByRole('button', { name: 'Yesterday', exact: true }).click();
    await sleep(400);
    const chip = btn(page, 'Pick a day');
    if ((await chip.innerText()).trim() !== 'Yesterday') throw new Error(`date chip shows "${await chip.innerText()}" (should be "Yesterday")`);
    // Pick the 1st of this month from the grid (never a future day)
    await tap(page, 'Pick a day');
    const first = dialog.getByRole('button', { name: '1', exact: true });
    await assertUsable(page, first, 'day 1 in the calendar');
    await first.click();
    await sleep(400);
    const shown = (await chip.innerText()).trim();
    const today = new Date();
    const expected = today.getDate() === 1 ? 'Today' : today.getDate() === 2 ? 'Yesterday' : null;
    if (expected ? shown !== expected : !/^[A-Z][a-z]{2} 1$/.test(shown)) throw new Error(`date chip shows "${shown}" after picking the 1st`);
    await dialog.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => { throw new Error('calendar stayed open after picking a day'); });
    await sleep(300);
    await assertOnePopup(page, '0');
  },
  async bank(page) {
    await openSheet(page);
    await typeAmount(page, ['7', '5']);
    await tap(page, 'Food');
    await tap(page, 'Groceries');
    await tap(page, 'Supermarket');
    // Wallet → Bank → "Which bank?" → add a new bank by name; the chip then names it
    await tap(page, 'Wallet');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /^Bank/ }).click();
    await page.getByText('Which bank?').waitFor({ timeout: 8000 });
    const name = dialog.getByRole('textbox', { name: 'Bank name' });
    await assertUsable(page, name, 'bank name field');
    await name.click();
    await name.fill('Test Bank');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await sleep(600);
    const chip = btn(page, 'Wallet');
    if (!(await chip.innerText()).includes('Test Bank')) throw new Error(`wallet chip shows "${await chip.innerText()}" (should name the new bank)`);
    // The bank is now listed under Bank, and the entry saves on it
    await tap(page, 'Wallet');
    await dialog.getByRole('button', { name: /^Bank/ }).click();
    await assertUsable(page, dialog.getByRole('button', { name: 'Test Bank', exact: true }), 'the new bank in the bank list');
    await dialog.getByRole('button', { name: 'Test Bank', exact: true }).click();
    await sleep(400);
    const save = await saveButton(page);
    await assertUsable(page, save, 'Save button');
    await save.click();
    await sleep(1500);
    await assertUsable(page, page.getByText('Food · Test Bank').first(), 'the entry saved on the new bank');
  },

  async reports_tabs(page, { locale }) {
    await page.goto(`${BASE}/${locale}/reports`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);

    // 1. Switch to "All reports" tab
    const allTab = page.getByRole('button', { name: locale === 'ar' ? 'كل التقارير' : 'All reports' });
    await assertUsable(page, allTab, 'All reports tab');
    await allTab.click();
    await sleep(500);
    await assertUsable(page, page.locator('a[href*="/reports/r/"]').first(), 'first report card in library');

    // 2. Switch to "Breakdown" tab
    const breakdownTab = page.getByRole('button', { name: locale === 'ar' ? 'تفصيل' : 'Breakdown' });
    await assertUsable(page, breakdownTab, 'Breakdown tab');
    await breakdownTab.click();
    await sleep(500);
    await assertUsable(page, page.locator('table').first(), 'Breakdown pivot table');

    // Test a preset button in Breakdown
    const presetBtn = page.getByRole('button', { name: locale === 'ar' ? /شهر.*بشهر/ : 'Month by month' });
    await assertUsable(page, presetBtn, 'Month by month preset');
    await presetBtn.click();
    await sleep(400);

    // Test Customize filter toggle
    const customBtn = page.getByRole('button', { name: locale === 'ar' ? 'تخصيص' : 'Customize' });
    await assertUsable(page, customBtn, 'Customize button');
    await customBtn.click();
    await sleep(400);
    await customBtn.click();
    await sleep(300);

    // 3. Switch back to "Overview" tab
    const overviewTab = page.getByRole('button', { name: locale === 'ar' ? 'نظرة عامة' : 'Overview' });
    await assertUsable(page, overviewTab, 'Overview tab');
    await overviewTab.click();
    await sleep(500);
  },

  async reports_library(page, { locale }) {
    await page.goto(`${BASE}/${locale}/reports?tab=all`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);

    const reports = [
      'this-vs-last-month',
      'year-summary',
      'biggest-expenses',
      'spending-calendar',
      'income-sources',
      'category-deep-dive',
    ];

    for (const rId of reports) {
      // Find card link
      const link = page.locator(`a[href*="/reports/r/${rId}"]`).first();
      await assertUsable(page, link, `link to ${rId}`);
      await link.click();
      await page.waitForURL(`**\/reports/r/${rId}*`, { timeout: 10000 });
      await sleep(400);

      // Test month/period switcher where applicable
      if (['this-vs-last-month', 'spending-calendar', 'category-deep-dive'].includes(rId)) {
        const prevBtn = page.locator('button[aria-label="Previous month"], button[aria-label="الشهر السابق"]').first();
        if (await prevBtn.isVisible()) {
          await prevBtn.click();
          await sleep(300);
          const nextBtn = page.locator('button[aria-label="Next month"], button[aria-label="الشهر القادم"]').first();
          if (await nextBtn.isVisible()) {
            await nextBtn.click();
            await sleep(300);
          }
        }
      }

      if (['biggest-expenses', 'income-sources'].includes(rId)) {
        const p6m = page.getByRole('button', { name: locale === 'ar' ? 'آخر 6 أشهر' : 'Last 6 months' });
        if (await p6m.isVisible()) {
          await p6m.click();
          await sleep(300);
          const p1m = page.getByRole('button', { name: locale === 'ar' ? 'هذا الشهر' : 'This month' });
          if (await p1m.isVisible()) {
            await p1m.click();
            await sleep(300);
          }
        }
      }

      // Navigate back using the back button
      const back = page.locator('a[href*="/reports?tab=all"]').first();
      await assertUsable(page, back, `back button on ${rId}`);
      await back.click();
      await page.waitForURL(`**\/reports*`, { timeout: 10000 });
      await sleep(400);
    }
  },

  async reports_sheets(page, { locale }) {
    // 1. Overview "See all categories" sheet
    await page.goto(`${BASE}/${locale}/reports`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);
    const seeAllOverview = page.getByRole('button', { name: locale === 'ar' ? /عرض كل الأقسام/ : /See all categories/ }).first();
    if (await seeAllOverview.isVisible()) {
      await seeAllOverview.click();
      await sleep(500);
      const drawer = page.locator('[data-slot="drawer-content"]');
      await drawer.waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.press('Escape');
      await sleep(500);
    }

    // 2. Breakdown cell sheet
    await page.goto(`${BASE}/${locale}/reports?tab=breakdown`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);
    const cell = page.locator('td.tabular-nums').first();
    if (await cell.isVisible()) {
      await cell.click();
      await sleep(500);
      const drawer = page.locator('[data-slot="drawer-content"]');
      await drawer.waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.press('Escape');
      await sleep(500);
    }

    // 3. This vs last month "See all categories" sheet
    await page.goto(`${BASE}/${locale}/reports/r/this-vs-last-month`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);
    const seeAllTvL = page.getByRole('button', { name: locale === 'ar' ? /عرض كل الأقسام/ : /See all categories/ }).first();
    if (await seeAllTvL.isVisible()) {
      await seeAllTvL.click();
      await sleep(500);
      const drawer = page.locator('[data-slot="drawer-content"]');
      await drawer.waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.press('Escape');
      await sleep(500);
    }

    // 4. Biggest expenses "See all entries" sheet
    await page.goto(`${BASE}/${locale}/reports/r/biggest-expenses`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);
    const seeAllBig = page.getByRole('button', { name: locale === 'ar' ? /عرض كل الأقسام/ : /See all categories/ }).first();
    if (await seeAllBig.isVisible()) {
      await seeAllBig.click();
      await sleep(500);
      const drawer = page.locator('[data-slot="drawer-content"]');
      await drawer.waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.press('Escape');
      await sleep(500);
    }

    // 5. Spending calendar day sheet
    await page.goto(`${BASE}/${locale}/reports/r/spending-calendar`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);
    const dayBtn = page.locator('button.cursor-pointer').filter({ hasText: /\d+/ }).first();
    if (await dayBtn.isVisible()) {
      await dayBtn.click();
      await sleep(500);
      const drawer = page.locator('[data-slot="drawer-content"]');
      await drawer.waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.press('Escape');
      await sleep(500);
    }

    // 6. Category deep dive subcategory detail sheet
    await page.goto(`${BASE}/${locale}/reports/r/category-deep-dive`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);
    const subRow = page.locator('div[class*="cursor-pointer"]').filter({ hasText: / ج\.م| EGP/ }).first();
    if (await subRow.isVisible()) {
      await subRow.click();
      await sleep(500);
      const drawer = page.locator('[data-slot="drawer-content"]');
      await drawer.waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.press('Escape');
      await sleep(500);
    }
  },

  async our_money(page, { locale }) {
    await page.goto(`${BASE}/${locale}/reports`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);

    // Switch to page 2 (Trends and Wallets)
    const page2Dot = page.getByRole('button', { name: /Page 2/i });
    if (await page2Dot.isVisible()) {
      await page2Dot.click();
      await sleep(400);
    }

    // Click the wallet balances card to open OurMoneySheet
    const walletCard = page.locator('h2').filter({ hasText: locale === 'ar' ? 'رصيد المحافظ' : 'Wallet balances' }).first();
    await assertUsable(page, walletCard, 'wallet balances card');
    await walletCard.click();
    await sleep(500);

    const drawer = page.locator('[data-slot="drawer-content"]');
    await drawer.waitFor({ state: 'visible', timeout: 5000 });

    // Tap first wallet row inside sheet
    const walletRow = drawer.locator('button').filter({ hasText: locale === 'ar' ? 'كاش' : 'Cash' }).first();
    await assertUsable(page, walletRow, 'wallet row in OurMoneySheet');
    await walletRow.click();

    await page.waitForURL(`**\/history?wallet=*`, { timeout: 10000 });
    await sleep(500);

    if (!page.url().includes('history?wallet=')) {
      throw new Error('Did not navigate to history filtered by wallet');
    }
  },

  async update_balance(page, { locale }) {
    await page.goto(`${BASE}/${locale}/settings/wallets`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);

    // Click Update balance on the first wallet
    const updateBtn = page.getByRole('button', { name: locale === 'ar' ? 'تحديث الرصيد' : 'Update balance' }).first();
    await assertUsable(page, updateBtn, 'Update balance button');
    await updateBtn.click();
    await sleep(500);

    const drawer = page.locator('[data-slot="drawer-content"]');
    await drawer.waitFor({ state: 'visible', timeout: 5000 });

    // Use AmountPad: tap key '7'
    const key7 = drawer.getByRole('button', { name: '7' });
    await assertUsable(page, key7, 'key 7 on AmountPad');
    await key7.click();
    await sleep(200);

    // Click Save
    const saveBtn = drawer.getByRole('button', { name: locale === 'ar' ? 'حفظ' : 'Save' });
    await assertUsable(page, saveBtn, 'Save button');
    await saveBtn.click();
    await sleep(600);

    // Toast with Undo should appear
    const undoBtn = page.getByRole('button', { name: locale === 'ar' ? 'تراجع' : 'Undo' });
    await assertUsable(page, undoBtn, 'Undo toast button');
    await undoBtn.click();
    await sleep(500);
  },

  async reports_planning(page, { locale }) {
    await page.goto(`${BASE}/${locale}/reports?tab=all`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);

    const planningReports = [
      'bills-tracker',
      'monthly-averages',
      'who-spent-what',
      'search-export',
      'unusual-spending',
      'spending-pace',
    ];

    for (const rId of planningReports) {
      // Ensure Planning group is selected
      const planningChip = page.getByRole('button', { name: locale === 'ar' ? 'التخطيط' : 'Planning' });
      await assertUsable(page, planningChip, 'Planning group chip');
      await planningChip.click();
      await sleep(350);

      // Find card link
      const link = page.locator(`a[href*="/reports/r/${rId}"]`).first();
      await assertUsable(page, link, `link to ${rId}`);
      await link.click();
      await page.waitForURL(`**\/reports/r/${rId}*`, { timeout: 10000 });
      await sleep(400);
      await page.evaluate(() => window.scrollTo(0, 0));

      // Test interactive controls per report
      if (['bills-tracker', 'who-spent-what', 'unusual-spending'].includes(rId)) {
        const prevBtn = page.locator('button[aria-label="Previous month"], button[aria-label="الشهر السابق"]').first();
        if (await prevBtn.isVisible()) {
          await prevBtn.click();
          await sleep(300);
          const nextBtn = page.locator('button[aria-label="Next month"], button[aria-label="الشهر القادم"]').first();
          if (await nextBtn.isVisible()) {
            await nextBtn.click();
            await sleep(300);
          }
        }
      }

      if (rId === 'monthly-averages') {
        const p3m = page.getByRole('button', { name: locale === 'ar' ? 'آخر 3 أشهر' : 'Last 3 months' });
        if (await p3m.isVisible()) {
          await p3m.click();
          await sleep(300);
          const p12m = page.getByRole('button', { name: locale === 'ar' ? 'هذه السنة' : 'This year' });
          if (await p12m.isVisible()) {
            await p12m.click();
            await sleep(300);
          }
        }
      }

      if (rId === 'search-export') {
        const searchInput = page.locator('input[type="text"]').first();
        if (await searchInput.isVisible()) {
          await searchInput.fill('food');
          await sleep(300);
          const spentChip = page.getByRole('button', { name: locale === 'ar' ? 'مصروف' : 'Spent' });
          if (await spentChip.isVisible()) {
            await spentChip.click();
            await sleep(300);
          }
        }
      }

      if (rId === 'spending-pace') {
        const header = page.locator('h2, h1').first();
        await assertUsable(page, header, 'spending pace header');
      }

      // Navigate back using the back chevron
      const back = page.locator('a[href*="/reports?tab=all"]').first();
      await assertUsable(page, back, `back button on ${rId}`);
      await back.click();
      await page.waitForURL(`**\/reports*`, { timeout: 10000 });
      await sleep(400);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  },

  async reports_wallets(page, { locale }) {
    await page.goto(`${BASE}/${locale}/reports?tab=all`, { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(800);

    const walletReports = [
      'net-worth',
      'balance-over-time',
      'in-out-per-wallet',
      'cash-withdrawals',
      'transfers-log',
    ];

    for (const rId of walletReports) {
      // Ensure Banks & cash group is selected
      const walletsChip = page.getByRole('button', { name: locale === 'ar' ? 'البنوك والكاش' : 'Banks & cash' });
      await assertUsable(page, walletsChip, 'Banks & cash group chip');
      await walletsChip.click();
      await sleep(350);

      // Find card link
      const link = page.locator(`a[href*="/reports/r/${rId}"]`).first();
      await assertUsable(page, link, `link to ${rId}`);
      await link.click();
      await page.waitForURL(`**\/reports/r/${rId}*`, { timeout: 10000 });
      await sleep(400);
      await page.evaluate(() => window.scrollTo(0, 0));

      // Test interactive controls per report
      if (rId === 'balance-over-time') {
        const p12m = page.getByRole('button', { name: locale === 'ar' ? 'آخر 12 شهراً' : 'Last 12 months' });
        if (await p12m.isVisible()) {
          await p12m.click();
          await sleep(300);
          const p6m = page.getByRole('button', { name: locale === 'ar' ? 'آخر 6 أشهر' : 'Last 6 months' });
          if (await p6m.isVisible()) {
            await p6m.click();
            await sleep(300);
          }
        }
      }

      if (['in-out-per-wallet', 'cash-withdrawals'].includes(rId)) {
        const prevBtn = page.locator('button[aria-label="Previous month"], button[aria-label="الشهر السابق"]').first();
        if (await prevBtn.isVisible()) {
          await prevBtn.click();
          await sleep(300);
          const nextBtn = page.locator('button[aria-label="Next month"], button[aria-label="الشهر القادم"]').first();
          if (await nextBtn.isVisible()) {
            await nextBtn.click();
            await sleep(300);
          }
        }
      }

      if (rId === 'transfers-log') {
        const cashChip = page.getByRole('button', { name: locale === 'ar' ? 'كاش' : 'Cash' }).first();
        if (await cashChip.isVisible()) {
          await cashChip.click();
          await sleep(300);
          const allChip = page.getByRole('button', { name: locale === 'ar' ? 'كل المحافظ' : 'All wallets' }).first();
          if (await allChip.isVisible()) {
            await allChip.click();
            await sleep(300);
          }
        }
      }

      // Navigate back using the back chevron
      const back = page.locator('a[href*="/reports?tab=all"]').first();
      await assertUsable(page, back, `back button on ${rId}`);
      await back.click();
      await page.waitForURL(`**\/reports*`, { timeout: 10000 });
      await sleep(400);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  },
};

const MULTI_LOCALE_FLOW_NAMES = [
  'reports_tabs',
  'reports_library',
  'reports_sheets',
  'reports_planning',
  'reports_wallets',
  'our_money',
  'update_balance',
];
const LOCALES = ['en', 'ar'];

const selected = process.argv.slice(2).filter((a) => FLOWS[a]);
const names = selected.length ? selected : Object.keys(FLOWS);
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

const jobs = names.flatMap((name) => {
  if (MULTI_LOCALE_FLOW_NAMES.includes(name)) {
    return LOCALES.flatMap((locale) =>
      VIEWPORTS.map((vp) => ({ name, locale, vp }))
    );
  }
  return (name === 'newgroup' ? [...VIEWPORTS, KEYBOARD] : VIEWPORTS).map((vp) => ({
    name,
    locale: 'en',
    vp,
  }));
});

let failures = 0;
const started = Date.now();
const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const { name, locale, vp: [w, h] } = queue.shift();
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head?.appendChild(style);
      document.addEventListener('DOMContentLoaded', () => {
        document.head?.appendChild(style);
      });
    });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 100)));
    let error = null;
    try {
      if (!MULTI_LOCALE_FLOW_NAMES.includes(name)) {
        await page.goto(BASE + '/en', { waitUntil: 'networkidle', timeout: 45000 });
        await sleep(1200);
      }
      await FLOWS[name](page, { locale, vp: [w, h] });
      if (jsErrors.length) throw new Error('JS errors: ' + jsErrors.join(' | '));
    } catch (e) {
      error = e.message.split('\n')[0].slice(0, 220);
      await page.screenshot({ path: path.join(OUT, `${name}__${locale}__${w}x${h}.png`) }).catch(() => {});
    }
    if (error) failures++;
    const label = MULTI_LOCALE_FLOW_NAMES.includes(name) ? `${name} ${locale}` : name;
    console.log(`${error ? 'FAIL' : 'ok  '} ${label} ${w}x${h}${error ? ' -> ' + error : ''}`);
    await ctx.close();
  }
}));
await browser.close();
console.log(`\n${failures ? failures + ' flow run(s) failed' : 'all flows ok'} — ${jobs.length} runs in ${((Date.now() - started) / 1000).toFixed(0)}s`);
process.exit(failures ? 1 : 0);

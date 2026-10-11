// scripts/ui/flows/entry.mjs
// User flows for entry creation and sheet editing: income, expense, switchtype, date, photo.

import { tap, btn, sleep, assertUsable } from '../helpers.mjs';

const saveRegex = /^(Save|Saved|حفظ|تم الحفظ)$/;

async function openSheet(page, locale = 'en') {
  const addBtn = page.getByRole('button', { name: locale === 'ar' ? 'إضافة' : 'Add entry', exact: true }).first();
  await assertUsable(page, addBtn, 'Add entry button');
  await addBtn.click();
  await page.locator('[data-slot="drawer-content"], [role="dialog"]').first().waitFor({ state: 'visible', timeout: 8000 });
  await sleep(400);
}

async function typeDigits(page, digits) {
  for (const d of digits) {
    const digitBtn = page.getByRole('button', { name: d, exact: true }).first();
    await assertUsable(page, digitBtn, `Digit ${d}`);
    await digitBtn.click();
    await sleep(80);
  }
}

async function getSaveButton(page) {
  return page.getByRole('button', { name: saveRegex }).last();
}

export async function income(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  await openSheet(page, locale);

  // Switch to Money In
  const moneyIn = btn(page, locale === 'ar' ? 'دخل' : 'Money in');
  await assertUsable(page, moneyIn, 'Money in toggle');
  await moneyIn.click();
  await sleep(250);

  // Type 5,000
  await typeDigits(page, ['5', '0', '0', '0']);

  // Pick Category -> Subcategory -> Item
  const catBtn = btn(page, locale === 'ar' ? /الدخل|دخل/ : 'Income');
  await assertUsable(page, catBtn, 'Income category');
  await catBtn.click();
  await sleep(200);

  const subBtn = btn(page, locale === 'ar' ? 'دخل ثابت' : 'Regular');
  await assertUsable(page, subBtn, 'Regular group');
  await subBtn.click();
  await sleep(200);

  const itemBtn = btn(page, locale === 'ar' ? 'معاش' : 'Pension');
  await assertUsable(page, itemBtn, 'Pension item');
  await itemBtn.click();
  await sleep(300);

  // Save
  const save = await getSaveButton(page);
  await assertUsable(page, save, 'Save button');
  await save.click();
  await sleep(1200);
}

export async function expense(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  await openSheet(page, locale);

  // Type 250
  await typeDigits(page, ['2', '5', '0']);

  // Pick Food -> Groceries -> Supermarket
  const foodBtn = btn(page, locale === 'ar' ? 'طعام' : 'Food');
  await assertUsable(page, foodBtn, 'Food category');
  await foodBtn.click();
  await sleep(200);

  const grocBtn = btn(page, locale === 'ar' ? 'بقالة' : 'Groceries');
  await assertUsable(page, grocBtn, 'Groceries group');
  await grocBtn.click();
  await sleep(200);

  const supBtn = btn(page, locale === 'ar' ? 'سوبرماركت' : 'Supermarket');
  await assertUsable(page, supBtn, 'Supermarket item');
  await supBtn.click();
  await sleep(300);

  // Save
  const save = await getSaveButton(page);
  await assertUsable(page, save, 'Save button');
  await save.click();
  await sleep(1200);
}

export async function switchtype(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  await openSheet(page, locale);

  // Type 100
  await typeDigits(page, ['1', '0', '0']);

  // Switch to Money in
  const moneyIn = btn(page, locale === 'ar' ? 'دخل' : 'Money in');
  await assertUsable(page, moneyIn, 'Money in toggle');
  await moneyIn.click();
  await sleep(300);

  // Switch back to Money out
  const moneyOut = btn(page, locale === 'ar' ? 'مصروف' : 'Money out');
  await assertUsable(page, moneyOut, 'Money out toggle');
  await moneyOut.click();
  await sleep(300);

  // Close sheet
  await page.keyboard.press('Escape');
  await sleep(400);
}

export async function date(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  await openSheet(page, locale);

  const dateChip = page.getByRole('button', { name: locale === 'ar' ? /اليوم|اختر يوماً/ : /Today|Pick a day/ }).first();
  await assertUsable(page, dateChip, 'Date picker chip');
  await dateChip.click();
  await sleep(400);

  const yesterdayBtn = page.getByRole('button', { name: locale === 'ar' ? 'أمس' : 'Yesterday' }).first();
  if (await yesterdayBtn.isVisible().catch(() => false)) {
    await yesterdayBtn.click();
    await sleep(300);
  } else {
    await page.keyboard.press('Escape');
  }

  await sleep(300);
  await page.keyboard.press('Escape');
}

export async function photo(page, { url, locale = 'en' }) {
  await page.goto(`${url}/${locale}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);

  await openSheet(page, locale);

  // Generate synthetic JPEG buffer in page
  const jpegBase64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const g = c.getContext('2d');
    g.fillStyle = '#2563EB';
    g.fillRect(0, 0, 1200, 800);
    g.fillStyle = '#FFFFFF';
    g.font = '48px sans-serif';
    g.fillText('Receipt Test', 100, 100);
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  });

  const photoInput = page.locator('input[type="file"]').first();
  if (await photoInput.count()) {
    await photoInput.setInputFiles({
      name: 'receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(jpegBase64, 'base64'),
    });
    await sleep(600);
  }

  await page.keyboard.press('Escape');
}

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
async function saveButton(page) {
  return page.getByRole('button', { name: /^(Save|Saved)$/ }).last();
}

const FLOWS = {
  async income(page) {
    const before = await homeNumbers(page);
    await openSheet(page);
    await tap(page, 'Money in');
    await typeAmount(page, ['5', '0', '0', '0']);
    await tap(page, 'Next');
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
    await tap(page, 'Next');
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
    await tap(page, 'Next');
    await assertUsable(page, btn(page, 'Income'), 'income category after choosing Money in');
    if (await btn(page, 'Food').isVisible().catch(() => false)) throw new Error('expense category "Food" shown for Money in');
    await tap(page, 'Edit amount').catch(async () => { await page.getByText('100').first().click(); });
    await tap(page, 'Money out');
    await tap(page, 'Next');
    await assertUsable(page, btn(page, 'Food'), 'expense category after switching back to Money out');
    if (await btn(page, 'Income').isVisible().catch(() => false)) throw new Error('income category still shown after switching to Money out');
  },
  async newgroup(page) {
    await openSheet(page);
    await typeAmount(page, ['5', '0']);
    await tap(page, 'Next');
    await tap(page, 'Food');
    await tap(page, '+ New Group');
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
};

const selected = process.argv.slice(2).filter((a) => FLOWS[a]);
const names = selected.length ? selected : Object.keys(FLOWS);
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const jobs = names.flatMap((name) => (name === 'newgroup' ? [...VIEWPORTS, KEYBOARD] : VIEWPORTS).map((vp) => ({ name, vp })));
let failures = 0;
const started = Date.now();
const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const { name, vp: [w, h] } = queue.shift();
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 100)));
    let error = null;
    try {
      await page.goto(BASE + '/en', { waitUntil: 'networkidle', timeout: 45000 });
      await sleep(1200);
      await FLOWS[name](page);
      if (jsErrors.length) throw new Error('JS errors: ' + jsErrors.join(' | '));
    } catch (e) {
      error = e.message.split('\n')[0].slice(0, 220);
      await page.screenshot({ path: path.join(OUT, `${name}__${w}x${h}.png`) }).catch(() => {});
    }
    if (error) failures++;
    console.log(`${error ? 'FAIL' : 'ok  '} ${name} ${w}x${h}${error ? ' -> ' + error : ''}`);
    await ctx.close();
  }
}));
await browser.close();
console.log(`\n${failures ? failures + ' flow run(s) failed' : 'all flows ok'} — ${jobs.length} runs in ${((Date.now() - started) / 1000).toFixed(0)}s`);
process.exit(failures ? 1 : 0);

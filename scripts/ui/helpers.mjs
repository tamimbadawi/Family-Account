// scripts/ui/helpers.mjs
// Test helpers for user action flows with elementFromPoint accessibility probes.

import fs from 'node:fs';
import path from 'node:path';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Loads JSON translation message files for a specific namespace.
 */
export function loadMessages(ns) {
  const enPath = path.resolve(`messages/en/${ns}.json`);
  const arPath = path.resolve(`messages/ar/${ns}.json`);
  return {
    en: fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf8')) : {},
    ar: fs.existsSync(arPath) ? JSON.parse(fs.readFileSync(arPath, 'utf8')) : {},
  };
}

/**
 * Checks that an element is visible, within the viewport, and NOT covered by another element.
 */
export async function assertUsable(page, locator, description = 'Element') {
  await locator.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {
    throw new Error(`${description}: not visible within 8s`);
  });

  await locator.first().scrollIntoViewIfNeeded().catch(() => {});

  const probe = await locator.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;

    if (r.width < 1 || r.height < 1) return 'zero size';
    if (y < 0 || y > window.innerHeight || x < 0 || x > window.innerWidth) return 'outside viewport';

    const top = document.elementFromPoint(x, y);
    if (!top) return 'no element at point';
    if (top.tagName === 'NEXTJS-PORTAL') return 'ok';
    if (el === top || el.contains(top) || top.contains(el)) return 'ok';

    const topDesc = `${top.tagName.toLowerCase()}${top.className ? '.' + String(top.className).slice(0, 30) : ''}`;
    return `covered by ${topDesc}`;
  });

  if (probe !== 'ok') {
    throw new Error(`${description}: ${probe}`);
  }
}

/**
 * Finds a button, radio, or clickable interactive element by name/role/label.
 */
export function btn(page, name) {
  if (typeof name !== 'string' && !(name instanceof RegExp)) return name;
  return page.getByRole('button', { name, exact: typeof name === 'string' })
    .or(page.getByRole('radio', { name, exact: typeof name === 'string' }))
    .or(page.getByRole('link', { name, exact: typeof name === 'string' }))
    .first();
}

/**
 * Taps an element by name, role, or locator after verifying it is visible and not covered.
 */
export async function tap(page, target, description) {
  let locator;
  if (typeof target === 'string' || target instanceof RegExp) {
    locator = btn(page, target);
  } else {
    locator = target;
  }

  const desc = description || (typeof target === 'string' ? `"${target}"` : 'Target');
  await assertUsable(page, locator, `Tap target ${desc}`);
  await locator.click();
  await sleep(350);
}

/**
 * Types text into an input field located by label or role.
 */
export async function type(page, labelOrRole, text) {
  const input = page.getByLabel(labelOrRole).or(page.getByRole('textbox', { name: labelOrRole })).first();
  await assertUsable(page, input, `Input field "${labelOrRole}"`);
  await input.fill(text);
  await sleep(250);
}

/**
 * Asserts that text or element is visible and not covered.
 */
export async function expectVisible(page, target, description) {
  const locator = typeof target === 'string' ? page.getByText(target).first() : target.first();
  const desc = description || (typeof target === 'string' ? `Text "${target}"` : 'Target');
  await assertUsable(page, locator, desc);
}

/**
 * Asserts that the page itself does not scroll vertically.
 */
export async function expectNoPageScroll(page) {
  const scrolls = await page.evaluate(() => {
    const se = document.scrollingElement || document.documentElement;
    return se.scrollHeight > window.innerHeight + 2;
  });
  if (scrolls) {
    throw new Error('Page itself scrolls vertically (violates fixed full-screen native shell requirement).');
  }
}

/**
 * Navigates back via back button or browser history.
 */
export async function back(page) {
  const backBtn = page.locator('a[aria-label="Back"], button[aria-label="Back"], a[href*=".."], nav a').first();
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click();
  } else {
    await page.goBack();
  }
  await sleep(400);
}

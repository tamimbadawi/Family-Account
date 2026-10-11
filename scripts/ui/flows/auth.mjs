// scripts/ui/flows/auth.mjs
// Authentication setup flow: logs in with test credentials and saves storageState.

import fs from 'node:fs';
import path from 'node:path';
import { tap, type, sleep, assertUsable } from '../helpers.mjs';

export async function auth_setup(page, { url, locale = 'en' }) {
  const envTestPath = path.resolve('.env.test');
  let testUsername = 'injy';
  let testPassword = 'password123';

  if (fs.existsSync(envTestPath)) {
    const content = fs.readFileSync(envTestPath, 'utf8');
    const uMatch = content.match(/TEST_USERNAME=(.+)/);
    const pMatch = content.match(/TEST_PASSWORD=(.+)/);
    if (uMatch) testUsername = uMatch[1].trim();
    if (pMatch) testPassword = pMatch[1].trim();
  }

  // Navigate to login
  await page.goto(`${url}/${locale}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(600);

  // If already at home or sample mode redirects
  if (!page.url().includes('/login')) return;

  const usernameInput = page.getByRole('textbox').first();
  if (await usernameInput.isVisible().catch(() => false)) {
    await usernameInput.fill(testUsername);
    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill(testPassword);
      const submitBtn = page.getByRole('button', { name: /Sign in|دخول/i }).first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await sleep(1200);
      }
    }
  }

  // Save storage state for remaining flows
  const outDir = path.resolve('.ui-check');
  fs.mkdirSync(outDir, { recursive: true });
  await page.context().storageState({ path: path.join(outDir, 'auth-state.json') }).catch(() => {});
}

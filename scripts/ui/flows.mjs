// scripts/ui/flows.mjs
// User-action flow runner: executes end-to-end user journeys with Playwright tracing and failure screenshots.

import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';
import { ensureServer } from './server.mjs';
import { CONFIG } from './config.mjs';

// Import all modular flows
import { auth_setup } from './flows/auth.mjs';
import { income, expense, switchtype, date, photo } from './flows/entry.mjs';
import { newgroup, newcategory, settings_categories } from './flows/categories.mjs';
import { bank } from './flows/wallets.mjs';
import { reports_tabs, reports_library, reports_sheets } from './flows/reports.mjs';
import { language_switch, theme_switch } from './flows/preferences.mjs';

const REGISTERED_FLOWS = {
  auth_setup,
  income,
  expense,
  switchtype,
  newgroup,
  newcategory,
  photo,
  date,
  bank,
  reports_tabs,
  reports_library,
  reports_sheets,
  settings_categories,
  language_switch,
  theme_switch,
};

const { values: flags, positionals } = parseArgs({
  options: {
    base: { type: 'string' },
    flows: { type: 'string' },
    quick: { type: 'boolean', default: false },
    prod: { type: 'boolean', default: false },
    parallel: { type: 'string', default: '1' },
  },
  allowPositionals: true,
});

// Filter flows
let flowNames = [];
if (flags.flows) {
  flowNames = flags.flows.split(',').map((f) => f.trim()).filter(Boolean);
} else if (positionals.length > 0) {
  flowNames = positionals.map((f) => f.trim()).filter(Boolean);
} else {
  flowNames = Object.keys(REGISTERED_FLOWS).filter((f) => f !== 'auth_setup');
}

// Validate flows
for (const name of flowNames) {
  if (!REGISTERED_FLOWS[name]) {
    console.error(`Error: Unknown flow "${name}". Available flows: ${Object.keys(REGISTERED_FLOWS).join(', ')}`);
    process.exit(1);
  }
}

// Viewports and locales
const sizes = flags.quick
  ? [CONFIG.quickSize]
  : [...CONFIG.defaultSizes, CONFIG.keyboardSize];

const locales = flags.quick ? ['en'] : CONFIG.locales;

const OUT = path.resolve('.ui-check/flows');
fs.mkdirSync(OUT, { recursive: true });

const startedAt = Date.now();
const server = await ensureServer({ base: flags.base, prod: flags.prod });
const browser = await launch();

console.log(`Running ${flowNames.length} user flow(s) across ${sizes.length} viewport(s) and ${locales.length} locale(s)...\n`);

// Setup authentication first if needed
const authStatePath = path.resolve('.ui-check/auth-state.json');
try {
  const setupCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const setupPage = await setupCtx.newPage();
  await auth_setup(setupPage, { url: server.url, locale: 'en' });
  await setupCtx.close();
} catch (err) {
  console.warn(`[auth] Auth setup skipped: ${err.message}`);
}

const storageState = fs.existsSync(authStatePath) ? authStatePath : undefined;

let totalRuns = 0;
let failures = 0;
const results = [];

for (const name of flowNames) {
  const flowFn = REGISTERED_FLOWS[name];

  for (const [w, h] of sizes) {
    for (const locale of locales) {
      totalRuns++;
      const tag = `${name} [${w}x${h}, ${locale}]`;

      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        storageState,
      });

      await ctx.tracing.start({ screenshots: true, snapshots: true });
      const page = await ctx.newPage();

      let pass = false;
      let errorMsg = null;

      try {
        await flowFn(page, { url: server.url, locale, viewport: [w, h] });
        pass = true;
      } catch (err) {
        errorMsg = err.message;
        failures++;

        // Failure artifact directory
        const failDir = path.join(OUT, `${name}__${w}x${h}__${locale}`);
        fs.mkdirSync(failDir, { recursive: true });

        await page.screenshot({ path: path.join(failDir, 'failure.png') }).catch(() => {});
        await ctx.tracing.stop({ path: path.join(failDir, 'trace.zip') }).catch(() => {});
      } finally {
        if (pass) {
          await ctx.tracing.stop();
        }
        await ctx.close();
      }

      const status = pass ? 'ok  ' : 'FAIL';
      console.log(`${status} ${tag.padEnd(35)} ${errorMsg ? '-> ' + errorMsg : ''}`);

      results.push({
        flow: name,
        width: w,
        height: h,
        locale,
        pass,
        error: errorMsg,
      });
    }
  }
}

await browser.close();
await server.close();

const totalSecs = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\n======================================================`);
console.log(`${failures === 0 ? 'ALL FLOWS PASSED' : `${failures} FLOW RUN(S) FAILED`} — ${totalRuns} total runs in ${totalSecs}s — Traces & failure shots in ${OUT}`);
console.log(`======================================================`);

process.exit(failures ? 1 : 0);

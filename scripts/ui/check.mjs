// scripts/ui/check.mjs
// Screen audit runner: fast, fail-proof, headless layout verification.

import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';
import { ensureServer } from './server.mjs';
import { CONFIG, normalizeRoute } from './config.mjs';

// Parse CLI flags
const { values: flags, positionals } = parseArgs({
  options: {
    base: { type: 'string' },
    routes: { type: 'string' },
    sizes: { type: 'string' },
    themes: { type: 'string' },
    locales: { type: 'string' },
    parallel: { type: 'string', default: String(CONFIG.defaultParallel) },
    quick: { type: 'boolean', default: false },
    prod: { type: 'boolean', default: false },
    'update-baseline': { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

// Determine routes to test
let rawRoutes = [];
if (flags.routes) {
  rawRoutes = flags.routes.split(',').map((r) => r.trim()).filter(Boolean);
} else if (positionals.length > 0) {
  rawRoutes = positionals;
} else {
  rawRoutes = CONFIG.defaultRoutes;
}

const routes = rawRoutes.map(normalizeRoute);

// Determine viewport sizes
let sizes = [];
if (flags.quick) {
  sizes = [CONFIG.quickSize];
} else if (flags.sizes) {
  sizes = flags.sizes.split(',').map((s) => s.trim().split('x').map(Number));
} else {
  sizes = CONFIG.defaultSizes;
}

// Determine themes
let themes = [];
if (flags.quick) {
  themes = [CONFIG.quickTheme];
} else if (flags.themes) {
  themes = flags.themes.split(',').map((t) => t.trim().toLowerCase());
} else {
  themes = CONFIG.defaultThemes;
}

const PARALLEL = Math.max(1, parseInt(flags.parallel, 10) || CONFIG.defaultParallel);
const OUT = path.resolve('.ui-check');
fs.mkdirSync(OUT, { recursive: true });

/**
 * Audit function executed within page context.
 */
function inPageAudit(options) {
  const { minFontSizePx, minTapTargetPx, listRoutes, currentRoute } = options;
  const isListScreen = listRoutes.some((lr) => currentRoute.endsWith(lr));

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const se = document.scrollingElement || document.documentElement;

  const nav = [...document.querySelectorAll('nav')].find((n) => n.getBoundingClientRect().bottom >= vh - 2);
  const barTop = nav ? nav.getBoundingClientRect().top : vh;

  const isVisible = (el) => {
    if (!el || el.offsetParent === null) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const inSheet = (el) => !!el.closest('[data-slot=drawer-content], [role=dialog]');

  const scrollParent = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 2) return p;
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 2) return p;
    }
    return null;
  };

  // Find all elements directly holding visible text
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
  const textEls = [...document.querySelectorAll('body *')].filter(
    (el) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'svg'].includes(el.tagName) && !el.closest('svg') && isVisible(el) && ownText(el)
  );

  const getLabel = (el) => (el.innerText || el.textContent || '').trim().split('\n')[0].slice(0, 28);
  const uniq = (arr) => [...new Set(arr)].slice(0, 6);

  // 1. Page scrolling
  const pageScrolls = se.scrollHeight > se.clientHeight + 2;
  const sideScroll = se.scrollWidth > vw + 1;

  // 2. Text covered by another element or cut by tab bar
  const covered = [];
  const cutByTabBar = [];

  for (const t of textEls) {
    if (inSheet(t)) continue;
    const r = t.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    const sp = scrollParent(t);
    const box = sp ? sp.getBoundingClientRect() : null;
    const y = r.top + r.height / 2;
    const xs = [r.left + 3, r.left + r.width / 2, r.right - 3];

    let blocker = null;
    let offscreen = false;

    for (const x of xs) {
      if (box && (x < box.left || x > box.right || y < box.top || y > box.bottom)) continue;
      if (y >= vh || x < 0 || x >= vw) { offscreen = true; continue; }
      const top = document.elementFromPoint(x, y);
      if (top && !(t === top || t.contains(top) || top.contains(t))) {
        blocker = top;
        break;
      }
    }

    if (!blocker && !offscreen) continue;
    const bigBlocker = blocker && blocker.getBoundingClientRect().width > vw * 0.8;
    if (offscreen || bigBlocker || r.bottom > barTop + 1) {
      cutByTabBar.push(getLabel(t));
    } else {
      covered.push(getLabel(t));
    }
  }

  // 3. Text hidden in scroll area on non-list screens
  const hiddenInScroll = textEls
    .filter((el) => !inSheet(el))
    .filter((el) => {
      const p = scrollParent(el);
      if (!p) return false;
      const r = el.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      return r.bottom > pr.bottom + 1 || r.bottom > barTop + 1;
    })
    .map(getLabel);

  // 4. Text clipped by an ancestor with overflow hidden/clip
  const clipped = textEls
    .filter((el) => !scrollParent(el))
    .filter((el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflow === 'visible') continue;
        const pr = p.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        if (r.bottom > pr.bottom + 1 || r.top < pr.top - 1 || r.right > pr.right + 1 || r.left < pr.left - 1) {
          return true;
        }
      }
      return false;
    })
    .map(getLabel);

  // 5. Text truncated with an ellipsis
  const ellipsis = textEls
    .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow === 'ellipsis')
    .map(getLabel);

  // 6. Font size under project minimum
  const tooSmall = textEls
    .filter((el) => !nav?.contains(el) && parseFloat(getComputedStyle(el).fontSize) < minFontSizePx)
    .map((el) => `${getLabel(el)} (${getComputedStyle(el).fontSize})`);

  // 7. Interactive elements smaller than minimum tap target (44x44)
  const interactiveEls = [...document.querySelectorAll('button, a, [role=button], input')].filter(
    (el) => isVisible(el) && el.getAttribute('type') !== 'hidden'
  );
  const smallTapTargets = interactiveEls
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width < minTapTargetPx || r.height < minTapTargetPx;
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      const desc = el.getAttribute('aria-label') || el.innerText || el.tagName;
      return `${desc.slice(0, 20).trim()} (${Math.round(r.width)}x${Math.round(r.height)})`;
    });

  // 8. Broken images, unlabelled icons/inputs
  const brokenImages = [...document.querySelectorAll('img')]
    .filter((img) => isVisible(img) && img.naturalWidth === 0)
    .map((img) => img.src.slice(-25));

  const unlabelledInputs = [...document.querySelectorAll('input, select, textarea')]
    .filter((input) => isVisible(input) && input.getAttribute('type') !== 'hidden')
    .filter((input) => {
      if (input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')) return false;
      if (input.closest('label')) return false;
      if (input.id && document.querySelector(`label[for="${input.id}"]`)) return false;
      return true;
    })
    .map((input) => input.name || input.id || input.placeholder || input.type);

  const unlabelledIcons = [...document.querySelectorAll('button, a, [role=button]')]
    .filter((el) => isVisible(el) && el.querySelector('svg') && !el.innerText?.trim())
    .filter((el) => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title'))
    .map((el) => el.tagName.toLowerCase());

  // In-page error text
  const inPageErrors = (document.body.innerText.match(/(something went wrong|couldn.t load|NaN|undefined)/gi) || []);

  return {
    pageScrolls: !isListScreen && pageScrolls,
    sideScroll,
    cutByTabBar: !isListScreen ? uniq(cutByTabBar) : [],
    covered: uniq(covered),
    hiddenInScroll: !isListScreen ? uniq(hiddenInScroll) : [],
    clipped: uniq(clipped),
    ellipsis: uniq(ellipsis),
    tooSmall: uniq(tooSmall),
    smallTapTargets: uniq(smallTapTargets),
    brokenImages: uniq(brokenImages),
    unlabelledInputs: uniq(unlabelledInputs),
    unlabelledIcons: uniq(unlabelledIcons),
    inPageErrors: uniq(inPageErrors),
  };
}

// Main execution
const startedAt = Date.now();
const server = await ensureServer({ base: flags.base, prod: flags.prod });
const browser = await launch();

const jobs = routes.flatMap((route) =>
  sizes.flatMap(([w, h]) =>
    themes.map((theme) => ({ route, w, h, theme }))
  )
);

console.log(`Auditing ${routes.length} route(s) across ${sizes.length} size(s) and ${themes.length} theme(s) (${jobs.length} checks, parallel: ${PARALLEL})...\n`);

let failures = 0;
const results = [];

async function runJob({ route, w, h, theme }) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    colorScheme: theme,
    isMobile: true,
    hasTouch: true,
  });

  const page = await ctx.newPage();
  const consoleErrors = [];
  const networkFailures = [];

  page.on('pageerror', (err) => consoleErrors.push(err.message.slice(0, 120)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 120));
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.startsWith(server.url)) networkFailures.push(`${req.method()} ${url.replace(server.url, '')}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().startsWith(server.url)) {
      networkFailures.push(`${res.status()} ${res.url().replace(server.url, '')}`);
    }
  });

  const targetUrl = `${server.url}${route}`;
  let navSuccess = false;

  // Navigate with one retry on failure
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.navTimeoutMs });
      // Wait for network settle and fonts
      await Promise.race([
        page.waitForLoadState('networkidle', { timeout: CONFIG.networkIdleTimeoutMs }).catch(() => {}),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
      await page.waitForTimeout(CONFIG.settleMs);
      navSuccess = true;
      break;
    } catch (err) {
      if (attempt === 2) consoleErrors.push(`nav: ${err.message.slice(0, 80)}`);
    }
  }

  const a = navSuccess
    ? await page.evaluate(inPageAudit, {
        minFontSizePx: CONFIG.minFontSizePx,
        minTapTargetPx: CONFIG.minTapTargetPx,
        listRoutes: CONFIG.listRoutes,
        currentRoute: route,
      }).catch((e) => ({ auditError: e.message }))
    : { navFailed: true };

  const screenshotFileName = `${route.replace(/^\//, '').replace(/[/?&=]/g, '_') || 'root'}__${w}x${h}__${theme}.png`;
  const screenshotPath = path.join(OUT, screenshotFileName);

  if (navSuccess) {
    await page.screenshot({ path: screenshotPath }).catch(() => {});
  }

  const problems = [];
  if (a.navFailed) problems.push('NAVIGATION FAILED');
  if (a.auditError) problems.push(`Audit crashed: ${a.auditError}`);
  if (a.pageScrolls) problems.push('PAGE SCROLLS VERTICALLY (must fit)');
  if (a.sideScroll) problems.push('SIDEWAYS OVERFLOW');
  if (a.cutByTabBar?.length) problems.push(`Cut under tab bar: ${a.cutByTabBar.join(', ')}`);
  if (a.covered?.length) problems.push(`Text covered: ${a.covered.join(', ')}`);
  if (a.hiddenInScroll?.length) problems.push(`Text hidden in scroll: ${a.hiddenInScroll.join(', ')}`);
  if (a.clipped?.length) problems.push(`Clipped by container: ${a.clipped.join(', ')}`);
  if (a.ellipsis?.length) problems.push(`Ellipsis truncated: ${a.ellipsis.join(', ')}`);
  if (a.tooSmall?.length) problems.push(`Text <${CONFIG.minFontSizePx}px: ${a.tooSmall.join(', ')}`);
  if (a.smallTapTargets?.length) problems.push(`Tap target <${CONFIG.minTapTargetPx}px: ${a.smallTapTargets.join(', ')}`);
  if (a.brokenImages?.length) problems.push(`Broken images: ${a.brokenImages.join(', ')}`);
  if (a.unlabelledInputs?.length) problems.push(`Unlabelled inputs: ${a.unlabelledInputs.join(', ')}`);
  if (a.unlabelledIcons?.length) problems.push(`Unlabelled icons: ${a.unlabelledIcons.join(', ')}`);
  if (a.inPageErrors?.length) problems.push(`In-page errors: ${a.inPageErrors.join(', ')}`);
  if (consoleErrors.length) problems.push(`Console errors: ${[...new Set(consoleErrors)].join(' | ')}`);
  if (networkFailures.length) problems.push(`Failed requests: ${[...new Set(networkFailures)].join(' | ')}`);

  const tag = problems.length ? 'FAIL' : 'ok  ';
  if (problems.length) failures++;

  console.log(`${tag} ${route.padEnd(20)} ${w}x${h} ${theme.padEnd(5)} ${problems.length ? '-> ' + problems.join(' ; ') : ''} [${screenshotFileName}]`);

  results.push({
    route,
    width: w,
    height: h,
    theme,
    ok: problems.length === 0,
    problems,
    screenshot: screenshotFileName,
  });

  await ctx.close();
}

// Execute parallel workers
const queue = [...jobs];
await Promise.all(
  Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
    while (queue.length > 0) {
      const job = queue.shift();
      if (job) await runJob(job);
    }
  })
);

await browser.close();
await server.close();

const totalSecs = ((Date.now() - startedAt) / 1000).toFixed(1);
const report = {
  total: jobs.length,
  passed: jobs.length - failures,
  failed: failures,
  durationSeconds: parseFloat(totalSecs),
  results,
};

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

console.log(`\n======================================================`);
console.log(`${failures === 0 ? 'ALL SCREENS OK' : `${failures} SCREEN(S) WITH PROBLEMS`} — ${jobs.length} checks in ${totalSecs}s — Screenshots saved to ${OUT}`);
console.log(`======================================================`);

process.exit(failures ? 1 : 0);

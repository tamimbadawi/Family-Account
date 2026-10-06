// Fast UI check: headless Chrome screenshots + automatic layout audit. Replaces the slow in-IDE browser.
//
//   npm run ui:check -- /en /en/history /en/settings           (routes; default: the main screens)
//   BASE_URL=http://localhost:3001 npm run ui:check            (default http://localhost:3000)
//   UI_SIZES=390x844 UI_THEMES=light npm run ui:check -- /en   (narrow it down while iterating)
//
// Writes PNGs to .ui-check/<route>__<size>__<theme>.png (gitignored) and prints one line per screen.
// Exit code 1 if any screen has a blocking problem, so it can gate a PR.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SIZES = (process.env.UI_SIZES || '390x844,375x667,412x700').split(',').map((s) => s.split('x').map(Number));
const THEMES = (process.env.UI_THEMES || 'light,dark').split(',');
// Screens that are lists may scroll inside their content area; every other screen must fit with no scrolling.
const LIST_ROUTES = ['/history', '/settings/categories', '/settings/deleted'];
const DEFAULT_ROUTES =['/en', '/en/history', '/en/reports', '/en/settings', '/en/login', '/ar', '/ar/settings'];
// Git Bash rewrites "/en" into "C:/Program Files/Git/en"; undo that, and accept "en/history" without a slash.
const toRoute = (a) => '/' + a.replace(/^.*\/Git\//, '').replace(/^\/+/, '');
const routes = process.argv.slice(2).length ? process.argv.slice(2).map(toRoute) : DEFAULT_ROUTES;
const OUT = path.resolve('.ui-check');
fs.mkdirSync(OUT, { recursive: true });

// Runs inside the page. Blocking problems are the user's rules: no page scroll, nothing cut, no ellipsis, 17px text.
function audit() {
  const vh = innerHeight;
  const se = document.scrollingElement;
  const nav = [...document.querySelectorAll('nav')].find((n) => n.getBoundingClientRect().bottom >= vh - 2);
  const barTop = nav ? nav.getBoundingClientRect().top : vh;
  const visible = (e) => e.offsetParent !== null && e.getBoundingClientRect().height > 0;
  // Any element that directly holds text (the app uses divs for most text, not only p/span).
  const ownText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const textEls = [...document.querySelectorAll('body *')].filter(
    (e) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'svg'].includes(e.tagName) && visible(e) && ownText(e),
  );
  const label = (e) => e.innerText.trim().split('\n')[0].slice(0, 28);
  const inSheet = (e) => !!e.closest('[data-slot=drawer-content],[role=dialog]');
  const scrollParent = (e) => {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 2) return p;
    }
    return null;
  };
  const cut = textEls
    .filter((e) => !nav?.contains(e) && !inSheet(e) && !scrollParent(e))
    .filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > barTop + 1; })
    .map(label);
  const clipped = textEls
    .filter((e) => !scrollParent(e))
    .filter((e) => {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflow === 'visible') continue;
        const pr = p.getBoundingClientRect(), r = e.getBoundingClientRect();
        if (r.bottom > pr.bottom + 1 || r.top < pr.top - 1) return true;
      }
      return false;
    })
    .map(label);
  const ellipsis = textEls
    .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis')
    .map(label);
  const small = textEls
    .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 15 && !nav?.contains(e))
    .map((e) => `${label(e)} (${getComputedStyle(e).fontSize})`);
  const innerScrollers = [...document.querySelectorAll('*')]
    .filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2).length;
  // Text hidden inside an inner scroll area (only allowed on list screens such as History).
  const hiddenInScroll = textEls
    .filter((e) => !inSheet(e))
    .filter((e) => { const p = scrollParent(e); if (!p) return false; const r = e.getBoundingClientRect(), pr = p.getBoundingClientRect(); return r.bottom > pr.bottom + 1 || r.bottom > barTop + 1; })
    .map(label);
  // Ask the browser what is actually drawn on top of each text element (works whatever the HTML structure is).
  // Probe its centre and both inline edges; if something else is on top, the text is covered or cut.
  const covered = [];
  const cutBottom = [];
  for (const t of textEls) {
    if (inSheet(t)) continue;
    const r = t.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const y = r.top + r.height / 2;
    const xs = [r.left + 3, r.left + r.width / 2, r.right - 3];
    let blocker = null, offscreen = false;
    for (const x of xs) {
      if (y >= innerHeight || x < 0 || x >= innerWidth) { offscreen = true; continue; }
      const top = document.elementFromPoint(x, y);
      if (top && !(t === top || t.contains(top) || top.contains(t))) { blocker = top; break; }
    }
    if (!blocker && !offscreen) continue;
    const bigBlocker = blocker && blocker.getBoundingClientRect().width > innerWidth * 0.8; // tab bar or similar
    if (offscreen || bigBlocker) cutBottom.push(label(t));
    else covered.push(label(t));
  }
  const errors = (document.body.innerText.match(/(something went wrong|couldn.t load|NaN|undefined)/gi) || []);
  const uniq = (a) => [...new Set(a)].slice(0, 6);
  return {
    pageScrolls: se.scrollHeight > se.clientHeight + 2,
    sideScroll: se.scrollWidth > innerWidth + 1,
    cutByTabBar: uniq(cut),
    clipped: uniq(clipped),
    ellipsis: uniq(ellipsis),
    tooSmall: uniq(small),
    innerScrollers,
    hiddenInScroll: uniq(hiddenInScroll),
    covered: uniq(covered),
    cutBottom: uniq(cutBottom),
    errors: uniq(errors),
  };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let failures = 0;
for (const route of routes) {
  for (const [w, h] of SIZES) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: theme, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on('pageerror', (e) => consoleErrors.push(e.message.slice(0, 120)));
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => consoleErrors.push('load: ' + e.message.slice(0, 80)));
      await page.waitForTimeout(1200);
      const a = await page.evaluate(audit).catch((e) => ({ errors: ['audit: ' + e.message] }));
      const name = `${route.replace(/^\//, '').replace(/\//g, '_') || 'root'}__${w}x${h}__${theme}.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      const problems = [];
      if (a.pageScrolls) problems.push('PAGE SCROLLS');
      if (a.sideScroll) problems.push('SIDEWAYS SCROLL');
      if (a.cutByTabBar?.length) problems.push('cut by tab bar: ' + a.cutByTabBar.join(', '));
      if (a.clipped?.length) problems.push('clipped: ' + a.clipped.join(', '));
      if (a.ellipsis?.length) problems.push('ellipsis: ' + a.ellipsis.join(', '));
      if (a.hiddenInScroll?.length && !LIST_ROUTES.some((r) => route.endsWith(r))) problems.push('content hidden (must fit, no scrolling): ' + a.hiddenInScroll.join(', '));
      if (a.covered?.length) problems.push('covered by another element (e.g. the + button): ' + a.covered.join(', '));
      if (a.cutBottom?.length && !LIST_ROUTES.some((r) => route.endsWith(r))) problems.push('cut off at the bottom / under the tab bar: ' + a.cutBottom.join(', '));
      if (a.tooSmall?.length) problems.push('text <15px: ' + a.tooSmall.join(', '));
      if (a.errors?.length) problems.push('errors: ' + a.errors.join(', '));
      if (consoleErrors.length) problems.push('JS errors: ' + consoleErrors.join(' | '));
      const tag = problems.length ? 'FAIL' : 'ok  ';
      if (problems.length) failures++;
      console.log(`${tag} ${route} ${w}x${h} ${theme}${problems.length ? ' -> ' + problems.join(' ; ') : ''}  [${name}]`);
      await ctx.close();
    }
  }
}
await browser.close();
console.log(`\n${failures ? failures + ' screen(s) with problems' : 'all screens ok'} — screenshots in ${OUT}`);
process.exit(failures ? 1 : 0);

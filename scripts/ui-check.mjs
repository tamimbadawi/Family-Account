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

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const ALL_PROFILES = [
  // iPhone profiles
  { name: 'iphone', os: 'ios', w: 390, h: 844, ua: IPHONE_UA },
  { name: 'iphone-se', os: 'ios', w: 375, h: 667, ua: IPHONE_UA },
  // Android Chrome profiles: common mid-range (412x915), small budget (360x640), tall narrow (360x800), browser viewport (412x700)
  { name: 'android-mid', os: 'android', w: 412, h: 915, ua: ANDROID_UA },
  { name: 'android-budget', os: 'android', w: 360, h: 640, ua: ANDROID_UA },
  { name: 'android-tall', os: 'android', w: 360, h: 800, ua: ANDROID_UA },
  { name: 'android-browser', os: 'android', w: 412, h: 700, ua: ANDROID_UA },
];

const rawArgs = process.argv.slice(2);
const isQuick = rawArgs.includes('--quick');
const routesIdx = rawArgs.indexOf('--routes');
let routesArg = [];
if (routesIdx !== -1) {
  for (let i = routesIdx + 1; i < rawArgs.length && !rawArgs[i].startsWith('--'); i++) {
    routesArg.push(rawArgs[i]);
  }
} else {
  routesArg = rawArgs.filter((a) => !a.startsWith('--'));
}

let profiles = ALL_PROFILES;
if (process.env.UI_SIZES) {
  const sizes = process.env.UI_SIZES.split(',').map((s) => s.split('x').map(Number));
  profiles = sizes.map(([w, h]) => {
    const existing = ALL_PROFILES.find((p) => p.w === w && p.h === h);
    if (existing) return existing;
    const isIos = w === 390 || (w === 375 && h === 667);
    return {
      name: `${isIos ? 'iphone' : 'android'}-${w}x${h}`,
      os: isIos ? 'ios' : 'android',
      w,
      h,
      ua: isIos ? IPHONE_UA : ANDROID_UA,
    };
  });
} else if (isQuick) {
  profiles = [ALL_PROFILES[0]];
}

const THEMES = isQuick ? ['light'] : (process.env.UI_THEMES || 'light,dark').split(',');
// Screens that are lists may scroll inside their content area; every other screen must fit with no scrolling.
const LIST_ROUTES = ['/history', '/settings/categories', '/settings/deleted', '/settings/budgets', '/settings/recurring', '/settings/goals'];
const DEFAULT_ROUTES =['/en', '/en/history', '/en/reports', '/en/settings', '/en/login', '/ar', '/ar/settings'];
// Git Bash rewrites "/en" into "C:/Program Files/Git/en"; undo that, and accept "en/history" without a slash.
const toRoute = (a) => '/' + a.replace(/^.*\/Git\//, '').replace(/^\/+/, '');
const routes = routesArg.length ? routesArg.map(toRoute) : DEFAULT_ROUTES;
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
    (e) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'svg'].includes(e.tagName) && !e.closest('svg') && visible(e) && ownText(e),
  );
  const label = (e) => (e.innerText || e.textContent || '').trim().split('\n')[0].slice(0, 28);
  const inSheet = (e) => !!e.closest('[data-slot=drawer-content],[role=dialog]');
  const scrollParent = (e) => {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 2) return p;
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 2) return p;
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
    // Inside a scroll area, points scrolled out of the area's visible box are legitimately hidden (e.g. pivot
    // columns off to the side, list rows below the fold): skip those points. Points that ARE on screen inside the
    // area are still checked, so a floating button covering a visible row is always caught.
    const sp = scrollParent(t);
    const box = sp ? sp.getBoundingClientRect() : null;
    const y = r.top + r.height / 2;
    const xs = [r.left + 3, r.left + r.width / 2, r.right - 3];
    let blocker = null, offscreen = false;
    for (const x of xs) {
      if (box && (x < box.left || x > box.right || y < box.top || y > box.bottom)) continue;
      if (y >= innerHeight || x < 0 || x >= innerWidth) { offscreen = true; continue; }
      const top = document.elementFromPoint(x, y);
      if (top && !(t === top || t.contains(top) || top.contains(t))) { blocker = top; break; }
    }
    if (!blocker && !offscreen) continue;
    const bigBlocker = blocker && blocker.getBoundingClientRect().width > innerWidth * 0.8; // tab bar or similar
    if (offscreen || bigBlocker) cutBottom.push(label(t));
    else covered.push(label(t));
  }
  const errors = (document.body.innerText.match(/(something went wrong|couldn.t load|\bNaN\b|\bundefined\b)/gi) || []);
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
const started = Date.now();
const jobs = routes.flatMap((route) => profiles.flatMap((profile) => THEMES.map((theme) => ({ route, profile, theme }))));
const PARALLEL = Number(process.env.UI_PARALLEL || 4);
async function runJob({ route, profile, theme }) {
      const { w, h, ua } = profile;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: theme, isMobile: true, hasTouch: true, userAgent: ua });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        const style = document.createElement('style');
        style.textContent = 'nextjs-portal { display: none !important; }';
        document.head?.appendChild(style);
        document.addEventListener('DOMContentLoaded', () => {
          document.head?.appendChild(style);
        });
        // The welcome guide starts by itself on a first visit; keep it off the screens being checked
        try { localStorage.setItem('fa_tour_seen', '1'); } catch {}
      });
      const consoleErrors = [];
      page.on('pageerror', (e) => consoleErrors.push(e.message.slice(0, 120)));
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => consoleErrors.push('load: ' + e.message.slice(0, 80)));
      await page.waitForTimeout(1200);
      const a = await page.evaluate(audit).catch((e) => ({ errors: ['audit: ' + e.message] }));
      const name = `${route.replace(/^\//, '').replace(/[/?&=]/g, '_') || 'root'}__${w}x${h}__${theme}.png`;
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
const queue = [...jobs];
await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
  while (queue.length) await runJob(queue.shift());
}));
await browser.close();
const secs = ((Date.now() - started) / 1000).toFixed(0);
console.log(`\n${failures ? failures + ' screen(s) with problems' : 'all screens ok'} — ${jobs.length} checks in ${secs}s — screenshots in ${OUT}`);
process.exit(failures ? 1 : 0);

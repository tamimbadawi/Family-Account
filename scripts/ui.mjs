// The two everyday UI checks (headless Chrome, never the IDE browser). The dev server is started once and kept warm.
//
//   npm run ui:feature                               only the screens and flows touched by the current changes
//   npm run ui:feature -- --routes /settings,/reports   name the screens yourself
//   npm run ui:site                                  every screen (2 phone sizes, light + dark, en + ar) and every flow
//   npm run ui:site -- --full                        the same on all 6 phone sizes (the release gate; about 12 minutes)
//   npm run ui:stop                                  stop the dev server the checks keep running
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { answers, ensureBuiltServer, ensureServer, stopServer } from './ui-server.mjs';

const [mode, ...args] = process.argv.slice(2);
const LOCALES = ['en', 'ar'];
const APP = 'src/app/[locale]';
// Screens that need a signed-in live account or an invite link (they cannot be opened on sample data), and the
// developer-only style guide pages, which are long reference pages and not part of the app.
const NOT_CHECKABLE = ['/operator', '/join', '/choose-password', '/styleguide', '/styleguide/entry'];
// A screen with a changing part in its address is checked with this example.
const SAMPLE = {
  '/reports/r/[id]': '/reports/r/this-vs-last-month',
  '/money/investment/[id]': '/money/investment/aaaaaaaa-0000-0000-0000-0000000000e1',
};
// Which screens each flow in ui-flows.mjs walks through. A flow missing here runs whenever anything changed.
const FLOW_ROUTES = {
  income: [''], expense: [''], switchtype: [''], newgroup: [''], newcategory: [''], photo: ['', '/history'],
  date: [''], bank: [''], save_at_level: ['', '/history'],
  reports_tabs: ['/reports'], reports_library: ['/reports'], reports_sheets: ['/reports', '/reports/r/[id]'],
  reports_planning: ['/reports'], reports_wallets: ['/reports'], our_money: ['/reports'],
  update_balance: ['/settings/wallets'], download_data: ['/settings'],
  history_filter: ['/history'], history_search: ['/history'],
  budgets: ['', '/settings', '/settings/budgets', '/reports/r/[id]'], budget_alerts: ['', '/settings/budgets'],
  recurring_entries: ['', '/settings/recurring'], savings_goals: ['', '/settings/goals'],
  investment_add: ['', '/money'],
  investment_paid: ['', '/money'],
  investment_value: ['', '/money', '/money/investment/[id]'],
  investment_take: ['', '/money', '/money/investment/[id]'],
};

const posix = (p) => p.split(path.sep).join('/');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [posix(path.join(dir, e.name))],
  );
}
const sourceFiles = walk('src').filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f));

/** Every screen: its address without the language ('' is Home) and the files that make it up. */
function screens() {
  return sourceFiles
    .filter((f) => f.startsWith(APP + '/') && f.endsWith('/page.tsx'))
    .map((page) => {
      const dir = path.posix.dirname(page);
      const route = dir.slice(APP.length).split('/').filter((s) => s && !s.startsWith('(')).map((s) => '/' + s).join('');
      // The page plus every layout above it.
      const roots = [page];
      for (let d = dir; d.startsWith('src/app'); d = path.posix.dirname(d)) {
        for (const name of ['layout.tsx', 'template.tsx', 'loading.tsx', 'error.tsx']) {
          if (sourceFiles.includes(`${d}/${name}`)) roots.push(`${d}/${name}`);
        }
      }
      return { route, roots };
    })
    .filter((s) => !NOT_CHECKABLE.includes(s.route) && (!s.route.includes('[') || SAMPLE[s.route]));
}

const importsOf = new Map();
function imports(file) {
  if (importsOf.has(file)) return importsOf.get(file);
  const text = fs.readFileSync(file, 'utf8');
  const found = [];
  for (const m of text.matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    const base = spec.startsWith('@/') ? 'src/' + spec.slice(2) : spec.startsWith('.') ? path.posix.join(path.posix.dirname(file), spec) : null;
    if (!base) continue;
    const hit = ['', '.ts', '.tsx', '.css', '/index.ts', '/index.tsx'].map((ext) => base + ext).find((p) => sourceFiles.includes(p));
    if (hit) found.push(hit);
  }
  importsOf.set(file, found);
  return found;
}
function reach(roots) {
  const seen = new Set(roots);
  for (const queue = [...roots]; queue.length; ) {
    for (const next of imports(queue.pop())) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  }
  return seen;
}

function changedFiles() {
  const git = (cmd) => execSync('git ' + cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').map((l) => l.trim()).filter(Boolean);
  let base = 'HEAD';
  for (const ref of ['origin/main', 'main']) {
    try { base = git(`merge-base HEAD ${ref}`)[0]; break; } catch {}
  }
  return [...new Set([...git(`diff --name-only ${base}`), ...git('ls-files --others --exclude-standard')])];
}

/** The screens touched by the changed files; `all: true` when a change could show up anywhere. */
function touchedScreens(all) {
  const files = changedFiles().filter((f) => /^(src\/|messages\/|public\/|scripts\/ui|next\.config|proxy\.ts|package\.json|postcss\.config)/.test(f) && !/\.test\./.test(f));
  if (!files.length) return { routes: [], files };
  const reached = all.map((s) => ({ ...s, files: reach(s.roots) }));
  const hit = new Set();
  for (const file of files) {
    let targets = [file];
    const ns = file.match(/^messages\/\w+\/([\w-]+)\.json$/)?.[1];
    if (ns) {
      // A wording file touches the files that read that namespace.
      const reader = new RegExp(`Translations\\(\\s*['"]${ns}['"]|namespace:\\s*['"]${ns}['"]`);
      targets = sourceFiles.filter((f) => reader.test(fs.readFileSync(f, 'utf8')));
    }
    const users = reached.filter((s) => targets.some((t) => s.files.has(t)));
    // Used by no screen we can trace (settings, the service worker, a public file…): it could show up anywhere.
    if (!users.length) return { routes: all.map((s) => s.route), files };
    users.forEach((s) => hit.add(s.route));
  }
  return { routes: [...hit], files };
}

function run(script, scriptArgs, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...scriptArgs], { env: { ...process.env, ...env } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
  });
}
const result = (name) => {
  try { return JSON.parse(fs.readFileSync(path.resolve('.ui-check', name), 'utf8')); } catch { return { runs: 0, failed: 0 }; }
};
const address = (route) => SAMPLE[route] ?? route;

if (mode === 'stop') {
  console.log(stopServer() ? 'Stopped the dev server.' : 'No dev server was running.');
  process.exit(0);
}
if (mode !== 'feature' && mode !== 'site') {
  console.error('Use: npm run ui:feature | npm run ui:site | npm run ui:stop');
  process.exit(1);
}

const started = Date.now();
const all = screens();
let routes;
if (mode === 'site') {
  routes = all.map((s) => s.route);
} else {
  const i = args.indexOf('--routes');
  // Git Bash rewrites "/settings" into "C:/Program Files/Git/settings"; undo that, and accept names without a slash.
  const named = i === -1 ? null : args.slice(i + 1).join(',').split(',').filter(Boolean)
    .map((r) => '/' + r.replace(/^.*\/Git\//, '').replace(/^\/+|\/+$/g, '').replace(/^(en|ar)(\/|$)/, ''))
    .map((r) => (r === '/' ? '' : r));
  routes = named ?? touchedScreens(all).routes;
  if (!routes.length) {
    console.log('ui:feature — no screen is touched by the current changes, nothing to check.');
    process.exit(0);
  }
  console.log(`Screens: ${routes.map((r) => r || '/').join(' ')}`);
}

const urls = routes.flatMap((r) => LOCALES.map((l) => `/${l}${address(r)}`));
const flows = Object.keys(FLOW_ROUTES).filter((f) => FLOW_ROUTES[f].some((r) => routes.includes(r)));
// Build, before the clock starts, every screen the chosen flows walk through as well (they all start from Home).
const warm = [...new Set([...urls, ...flows.flatMap((f) => ['', ...FLOW_ROUTES[f]]).flatMap((r) => LOCALES.map((l) => `/${l}${address(r)}`))])];
// While building: the dev server, which picks up every edit at once. Whole site: the finished app, which is the
// only thing fast enough to feed hundreds of screens at once (rebuilt only when the code has changed).
const { base, fresh } = mode === 'site' ? await ensureBuiltServer() : await ensureServer(warm);
if (fresh) console.log(`${mode === 'site' ? 'Built and started the app' : 'Started the dev server'} at ${base} (kept running for the next check).`);
const waited = Date.now();
for (const name of ['last-check.json', 'last-flows.json']) fs.rmSync(path.resolve('.ui-check', name), { force: true });

// Screens and flows run side by side. More pages at once than this overloads the machine and is slower, not faster.
const full = mode === 'site' && args.includes('--full');
// --full is the release gate: original waits, every line printed.
const env = { BASE_URL: base, UI_PARALLEL: '4', ...(full ? {} : { UI_FAST: '1' }) };
// feature: one iPhone, light. site: every screen on the main iPhone and the smallest Android, light and dark, and
// every flow on the iPhone (plus the keyboard-open size). site --full: every size for both (the release gate).
const screenSizes = mode === 'feature' ? { UI_SIZES: '390x844', UI_THEMES: 'light' } : full ? {} : { UI_SIZES: '390x844,360x640' };
const flowSizes = full ? {} : { UI_SIZES: '390x844' };
const [check, flow] = await Promise.all([
  run('scripts/ui-check.mjs', ['--routes', ...urls], { ...env, ...screenSizes }),
  mode === 'site' || flows.length
    ? run('scripts/ui-flows.mjs', mode === 'site' ? [] : flows, { ...env, ...flowSizes })
    : { code: 0, out: '' },
]);
process.stdout.write(check.out + flow.out);
if (!(await answers(base, 5000))) console.log(`
The server stopped during the check, so the result above is not valid. Run it again; last lines of its log are in .ui-check/server.log.`);

const c = result('last-check.json');
const f = mode === 'site' || flows.length ? result('last-flows.json') : { runs: 0, failed: 0 };
// A script that stopped without reporting a failure crashed; count that as a failure too.
const failed = c.failed + f.failed + (check.code && !c.failed ? 1 : 0) + (flow.code && !f.failed ? 1 : 0);
const secs = ((Date.now() - waited) / 1000).toFixed(1);
const startup = fresh ? `, plus ${((waited - started) / 1000).toFixed(0)}s to ${mode === 'site' ? 'build and start the app' : 'start the server'}` : '';
console.log(`\nui:${mode} — ${failed ? 'FAIL' : 'ok'} — ${c.runs} screens, ${f.runs} flow runs, ${failed} failed, ${secs}s${startup}`);
process.exit(failed ? 1 : 0);

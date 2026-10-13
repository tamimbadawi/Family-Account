// Dev server for the UI checks: started once, left running, reused by the next run (so checks take seconds).
// Its address and process id live in .ui-check/server.json; `npm run ui:stop` ends it.
import { spawn, spawnSync, execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const DIR = path.resolve('.ui-check');
const STATE = path.join(DIR, 'server.json');
const LOG = path.join(DIR, 'server.log');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function answers(url, ms) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms), redirect: 'manual' });
    return res.status < 500;
  } catch {
    return false;
  }
}
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
function killTree(pid) {
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-pid, 'SIGTERM');
  } catch {}
}
const logTail = (lines) => (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').slice(-lines).join('\n') : '');

const BUILT = path.join(DIR, 'server-built.json');
const NEXT = path.resolve('node_modules/next/dist/bin/next');
// The checks always run on sample data, whatever .env.local says.
const ENV = { ...process.env, NEXT_PUBLIC_DATA_MODE: 'mock' };

function stop(file) {
  if (!fs.existsSync(file)) return false;
  killTree(JSON.parse(fs.readFileSync(file, 'utf8')).pid);
  fs.rmSync(file, { force: true });
  return true;
}
export function stopServer() {
  return [STATE, BUILT].map(stop).some(Boolean);
}

/** Changes with every edit to the code, so a finished build is reused only while nothing has changed. */
function codeVersion() {
  const git = (cmd) => execSync('git ' + cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  const untracked = git('ls-files --others --exclude-standard').split('\n').filter(Boolean)
    .map((f) => { try { return f + fs.statSync(f).mtimeMs; } catch { return f; } });
  return crypto.createHash('sha1').update(git('rev-parse HEAD') + git('diff HEAD') + untracked.join()).digest('hex');
}

/**
 * The finished app (`next build` + `next start`), for the whole-site check: a dev server is far too slow to feed
 * hundreds of screens at once. Built again only when the code has changed since the last build.
 */
export async function ensureBuiltServer() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ''), fresh: false };
  fs.mkdirSync(DIR, { recursive: true });
  const version = codeVersion();
  if (fs.existsSync(BUILT)) {
    const state = JSON.parse(fs.readFileSync(BUILT, 'utf8'));
    if (state.version === version && (await answers(state.url, 2000))) return { base: state.url, fresh: false };
    stop(BUILT);
  }
  const buildLog = path.join(DIR, 'build.log');
  const build = spawnSync(process.execPath, [NEXT, 'build'], { env: ENV, encoding: 'utf8' });
  fs.writeFileSync(buildLog, (build.stdout || '') + (build.stderr || ''));
  if (build.status !== 0) {
    console.error(`The build failed. Last lines of ${buildLog}:\n${fs.readFileSync(buildLog, 'utf8').split('\n').slice(-40).join('\n')}`);
    process.exit(1);
  }
  const port = await freePort();
  const url = `http://localhost:${port}`;
  const out = fs.openSync(LOG, 'w');
  const child = spawn(process.execPath, [NEXT, 'start', '-p', String(port)], { detached: true, windowsHide: true, stdio: ['ignore', out, out], env: ENV });
  child.unref();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !(await answers(url, 2000))) await sleep(250);
  if (!(await answers(url, 2000))) {
    killTree(child.pid);
    console.error(`The built app did not start. Last lines of ${LOG}:\n${logTail(40)}`);
    process.exit(1);
  }
  fs.writeFileSync(BUILT, JSON.stringify({ url, pid: child.pid, version }));
  return { base: url, fresh: true };
}

// First visit of a screen makes the dev server build it. Do that here, once per screen, and one at a time:
// a dev server asked to build many screens at once corrupts its own .next/dev files and stops.
async function warm(state, routes) {
  const todo = routes.filter((r) => !state.warmed.includes(r));
  for (const r of todo) {
    await answers(state.url + r, 120_000);
    state.warmed.push(r);
  }
  if (todo.length) fs.writeFileSync(STATE, JSON.stringify(state));
}

/** Address of a server that is up: BASE_URL if given, else the one left running, else a new one. */
export async function ensureServer(warmRoutes = []) {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL.replace(/\/$/, ''), fresh: false };
  fs.mkdirSync(DIR, { recursive: true });
  if (fs.existsSync(STATE)) {
    const state = { warmed: [], ...JSON.parse(fs.readFileSync(STATE, 'utf8')) };
    if (await answers(state.url, 2000)) {
      await warm(state, warmRoutes);
      return { base: state.url, fresh: false };
    }
    stop(STATE); // stale: the process died or stopped answering
  }

  // Left broken by an interrupted run, it makes every screen answer "Internal Server Error".
  const manifest = path.resolve('.next/dev/prerender-manifest.json');
  try { JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch { fs.rmSync(manifest, { force: true }); }
  const port = await freePort();
  const url = `http://localhost:${port}`;
  const out = fs.openSync(LOG, 'w');
  const child = spawn(process.execPath, [NEXT, 'dev', '-p', String(port)], { detached: true, windowsHide: true, stdio: ['ignore', out, out], env: ENV });
  let exited = false;
  child.once('exit', () => { exited = true; });
  child.unref();

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !exited && !(await answers(url, 2000))) await sleep(250);
  if (exited || !(await answers(url, 2000))) {
    killTree(child.pid);
    console.error(`The dev server did not start. Last lines of ${LOG}:\n${logTail(40)}`);
    process.exit(1);
  }
  const state = { url, pid: child.pid, startedAt: new Date().toISOString(), warmed: [] };
  fs.writeFileSync(STATE, JSON.stringify(state));
  await warm(state, warmRoutes);
  return { base: url, fresh: true };
}

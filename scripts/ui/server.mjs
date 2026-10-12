// scripts/ui/server.mjs
// Manages the Next.js application server lifecycle automatically.
// Auto-assigns a free port, polls for readiness, and guarantees whole-tree process termination.

import { spawn, execSync } from 'node:child_process';
import net from 'node:net';

/**
 * Finds an available TCP port.
 */
export function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

/**
 * Kills a process and its entire child process tree.
 */
export function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // Process already terminated
  }
}

/**
 * Ensures the target server is running.
 * If options.base is provided, returns that URL directly.
 * Otherwise, spawns the server on a free port and polls until healthy (HTTP < 500).
 */
export async function ensureServer(options = {}) {
  if (options.base) {
    const url = options.base.replace(/\/$/, '');
    return {
      url,
      close: async () => {},
      wasSpawned: false,
    };
  }

  const port = await getFreePort();
  const url = `http://localhost:${port}`;
  const isProd = Boolean(options.prod);

  if (isProd) {
    console.log('[server] Building production bundle (npm run build)...');
    try {
      execSync('npm run build', { stdio: 'inherit' });
    } catch (err) {
      throw new Error(`Production build failed: ${err.message}`);
    }
  }

  const cmd = isProd ? `npx next start -p ${port}` : `npx next dev -p ${port}`;
  console.log(`[server] Spawning ${isProd ? 'production' : 'dev'} server on port ${port}...`);

  const spawnEnv = {
    ...process.env,
    PORT: String(port),
    NEXT_PUBLIC_DATA_MODE: process.env.NEXT_PUBLIC_DATA_MODE || 'mock',
  };

  let serverProc = null;
  const logs = [];
  const killedPids = new Set();
  let serverExited = false;
  let exitCode = null;

  const startProcess = () => {
    serverExited = false;
    exitCode = null;
    serverProc = spawn(cmd, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: spawnEnv,
    });

    const appendLog = (chunk) => {
      const text = chunk.toString();
      logs.push(text);
      if (logs.length > 100) logs.shift();

      const fullLog = logs.join('\n');
      const pidMatch = fullLog.match(/taskkill\s+\/PID\s+(\d+)/i) || fullLog.match(/PID:\s*(\d+)/i);
      if (/Another next dev server is already running/i.test(fullLog) && pidMatch) {
        const stalePid = pidMatch[1];
        if (stalePid && !killedPids.has(stalePid)) {
          killedPids.add(stalePid);
          console.warn(`[server] Terminating conflicting orphaned next dev process (PID ${stalePid})...`);
          killProcessTree(stalePid);
        }
      }
    };

    serverProc.stdout.on('data', appendLog);
    serverProc.stderr.on('data', appendLog);
    serverProc.on('exit', (code) => {
      serverExited = true;
      exitCode = code;
    });
  };

  startProcess();

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (serverProc?.pid) killProcessTree(serverProc.pid);
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error('[server] Uncaught exception:', err);
    process.exit(1);
  });

  const start = Date.now();
  const timeoutMs = 90000;
  let ready = false;
  let retried = false;

  while (Date.now() - start < timeoutMs) {
    if (serverExited && !ready) {
      if (!retried && (killedPids.size > 0 || logs.some((l) => /Another next dev server/i.test(l)))) {
        console.log('[server] Stale conflicting server was killed. Re-spawning dev server...');
        retried = true;
        await new Promise((r) => setTimeout(r, 1000));
        startProcess();
      } else {
        cleanup();
        console.error('\n[server] Server process exited unexpectedly with code ' + exitCode + '. Logs:');
        console.error(logs.join('\n'));
        throw new Error(`Server process exited prematurely with code ${exitCode}.`);
      }
    }

    try {
      const res = await fetch(`${url}/en`, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
        .catch(() => fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) }));
      if (res && res.status < 500) {
        ready = true;
        break;
      }
    } catch {
      // Server still booting up
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!ready) {
    cleanup();
    console.error('\n[server] Server failed to start within 90s. Recent server log output:');
    console.error(logs.join('\n'));
    throw new Error(`Server failed to respond on ${url} within 90s.`);
  }

  console.log(`[server] Ready at ${url} (${((Date.now() - start) / 1000).toFixed(1)}s)\n`);

  return {
    url,
    close: async () => {
      cleanup();
    },
    wasSpawned: true,
  };
}

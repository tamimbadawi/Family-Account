// scripts/ui/browser.mjs
// Launches headless Chromium using existing system-installed browsers.
// Zero-download: avoids downloading extra browser binaries in development.

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DEFAULT_ARGS = [
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
];

/**
 * Searches for an installed Chromium browser executable in order of preference.
 * Returns the absolute path if found, or null.
 */
export function findChromiumPath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const isLinux = process.platform === 'linux';

  if (isWindows) {
    const progFiles = process.env.ProgramFiles || '';
    const progFilesX86 = process.env['ProgramFiles(x86)'] || '';
    const localAppData = process.env.LocalAppData || '';

    const windowsCandidates = [
      progFiles ? path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
      progFilesX86 ? path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
      localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
      progFilesX86 ? path.join(progFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
      progFiles ? path.join(progFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
      progFiles ? path.join(progFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe') : null,
    ];

    for (const candidate of windowsCandidates) {
      if (candidate && fs.existsSync(candidate)) return candidate;
    }
  } else if (isMac) {
    const macCandidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ];
    for (const candidate of macCandidates) {
      if (candidate && fs.existsSync(candidate)) return candidate;
    }
  } else if (isLinux) {
    const linuxBinaries = ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
    for (const bin of linuxBinaries) {
      try {
        const fullPath = execSync(`which ${bin} 2>/dev/null`, { encoding: 'utf8' }).trim();
        if (fullPath && fs.existsSync(fullPath)) return fullPath;
      } catch {
        // Not on PATH
      }
    }
  }

  return null;
}

/**
 * Launches a headless browser instance.
 */
export async function launch(options = {}) {
  const executablePath = findChromiumPath();

  if (executablePath) {
    return chromium.launch({
      executablePath,
      headless: true,
      args: DEFAULT_ARGS,
      ...options,
    });
  }

  // Fallback to playwright's bundled/downloaded chromium (e.g. inside GitHub Actions CI)
  console.log("No installed Chromium found. Run 'npx playwright install chromium' to install playwright's browser.");
  return chromium.launch({
    headless: true,
    args: DEFAULT_ARGS,
    ...options,
  });
}

// scripts/ui/config.mjs
// Central configuration for headless screen audit and user flows.

export const CONFIG = {
  defaultSizes: [
    [390, 844], // iPhone 12/13/14/15/16 Pro
    [375, 667], // iPhone SE
    [412, 700], // Android / narrow mobile
  ],
  quickSize: [390, 844],
  keyboardSize: [390, 420], // Screen height with on-screen keyboard open
  defaultThemes: ['light', 'dark'],
  quickTheme: 'light',
  locales: ['en', 'ar'],
  defaultRoutes: [
    '/en',
    '/en/history',
    '/en/reports',
    '/en/settings',
    '/en/login',
    '/ar',
    '/ar/settings',
  ],
  // Routes where the page list content is permitted to scroll vertically.
  // Every other route must fit entirely within the viewport with zero vertical scroll.
  listRoutes: [
    '/history',
    '/settings/categories',
    '/settings/deleted',
    '/reports/r/biggest-expenses',
    '/reports/r/search-export',
    '/operator',
  ],
  minFontSizePx: 14,
  minTapTargetPx: 44,
  defaultParallel: 4,
  navTimeoutMs: 45000,
  networkIdleTimeoutMs: 10000,
  settleMs: 300,
};

/**
 * Normalizes user-supplied routes:
 * - Strips Windows Git Bash prefix (e.g. "C:/Program Files/Git/en" -> "/en")
 * - Handles missing leading slash
 * - Trims trailing slashes (except root)
 */
export function normalizeRoute(r) {
  if (!r) return '/';
  let clean = String(r).trim();
  // Strip Git Bash automatic path rewrite (e.g. "C:/Program Files/Git/en" -> "/en")
  clean = clean.replace(/^[A-Za-z]:[/\\]+(?:[^/\\]+[/\\]+)*Git[/\\]*/i, '/');
  clean = clean.replace(/\\/g, '/');
  if (!clean.startsWith('/')) clean = '/' + clean;
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
  return clean;
}

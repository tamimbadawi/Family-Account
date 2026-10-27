import defaultManifest from './logos-manifest.json';

const defaultMap: Record<string, string> = defaultManifest as Record<string, string>;

/**
 * Returns the local logo path for a bank code or manager identifier,
 * or null if not available.
 * Client-safe: no node:fs, no network, pure static manifest lookup.
 *
 * @param codeOrManager Bank code (e.g. 'cib') or manager join key ('manager_ar').
 * @param manifest Optional custom manifest map (used for test isolation).
 */
export function logoPath(
  codeOrManager: string | null | undefined,
  manifest: Record<string, string> = defaultMap
): string | null {
  if (!codeOrManager) return null;
  const key = codeOrManager.trim();
  if (!key) return null;

  return manifest[key] ?? manifest[key.toLowerCase()] ?? null;
}

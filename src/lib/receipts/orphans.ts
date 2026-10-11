/**
 * Pure logic for detecting orphan receipt storage objects.
 * Family Accounts (حساباتنا)
 */

export interface FindOrphanReceiptsOptions {
  /** If set or true, indicates a database query error; returns empty array */
  dbError?: unknown;
}

/**
 * Given storage object paths and live photo paths from the database,
 * returns storage paths that have no matching live row.
 *
 * If the database query failed (indicated by dbError or livePhotoPaths being null/undefined),
 * returns an empty array so nothing is ever deleted when an error occurs.
 */
export function findOrphanReceipts(
  storagePaths: string[],
  livePhotoPaths: string[] | Set<string> | null | undefined,
  options?: FindOrphanReceiptsOptions
): string[] {
  if (options?.dbError != null && options.dbError !== false) {
    return [];
  }
  if (livePhotoPaths == null) {
    return [];
  }

  const liveSet = livePhotoPaths instanceof Set ? livePhotoPaths : new Set(livePhotoPaths);
  return storagePaths.filter((path) => Boolean(path) && !liveSet.has(path));
}

/**
 * Splits an array into chunks of a given maximum size (default 100).
 */
export function chunk<T>(items: T[], size = 100): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

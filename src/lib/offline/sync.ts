// =========================================================
// Pull-only sync  ·  Family Accounts (حساباتنا)
// Live mode keeps a read copy of the household in Dexie (fa-live). Saves go straight to
// Supabase (see live-repository.ts); this file only brings the server's rows down.
//
// Per table, the cursor is the newest server `updated_at` seen, so a phone with a wrong clock
// never skips rows. Each pull re-reads from 5 minutes before the cursor (a save that committed
// late with an earlier timestamp is still caught). Every 25 days, and on a new household or a
// new device, a full pull replaces the copy so rows purged on the server disappear here too.
// =========================================================

import type { FamilyAccountsDB } from './db';

export const SYNCED_TABLES = ['accounts', 'categories', 'subcategories', 'items', 'transactions', 'budgets'] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export const OVERLAP_MS = 5 * 60 * 1000;
export const FULL_PULL_EVERY_MS = 25 * 24 * 60 * 60 * 1000;
const PAGE = 1000; // PostgREST returns at most 1000 rows per request

type Row = Record<string, unknown> & { id?: string; updated_at?: string };

/** The smallest surface of the Supabase client the pull needs (easy to fake in tests). */
export interface PullSource {
  /** Rows of `table` for the household, ordered by updated_at then id; `since` = strictly after. */
  fetchPage(table: SyncedTable, householdId: string, since: string | null, from: number, to: number): Promise<Row[]>;
  households(): Promise<Row[]>;
  members(householdId: string): Promise<Row[]>;
}

/** Where the next incremental pull starts: 5 minutes before the newest row seen. */
export function sinceFor(cursor: string | null | undefined): string | null {
  if (!cursor) return null;
  const t = Date.parse(cursor);
  if (Number.isNaN(t)) return null;
  return new Date(t - OVERLAP_MS).toISOString();
}

/** Newest updated_at among rows, or the previous cursor if there were none newer. */
export function nextCursor(previous: string | null | undefined, rows: Row[]): string | null {
  let best = previous ?? null;
  for (const r of rows) {
    if (typeof r.updated_at === 'string' && (!best || Date.parse(r.updated_at) > Date.parse(best))) {
      best = r.updated_at;
    }
  }
  return best;
}

export function needsFullPull(lastFullPullAt: string | null | undefined, now: Date): boolean {
  if (!lastFullPullAt) return true;
  const t = Date.parse(lastFullPullAt);
  return Number.isNaN(t) || now.getTime() - t > FULL_PULL_EVERY_MS;
}

async function fetchAll(source: PullSource, table: SyncedTable, householdId: string, since: string | null) {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = await source.fetchPage(table, householdId, since, from, from + PAGE - 1);
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function meta<T>(db: FamilyAccountsDB, key: string): Promise<T | null> {
  return ((await db.meta.get(key))?.value as T | undefined) ?? null;
}

/** Empties the read copy (sign-out, removed from the family, or a different household). */
export async function clearLocalCopy(db: FamilyAccountsDB): Promise<void> {
  await db.transaction('rw', [db.households, db.household_members, db.photos, db.meta, ...SYNCED_TABLES.map((t) => db[t])], async () => {
    await Promise.all([
      db.households.clear(),
      db.household_members.clear(),
      db.photos.clear(),
      db.meta.clear(),
      ...SYNCED_TABLES.map((t) => db[t].clear()),
    ]);
  });
}

/**
 * Brings the household down from the server. Returns the household id, or null when the
 * signed-in person belongs to no family (the copy is then emptied).
 */
export async function pull(db: FamilyAccountsDB, source: PullSource, now = new Date()): Promise<string | null> {
  const households = await source.households();
  const household = households[0];
  const known = await meta<string>(db, 'householdId');

  if (!household?.id) {
    if (known) await clearLocalCopy(db);
    return null;
  }
  const householdId = household.id;
  if (known && known !== householdId) await clearLocalCopy(db);

  const full = known !== householdId || needsFullPull(await meta<string>(db, 'lastFullPullAt'), now);
  const members = await source.members(householdId);

  const fetched = await Promise.all(
    SYNCED_TABLES.map(async (table) => {
      const cursor = full ? null : await meta<string>(db, `cursor:${table}`);
      return [table, await fetchAll(source, table, householdId, sinceFor(cursor)), cursor] as const;
    })
  );

  await db.transaction('rw', [db.households, db.household_members, db.meta, ...SYNCED_TABLES.map((t) => db[t])], async () => {
    await db.households.clear();
    await db.households.put(household as never);
    await db.household_members.clear();
    await db.household_members.bulkPut(members as never[]);
    for (const [table, rows, cursor] of fetched) {
      const store = db[table] as unknown as { clear(): Promise<void>; bulkPut(rows: Row[]): Promise<unknown> };
      if (full) await store.clear();
      if (rows.length) await store.bulkPut(rows);
      await db.meta.put({ key: `cursor:${table}`, value: nextCursor(full ? null : cursor, rows) });
    }
    await db.meta.put({ key: 'householdId', value: householdId });
    await db.meta.put({ key: 'lastSyncedAt', value: now.toISOString() });
    if (full) await db.meta.put({ key: 'lastFullPullAt', value: now.toISOString() });
  });

  return householdId;
}

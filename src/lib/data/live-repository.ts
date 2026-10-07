'use client';

// =========================================================
// Live Repository  ·  Family Accounts (حساباتنا)
// Same reads as the sample-data repository, over the Dexie read copy (fa-live) that
// sync.ts keeps up to date. Every save goes to Supabase first (upsert, so a retry never
// duplicates) and only the row the server returns is put into Dexie. Saves are online-only:
// without a connection nothing is written and an OfflineError is thrown, so the screen keeps
// what was typed and shows "No connection — try again".
// =========================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../supabase/client';
import type { Database } from '../supabase/database.types';
import { db as defaultDb, type FamilyAccountsDB } from '../offline/db';
import { clearLocalCopy, pull, type PullSource, type SyncedTable } from '../offline/sync';
import { MockRepository, type WritableRow, type WritableTable } from './mock-repository';
import { OfflineError } from './errors';
import { toEntry, toHousehold } from './mappers';
import type { SyncStatus, TransactionRow } from './types';

const REQUEST_TIMEOUT_MS = 15_000;
const RECEIPTS_BUCKET = 'receipts';

// The server sets these itself: timestamps from its own clock (the pull cursor relies on it),
// who created/edited an entry from the signed-in user.
const SERVER_COLUMNS = ['created_at', 'updated_at', 'created_by', 'updated_by'];

type Client = SupabaseClient<Database>;
type AnyRow = Record<string, unknown>;

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof OfflineError) return true;
  const msg = String((err as { message?: unknown })?.message ?? err ?? '');
  const name = String((err as { name?: unknown })?.name ?? '');
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /failed to fetch|network|load failed|fetch failed|timed? ?out|aborted/i.test(msg)
  );
}

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Row → payload for the server: no undefined values, no server-owned columns. */
export function toServerPayload(row: AnyRow): AnyRow {
  const payload: AnyRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || SERVER_COLUMNS.includes(key)) continue;
    payload[key] = value;
  }
  return payload;
}

function supabaseSource(client: Client): PullSource {
  const timeout = () => AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const rows = <T>(res: { data: T[] | null; error: { message: string } | null }) => {
    if (res.error) throw new Error(res.error.message);
    return (res.data ?? []) as unknown as AnyRow[];
  };
  return {
    async households() {
      return rows(await client.from('households').select('*').abortSignal(timeout()));
    },
    async members(householdId) {
      return rows(
        await client.from('household_members').select('*').eq('household_id', householdId).abortSignal(timeout())
      );
    },
    async fetchPage(table: SyncedTable, householdId, since, from, to) {
      let q = client.from(table).select('*').eq('household_id', householdId);
      if (since) q = q.gt('updated_at', since);
      return rows(await q.order('updated_at').order('id').range(from, to).abortSignal(timeout()));
    },
  };
}

export class LiveRepository extends MockRepository {
  private pulling: Promise<string | null> | null = null;
  private opened: Promise<void> | null = null;

  constructor(
    customDb: FamilyAccountsDB = defaultDb,
    private readonly client: () => Client = getSupabaseBrowserClient
  ) {
    super(customDb, '');
  }

  // ---------- Opening the app and pulling ----------

  /**
   * First open on a device: waits for the whole household to download. Later opens show the
   * copy straight away and refresh it in the background.
   */
  override async ensureSeeded(): Promise<void> {
    if (typeof window === 'undefined') return;
    this.opened ??= (async () => {
      const { data } = await this.client().auth.getSession();
      this.currentUserId = data.session?.user.id ?? '';
      const hasCopy = Boolean((await this.db.meta.get('householdId'))?.value);
      if (hasCopy) {
        void this.refresh().catch((err) => console.warn('[sync] background pull failed', err));
        return;
      }
      await this.refresh().catch((err) => console.warn('[sync] first pull failed', err));
      // Nothing downloaded yet (no connection, or the family is still being created): try again next open
      if (!(await this.db.meta.get('householdId'))?.value) this.opened = null;
    })();
    return this.opened;
  }

  override async getHousehold() {
    const row = (await this.db.households.toArray())[0];
    return row ? toHousehold(row) : null;
  }

  /** Pulls changes from the server (app open, back to the foreground, back online). */
  async refresh(): Promise<void> {
    if (offline()) return;
    this.pulling ??= pull(this.db, supabaseSource(this.client())).finally(() => {
      this.pulling = null;
    });
    await this.pulling;
  }

  /** Sign-out: nothing of the family stays on the phone. */
  async clearCache(): Promise<void> {
    this.opened = null;
    await clearLocalCopy(this.db);
  }

  protected override async householdId(explicit?: string): Promise<string> {
    if (explicit) return explicit;
    const id = (await this.db.meta.get('householdId'))?.value as string | undefined;
    if (!id) throw new Error('No household on this phone yet');
    return id;
  }

  // ---------- Saving (online-only) ----------

  protected override async persist<K extends WritableTable>(table: K, row: WritableRow<K>): Promise<WritableRow<K>> {
    if (offline()) throw new OfflineError();
    let saved: AnyRow;
    try {
      const { data, error } = await this.client()
        .from(table)
        .upsert(toServerPayload(row as unknown as AnyRow) as never)
        .select('*')
        .abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS))
        .single();
      if (error) throw error;
      saved = data as unknown as AnyRow;
    } catch (err) {
      if (isNetworkFailure(err)) throw new OfflineError();
      throw err instanceof Error ? err : new Error(String((err as { message?: unknown })?.message ?? err));
    }
    // Keep local-only fields (none today) but let every server value win.
    const merged = { ...row, ...saved } as WritableRow<K>;
    await (this.db[table] as unknown as { put(r: WritableRow<K>): Promise<unknown> }).put(merged);
    return merged;
  }

  /** Balance corrections start from the server's balance, never the phone's copy (PROGRESS P1). */
  protected override async balanceForCorrection(walletId: string): Promise<number> {
    if (offline()) throw new OfflineError();
    try {
      const { data, error } = await this.client()
        .from('v_account_balances')
        .select('balance')
        .eq('account_id', walletId)
        .abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS))
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`Wallet not found: ${walletId}`);
      return Number(data.balance ?? 0);
    } catch (err) {
      if (isNetworkFailure(err)) throw new OfflineError();
      throw err;
    }
  }

  /** Each family has its own "Balance correction" items (seed_corrections), found by name. */
  protected override async getCorrectionItemId(kind: 'expense' | 'income'): Promise<string> {
    const categories = await this.db.categories.where('kind').equals(kind).toArray();
    const catIds = new Set(categories.map((c) => c.id));
    const groups = await this.db.subcategories.filter((s) => catIds.has(s.category_id)).toArray();
    const groupIds = new Set(groups.map((s) => s.id));
    const item = await this.db.items
      .filter((i) => groupIds.has(i.subcategory_id) && i.name_en === 'Balance correction')
      .first();
    if (!item) throw new Error(`Balance correction item not found for kind: ${kind}`);
    return item.id;
  }

  // ---------- Receipt photos (Storage: receipts/<household_id>/<entry_id>.<ext>) ----------

  /** Uploads first; the entry only points at the photo once the upload worked (PROGRESS P2). */
  override async setEntryPhoto(entryId: string, blob: Blob) {
    const row = await this.db.transactions.get(entryId);
    if (!row) throw new Error(`Entry not found: ${entryId}`);
    if (offline()) throw new OfflineError();

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${row.household_id}/${row.id}.${ext}`;
    try {
      const { error } = await this.client()
        .storage.from(RECEIPTS_BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
      if (error) throw error;
    } catch (err) {
      if (isNetworkFailure(err)) throw new OfflineError();
      throw err;
    }

    const saved = await this.patch('transactions', entryId, { photo_path: path } as Partial<TransactionRow>);
    await this.db.photos.put({ id: entryId, blob, created_at: saved.updated_at });
    return toEntry(saved);
  }

  /** From the phone if this version was seen before, otherwise downloaded once and kept. */
  override async getEntryPhoto(entryId: string): Promise<Blob | null> {
    const row = await this.db.transactions.get(entryId);
    if (!row?.photo_path) return null;
    const cached = await this.db.photos.get(entryId);
    if (cached && cached.created_at === row.updated_at) return cached.blob;
    if (offline()) return cached?.blob ?? null;

    const { data, error } = await this.client().storage.from(RECEIPTS_BUCKET).download(row.photo_path);
    if (error || !data) return cached?.blob ?? null;
    await this.db.photos.put({ id: entryId, blob: data, created_at: row.updated_at });
    return data;
  }

  // ---------- Status ----------

  override async syncStatus(): Promise<SyncStatus> {
    const last = (await this.db.meta.get('lastSyncedAt'))?.value as string | undefined;
    return {
      status: offline() ? 'offline' : 'synced',
      lastSyncedAt: last ?? null,
      pendingCount: 0,
    };
  }
}

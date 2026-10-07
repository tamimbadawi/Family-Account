import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyAccountsDB } from '../offline/db';
import { LiveRepository, toServerPayload } from './live-repository';
import { isOfflineError } from './errors';

const HID = 'h1';

/** Just enough of the Supabase client: from(table).upsert(row).select().abortSignal().single(). */
function fakeClient(respond: (table: string, row: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  const sent: { table: string; row: Record<string, unknown> }[] = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from(table: string) {
      let row: Record<string, unknown> = {};
      const chain = {
        upsert(r: Record<string, unknown>) {
          row = r;
          sent.push({ table, row: r });
          return chain;
        },
        select: () => chain,
        abortSignal: () => chain,
        single: () => respond(table, row),
      };
      return chain;
    },
  };
  return { client: () => client as never, sent };
}

const serverNow = '2026-10-07T12:00:00.123Z';
const echo = async (_table: string, row: Record<string, unknown>) => ({
  data: { ...row, created_at: serverNow, updated_at: serverNow, created_by: 'u1', updated_by: 'u1' },
  error: null,
});

describe('LiveRepository saves', () => {
  let db: FamilyAccountsDB;

  beforeEach(async () => {
    db = new FamilyAccountsDB(`test-live-${Math.random().toString(36).slice(2, 9)}`);
    await db.meta.put({ key: 'householdId', value: HID });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the row to the server and keeps the row the server returns', async () => {
    const { client, sent } = fakeClient(echo);
    const repo = new LiveRepository(db, client);
    const wallet = await repo.addWallet({ type: 'bank', nameEn: 'Bank', nameAr: 'بنك' });

    expect(sent).toHaveLength(1);
    expect(sent[0].table).toBe('accounts');
    expect(sent[0].row.household_id).toBe(HID);
    expect(sent[0].row).not.toHaveProperty('updated_at'); // the server's clock decides
    expect(wallet.updatedAt).toBe(serverNow);
    expect((await db.accounts.get(wallet.id))?.updated_at).toBe(serverNow);
  });

  it('a failed save writes nothing to the phone', async () => {
    const { client } = fakeClient(async () => ({ data: null, error: { message: 'new row violates row-level security policy' } }));
    const repo = new LiveRepository(db, client);
    await expect(repo.addWallet({ type: 'bank', nameEn: 'Bank' })).rejects.toThrow(/row-level security/);
    expect(await db.accounts.count()).toBe(0);
  });

  it('a lost connection during the save is reported as "no connection" and writes nothing', async () => {
    const { client } = fakeClient(async () => {
      throw new TypeError('Failed to fetch');
    });
    const repo = new LiveRepository(db, client);
    const err = await repo.addWallet({ type: 'bank', nameEn: 'Bank' }).catch((e) => e);
    expect(isOfflineError(err)).toBe(true);
    expect(await db.accounts.count()).toBe(0);
  });

  it('without a connection nothing is even sent', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { client, sent } = fakeClient(echo);
    const repo = new LiveRepository(db, client);
    const err = await repo.addWallet({ type: 'bank', nameEn: 'Bank' }).catch((e) => e);
    expect(isOfflineError(err)).toBe(true);
    expect(sent).toHaveLength(0);
    expect(await db.accounts.count()).toBe(0);
  });

  it('saving the same new entry twice sends the same id (the server upsert keeps one row)', async () => {
    const { client, sent } = fakeClient(echo);
    const repo = new LiveRepository(db, client);
    const input = { id: 'e1', type: 'transfer' as const, amount: 5, occurredOn: '2026-10-07', accountId: 'a', toAccountId: 'b' };
    await repo.addEntry(input);
    await repo.addEntry(input);
    expect(sent.map((s) => s.row.id)).toEqual(['e1', 'e1']);
    expect(await db.transactions.count()).toBe(1);
  });

  it('soft delete goes through the server too', async () => {
    const { client, sent } = fakeClient(echo);
    const repo = new LiveRepository(db, client);
    const e = await repo.addEntry({ type: 'transfer', amount: 5, occurredOn: '2026-10-07', accountId: 'a', toAccountId: 'b' });
    await repo.softDeleteEntry(e.id);
    expect(sent).toHaveLength(2);
    expect(sent[1].row.deleted_at).toBeTruthy();
    expect((await db.transactions.get(e.id))?.deleted_at).toBeTruthy();
  });
});

describe('toServerPayload', () => {
  it('drops undefined values and the columns the server sets itself', () => {
    expect(
      toServerPayload({ id: 'x', amount: 1, note: undefined, created_at: 'a', updated_at: 'b', created_by: 'c', updated_by: 'd', deleted_at: null })
    ).toEqual({ id: 'x', amount: 1, deleted_at: null });
  });
});

describe('LiveRepository sample data', () => {
  let db: FamilyAccountsDB;

  beforeEach(async () => {
    db = new FamilyAccountsDB(`test-live-sample-${Math.random().toString(36).slice(2, 9)}`);
    await db.meta.put({ key: 'householdId', value: HID });
    await db.households.put({ id: HID, name: 'Family', currency: 'EGP', created_at: serverNow, has_sample_data: true });
    await db.transactions.bulkPut([
      { id: 's1', household_id: HID, type: 'expense', amount: 10, occurred_on: '2026-10-01', account_id: 'a', to_account_id: null, item_id: 'i', note: null, is_sample: true, created_by: null, updated_by: null, created_at: serverNow, updated_at: serverNow, deleted_at: serverNow },
      { id: 'r1', household_id: HID, type: 'expense', amount: 20, occurred_on: '2026-10-01', account_id: 'a', to_account_id: null, item_id: 'i', note: null, created_by: null, updated_by: null, created_at: serverNow, updated_at: serverNow, deleted_at: serverNow },
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function rpcClient(fail?: Error) {
    const calls: string[] = [];
    const client = {
      rpc(fn: string) {
        calls.push(fn);
        return { abortSignal: async () => (fail ? Promise.reject(fail) : { error: null }) };
      },
    };
    return { client: () => client as never, calls };
  }

  it('reads whether the family still has its samples from the household', async () => {
    const repo = new LiveRepository(db, rpcClient().client);
    expect(await repo.hasSampleData()).toBe(true);
    await db.households.update(HID, { has_sample_data: false });
    expect(await repo.hasSampleData()).toBe(false);
  });

  it('clears on the server, pulls, and the undo restores on the server', async () => {
    const { client, calls } = rpcClient();
    const repo = new LiveRepository(db, client);
    const refresh = vi.spyOn(repo, 'refresh').mockResolvedValue();
    const undo = await repo.clearSampleData();
    expect(calls).toEqual(['clear_sample_data']);
    expect(refresh).toHaveBeenCalledTimes(1);
    await undo();
    expect(calls).toEqual(['clear_sample_data', 'restore_sample_data']);
  });

  it('without a connection nothing is sent', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { client, calls } = rpcClient();
    const err = await new LiveRepository(db, client).clearSampleData().catch((e) => e);
    expect(isOfflineError(err)).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('cleared samples never show in Recently deleted', async () => {
    const repo = new LiveRepository(db, rpcClient().client);
    const deleted = await repo.listEntries({ onlyDeleted: true });
    expect(deleted.map((e) => e.id)).toEqual(['r1']);
  });
});

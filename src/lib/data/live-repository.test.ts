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

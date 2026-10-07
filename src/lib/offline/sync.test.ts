import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { FamilyAccountsDB } from './db';
import { FULL_PULL_EVERY_MS, needsFullPull, nextCursor, pull, sinceFor, type PullSource, type SyncedTable } from './sync';

const H1 = 'h1';
const H2 = 'h2';

type Row = Record<string, unknown> & { id: string; updated_at: string; household_id?: string };

function fakeSource(tables: Partial<Record<SyncedTable, Row[]>>, household = H1) {
  const calls: { table: SyncedTable; since: string | null }[] = [];
  const source: PullSource = {
    async households() {
      return household ? [{ id: household, name: 'Family', currency: 'EGP', created_at: '2026-01-01' }] : [];
    },
    async members(hid) {
      return [{ household_id: hid, user_id: 'u1', display_name: 'Anna', role: 'owner', locale: 'en', created_at: '2026-01-01' }];
    },
    async fetchPage(table, hid, since, from, to) {
      calls.push({ table, since });
      return (tables[table] ?? [])
        .filter((r) => (r.household_id ?? hid) === hid && (!since || r.updated_at > since))
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
        .slice(from, to + 1);
    },
  };
  return { source, calls };
}

const entry = (id: string, updated_at: string): Row => ({
  id,
  household_id: H1,
  type: 'expense',
  amount: 10,
  occurred_on: '2026-10-01',
  account_id: 'a',
  to_account_id: null,
  item_id: 'i',
  note: null,
  created_by: 'u1',
  updated_by: 'u1',
  created_at: updated_at,
  updated_at,
  deleted_at: null,
});

describe('pull cursor', () => {
  it('starts 5 minutes before the newest row seen', () => {
    expect(sinceFor(null)).toBeNull();
    expect(sinceFor('2026-10-07T12:05:00.000Z')).toBe('2026-10-07T12:00:00.000Z');
  });

  it('keeps the newest server timestamp, or the previous one when nothing is newer', () => {
    const rows = [entry('a', '2026-10-07T10:00:00Z'), entry('b', '2026-10-07T11:00:00Z')];
    expect(nextCursor(null, rows)).toBe('2026-10-07T11:00:00Z');
    expect(nextCursor('2026-10-07T12:00:00Z', rows)).toBe('2026-10-07T12:00:00Z');
    expect(nextCursor('2026-10-07T12:00:00Z', [])).toBe('2026-10-07T12:00:00Z');
  });

  it('asks for a full pull on a new device and every 25 days', () => {
    const now = new Date('2026-10-30T00:00:00Z');
    expect(needsFullPull(null, now)).toBe(true);
    expect(needsFullPull(new Date(now.getTime() - FULL_PULL_EVERY_MS + 1000).toISOString(), now)).toBe(false);
    expect(needsFullPull(new Date(now.getTime() - FULL_PULL_EVERY_MS - 1000).toISOString(), now)).toBe(true);
  });
});

describe('pull()', () => {
  let db: FamilyAccountsDB;
  beforeEach(() => {
    db = new FamilyAccountsDB(`test-sync-${Math.random().toString(36).slice(2, 9)}`);
  });

  it('downloads the whole household on a new device, then only what changed', async () => {
    const data = { transactions: [entry('t1', '2026-10-07T10:00:00Z'), entry('t2', '2026-10-07T11:00:00Z')] };
    const first = fakeSource(data);
    expect(await pull(db, first.source, new Date('2026-10-07T12:00:00Z'))).toBe(H1);
    expect(await db.transactions.count()).toBe(2);
    expect(await db.household_members.count()).toBe(1);
    expect(first.calls.find((c) => c.table === 'transactions')?.since).toBeNull();

    data.transactions.push(entry('t3', '2026-10-07T13:00:00Z'));
    const second = fakeSource(data);
    await pull(db, second.source, new Date('2026-10-07T13:30:00Z'));
    expect(second.calls.find((c) => c.table === 'transactions')?.since).toBe('2026-10-07T10:55:00.000Z');
    expect(await db.transactions.count()).toBe(3);
  });

  it('an edit made on another phone replaces the copy (last save wins, no duplicate)', async () => {
    const data = { transactions: [entry('t1', '2026-10-07T10:00:00Z')] };
    await pull(db, fakeSource(data).source, new Date('2026-10-07T10:30:00Z'));
    data.transactions[0] = { ...entry('t1', '2026-10-07T11:00:00Z'), amount: 99 };
    await pull(db, fakeSource(data).source, new Date('2026-10-07T11:30:00Z'));
    expect(await db.transactions.count()).toBe(1);
    expect((await db.transactions.get('t1'))?.amount).toBe(99);
  });

  it('drops rows the server purged at the 25-day full pull', async () => {
    const data = { transactions: [entry('t1', '2026-09-01T10:00:00Z'), entry('t2', '2026-09-01T11:00:00Z')] };
    await pull(db, fakeSource(data).source, new Date('2026-09-01T12:00:00Z'));
    data.transactions = [data.transactions[1]];
    await pull(db, fakeSource(data).source, new Date('2026-09-02T12:00:00Z'));
    expect(await db.transactions.count()).toBe(2); // incremental: nothing to drop yet
    await pull(db, fakeSource(data).source, new Date('2026-10-01T12:00:00Z'));
    expect(await db.transactions.count()).toBe(1);
  });

  it('empties the copy when the person is no longer in a family, or joins another one', async () => {
    await pull(db, fakeSource({ transactions: [entry('t1', '2026-10-07T10:00:00Z')] }).source);
    expect(await db.transactions.count()).toBe(1);

    expect(await pull(db, fakeSource({}, H2).source)).toBe(H2);
    expect(await db.transactions.count()).toBe(0);
    expect((await db.households.toArray()).map((h) => h.id)).toEqual([H2]);

    expect(await pull(db, fakeSource({}, '').source)).toBeNull();
    expect(await db.households.count()).toBe(0);
  });

  it('pages through more than 1000 rows', async () => {
    const many = Array.from({ length: 1205 }, (_, i) =>
      entry(`t${i}`, new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString())
    );
    await pull(db, fakeSource({ transactions: many }).source);
    expect(await db.transactions.count()).toBe(1205);
  });
});

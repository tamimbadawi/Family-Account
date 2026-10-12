// =========================================================
// Live Repository  ·  Family Accounts (حساباتنا)
// Connects UI to Supabase backend with a reactive Dexie read cache.
// Writes persist directly to Supabase first, then update local Dexie cache.
// Enforces complete household tenant isolation.
// =========================================================

import { MockRepository } from './mock-repository';
import { getDbName, FamilyAccountsDB } from '../offline/db';
import { getSupabaseBrowserClient } from '../supabase/client';
import { OfflineError } from './errors';
import { clearLocalCopy } from '../offline/sync';
import {
  roundMoney,
  toCategory,
  toEntry,
  toHousehold,
  toItem,
  toMember,
  toSubcategory,
  toWallet,
} from './mappers';
import type { Database } from '../supabase/database.types';
import type {
  CreateCategoryInput,
  CreateEntryInput,
  CreateItemInput,
  CreateSubcategoryInput,
  CreateWalletInput,
  ListEntriesParams,
  Repository,
  UpdateCategoryInput,
  UpdateEntryInput,
  UpdateItemInput,
  UpdateSubcategoryInput,
  UpdateWalletInput,
} from './repository';
import type {
  Category,
  CategoryKind,
  EnrichedEntry,
  Entry,
  Household,
  HouseholdMemberRow,
  Item,
  Member,
  MemberLocale,
  MemberRole,
  Subcategory,
  SyncStatus,
  Wallet,
} from './types';

/** Drops undefined properties and server-generated audit columns so Supabase generates/manages them */
export function toServerPayload(row: Record<string, unknown>): Record<string, unknown> {
  const omit = new Set(['created_at', 'updated_at', 'created_by', 'updated_by']);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined && !omit.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

export class LiveRepository extends MockRepository implements Repository {
  private clientFactory?: () => any;
  private currentHouseholdId: string | null = null;
  private lastSyncedAt: string | null = null;
  private isSyncing = false;

  constructor(
    customDb?: FamilyAccountsDB,
    customClient?: (() => any) | any
  ) {
    // Dexie fa-live is the local reactive cache for live mode
    super(customDb ?? new FamilyAccountsDB(getDbName('live')));
    if (customClient) {
      this.clientFactory = typeof customClient === 'function' ? customClient : () => customClient;
    }
  }

  private getClient(): any {
    return this.clientFactory ? this.clientFactory() : getSupabaseBrowserClient();
  }

  // Refreshes the local cache from Supabase
  async refresh(): Promise<void> {
    if (this.currentHouseholdId) {
      await this.syncPull(this.currentHouseholdId);
    } else {
      await this.ensureSeeded();
    }
  }

  // Resolves current user and household ID securely from Supabase or Dexie meta
  async getCurrentIdentity(): Promise<{ userId: string; householdId: string }> {
    const db = (this as any).db as FamilyAccountsDB;

    // Check Dexie meta (useful in test harnesses and restored sessions)
    const metaHid = (await db.meta.get('householdId'))?.value as string | undefined;

    const client = this.getClient();
    let userId = 'u1';

    try {
      if (client.auth?.getUser) {
        const { data: { user } } = await client.auth.getUser();
        if (user) userId = user.id;
      } else if (client.auth?.getSession) {
        const { data: { session } } = await client.auth.getSession();
        if (session?.user) userId = session.user.id;
      }
    } catch {
      // Ignore auth fetch error if mock client
    }

    if (metaHid) {
      this.currentHouseholdId = metaHid;
      this.currentUserId = userId;
      return { userId, householdId: metaHid };
    }

    if (this.currentHouseholdId && this.currentUserId === userId) {
      return { userId, householdId: this.currentHouseholdId };
    }

    // Check local cache
    const localMember = await db.household_members
      .where('user_id')
      .equals(userId)
      .first();

    if (localMember) {
      this.currentUserId = userId;
      this.currentHouseholdId = localMember.household_id;
      return { userId, householdId: localMember.household_id };
    }

    // Query Supabase backend
    const { data: member, error: memberError } = await client
      .from('household_members')
      .select('household_id, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (memberError || !member) {
      throw new Error('No household membership found for current user');
    }

    this.currentUserId = userId;
    this.currentHouseholdId = member.household_id;
    return { userId, householdId: member.household_id };
  }

  // Pulls household records from Supabase into the local Dexie read cache
  async syncPull(householdId: string): Promise<void> {
    this.isSyncing = true;
    const db = (this as any).db as FamilyAccountsDB;
    const client = this.getClient();

    try {
      const [householdsRes, membersRes, accountsRes, catsRes, subcatsRes, itemsRes, txsRes] =
        await Promise.all([
          client.from('households').select('*').eq('id', householdId),
          client.from('household_members').select('*').eq('household_id', householdId),
          client.from('accounts').select('*').eq('household_id', householdId),
          client.from('categories').select('*').eq('household_id', householdId),
          client.from('subcategories').select('*').eq('household_id', householdId),
          client.from('items').select('*').eq('household_id', householdId),
          client.from('transactions').select('*').eq('household_id', householdId),
        ]);

      if (householdsRes.error) throw householdsRes.error;
      if (membersRes.error) throw membersRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (catsRes.error) throw catsRes.error;
      if (subcatsRes.error) throw subcatsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (txsRes.error) throw txsRes.error;

      await db.transaction(
        'rw',
        [
          db.households,
          db.household_members,
          db.accounts,
          db.categories,
          db.subcategories,
          db.items,
          db.transactions,
          db.meta,
        ],
        async () => {
          // Enforce tenant isolation on device: clear out any records from other households
          await Promise.all([
            db.households.where('id').notEqual(householdId).delete(),
            db.household_members.where('household_id').notEqual(householdId).delete(),
            db.accounts.where('household_id').notEqual(householdId).delete(),
            db.categories.where('household_id').notEqual(householdId).delete(),
            db.subcategories.where('household_id').notEqual(householdId).delete(),
            db.items.where('household_id').notEqual(householdId).delete(),
            db.transactions.where('household_id').notEqual(householdId).delete(),
          ]);

          // Bulk put latest server rows into Dexie
          if (householdsRes.data?.length) await db.households.bulkPut(householdsRes.data);
          if (membersRes.data?.length) {
            const mappedMembers: HouseholdMemberRow[] = membersRes.data.map((m: any) => ({
              ...m,
              role: (m.role === 'owner' ? 'owner' : 'member') as MemberRole,
              locale: (m.locale === 'ar' ? 'ar' : 'en') as MemberLocale,
            }));
            await db.household_members.bulkPut(mappedMembers);
          }
          if (accountsRes.data?.length) await db.accounts.bulkPut(accountsRes.data);
          if (catsRes.data?.length) await db.categories.bulkPut(catsRes.data);
          if (subcatsRes.data?.length) await db.subcategories.bulkPut(subcatsRes.data);
          if (itemsRes.data?.length) await db.items.bulkPut(itemsRes.data);
          if (txsRes.data?.length) await db.transactions.bulkPut(txsRes.data);

          const now = new Date().toISOString();
          await db.meta.put({ key: 'lastSyncedAt', value: now });
          this.lastSyncedAt = now;
        }
      );
    } finally {
      this.isSyncing = false;
    }
  }

  // Ensures current user's household is loaded into Dexie cache
  async ensureSeeded(): Promise<void> {
    if (typeof window === 'undefined' && typeof indexedDB === 'undefined') return;

    try {
      const client = this.getClient();
      let user: any = null;
      if (client.auth?.getUser) {
        const res = await client.auth.getUser();
        user = res.data?.user;
      } else if (client.auth?.getSession) {
        const res = await client.auth.getSession();
        user = res.data?.session?.user;
      }

      if (!user) return;
      this.currentUserId = user.id;

      const { data: member } = await client
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member?.household_id) return;
      this.currentHouseholdId = member.household_id;

      await this.syncPull(member.household_id);
    } catch (err) {
      console.warn('[LiveRepository] ensureSeeded note:', err);
    }
  }

  // ---------- Sample Data Management ----------

  async hasSampleData(): Promise<boolean> {
    const db = (this as any).db as FamilyAccountsDB;
    const { householdId } = await this.getCurrentIdentity();
    const row = await db.households.get(householdId);
    return Boolean((row as any)?.has_sample_data);
  }

  async clearSampleData(): Promise<() => Promise<void>> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new OfflineError();
    }
    const client = this.getClient();
    try {
      const res = await client.rpc('clear_sample_data').abortSignal?.(new AbortController().signal);
      if (res?.error) throw res.error;
    } catch (err) {
      if (err instanceof TypeError || (err as any)?.message?.includes('fetch') || (err as any)?.name === 'OfflineError') {
        throw new OfflineError();
      }
      throw err;
    }

    await this.refresh();

    return async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new OfflineError();
      }
      const undoClient = this.getClient();
      try {
        const undoRes = await undoClient.rpc('restore_sample_data').abortSignal?.(new AbortController().signal);
        if (undoRes?.error) throw undoRes.error;
      } catch (err) {
        if (err instanceof TypeError || (err as any)?.message?.includes('fetch') || (err as any)?.name === 'OfflineError') {
          throw new OfflineError();
        }
        throw err;
      }
      await this.refresh();
    };
  }

  // Clears all cached tenant data from Dexie on sign out
  async clearCache(): Promise<void> {
    const db = (this as any).db as FamilyAccountsDB;
    await clearLocalCopy(db);
    this.currentHouseholdId = null;
    this.currentUserId = '';
    this.lastSyncedAt = null;
  }

  // ---------- Household & Members ----------

  async getHousehold(): Promise<Household | null> {
    const db = (this as any).db as FamilyAccountsDB;
    if (this.currentHouseholdId) {
      const row = await db.households.get(this.currentHouseholdId);
      if (row) return toHousehold(row);
    }
    const rows = await db.households.toArray();
    return rows[0] ? toHousehold(rows[0]) : null;
  }

  async getMembers(): Promise<Member[]> {
    const db = (this as any).db as FamilyAccountsDB;
    const rows = await db.household_members.toArray();
    return rows.map(toMember);
  }

  // ---------- List Entries (Filtered from Sample Deletions) ----------

  async listEntries(params?: ListEntriesParams): Promise<EnrichedEntry[]> {
    const db = (this as any).db as FamilyAccountsDB;
    let rows = await db.transactions.toArray();

    // Cleared samples never show in Recently deleted
    if (params?.onlyDeleted) {
      const activeRows = rows.filter((r: any) => !r.is_sample);
      // Enrich activeRows
      const enriched: EnrichedEntry[] = await (this as any).enrichTransactions(activeRows);
      return enriched.filter((e) => e.deletedAt !== null);
    }

    return super.listEntries(params);
  }

  // Helper to execute a server write via upsert with offline error handling
  private async executeServerSave<T>(
    table: string,
    row: Record<string, unknown>
  ): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new OfflineError();
    }

    const client = this.getClient();
    const payload = toServerPayload(row);

    try {
      const query = client.from(table).upsert(payload).select();
      const signalChain = query.abortSignal ? query.abortSignal(new AbortController().signal) : query;
      const { data, error } = await signalChain.single();

      if (error || !data) {
        throw new Error(error?.message || `Failed to save ${table}`);
      }

      return data as T;
    } catch (err) {
      if (err instanceof TypeError || (err as any)?.message?.includes('fetch')) {
        throw new OfflineError();
      }
      throw err;
    }
  }

  // ---------- Entries (Transactions) Writes ----------

  async addEntry(input: CreateEntryInput): Promise<Entry> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const id = input.id ?? crypto.randomUUID();
    const amount = roundMoney(input.amount);

    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    if (input.type === 'transfer') {
      if (!input.toAccountId) {
        throw new Error('Transfer requires toAccountId');
      }
      if (input.toAccountId === input.accountId) {
        throw new Error('Destination wallet cannot be the same as source wallet');
      }
      if (input.itemId) {
        throw new Error('Transfer cannot have an itemId');
      }
    } else {
      if (!input.itemId) {
        throw new Error(`${input.type} entry requires itemId`);
      }
      if (input.toAccountId) {
        throw new Error(`${input.type} entry cannot have toAccountId`);
      }
    }

    const payload = {
      id,
      household_id: householdId,
      type: input.type,
      amount,
      occurred_on: input.occurredOn,
      account_id: input.accountId,
      to_account_id: input.type === 'transfer' ? input.toAccountId : null,
      item_id: input.type === 'transfer' ? null : input.itemId,
      note: input.note ?? null,
    };

    const saved = await this.executeServerSave<any>('transactions', payload);

    // On Supabase success, update local Dexie cache for reactive UI update
    await db.transactions.put(saved);
    return toEntry(saved);
  }

  async updateEntry(id: string, updates: UpdateEntryInput): Promise<Entry> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.transactions.get(id);
    if (!row) {
      throw new Error(`Entry not found: ${id}`);
    }

    const payload: Record<string, unknown> = {
      ...row,
      id,
      household_id: householdId,
    };

    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.amount !== undefined) {
      const amt = roundMoney(updates.amount);
      if (amt <= 0) throw new Error('Amount must be greater than zero');
      payload.amount = amt;
    }
    if (updates.occurredOn !== undefined) payload.occurred_on = updates.occurredOn;
    if (updates.accountId !== undefined) payload.account_id = updates.accountId;
    if (updates.toAccountId !== undefined) payload.to_account_id = updates.toAccountId;
    if (updates.itemId !== undefined) payload.item_id = updates.itemId;
    if (updates.note !== undefined) payload.note = updates.note;

    const saved = await this.executeServerSave<any>('transactions', payload);
    await db.transactions.put(saved);
    return toEntry(saved);
  }

  async softDeleteEntry(id: string): Promise<void> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.transactions.get(id);
    const now = new Date().toISOString();

    const payload = {
      ...(row ?? {}),
      id,
      household_id: householdId,
      deleted_at: now,
    };

    const saved = await this.executeServerSave<any>('transactions', payload);
    await db.transactions.put(saved);
  }

  async restoreEntry(id: string): Promise<void> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.transactions.get(id);

    const payload = {
      ...(row ?? {}),
      id,
      household_id: householdId,
      deleted_at: null,
    };

    const saved = await this.executeServerSave<any>('transactions', payload);
    await db.transactions.put(saved);
  }

  // ---------- Receipt Photos ----------

  async setEntryPhoto(entryId: string, blob: Blob): Promise<Entry> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new OfflineError();
    }

    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const client = this.getClient();
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const filePath = `${householdId}/${entryId}.${ext}`;

    const { error: uploadError } = await client.storage
      .from('receipts')
      .upload(filePath, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload photo: ${uploadError.message}`);
    }

    const row = await db.transactions.get(entryId);
    const payload = {
      ...(row ?? {}),
      id: entryId,
      household_id: householdId,
      photo_path: filePath,
    };

    const saved = await this.executeServerSave<any>('transactions', payload);

    const now = new Date().toISOString();
    await db.transaction('rw', db.transactions, db.photos, async () => {
      await db.photos.put({ id: entryId, blob, created_at: now });
      await db.transactions.put(saved);
    });

    return toEntry(saved);
  }

  async getEntryPhoto(entryId: string): Promise<Blob | null> {
    const db = (this as any).db as FamilyAccountsDB;

    // 1. Check local Dexie cache
    const cached = await db.photos.get(entryId);
    if (cached?.blob) return cached.blob;

    // 2. Fetch from Supabase storage if photo_path exists
    const row = await db.transactions.get(entryId);
    if (!row?.photo_path) return null;

    try {
      const client = this.getClient();
      const { data, error } = await client.storage
        .from('receipts')
        .download(row.photo_path);

      if (error || !data) return null;

      // Cache locally
      await db.photos.put({
        id: entryId,
        blob: data,
        created_at: new Date().toISOString(),
      });
      return data;
    } catch {
      return null;
    }
  }

  async removeEntryPhoto(entryId: string): Promise<Entry> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.transactions.get(entryId);

    const payload = {
      ...(row ?? {}),
      id: entryId,
      household_id: householdId,
      photo_path: null,
    };

    const saved = await this.executeServerSave<any>('transactions', payload);

    await db.transaction('rw', db.transactions, db.photos, async () => {
      await db.photos.delete(entryId);
      await db.transactions.put(saved);
    });

    return toEntry(saved);
  }

  // ---------- Wallets (Accounts) Writes ----------

  async addWallet(input: CreateWalletInput): Promise<Wallet> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const id = input.id ?? crypto.randomUUID();
    const maxOrderRow = await db.accounts.orderBy('sort_order').last();
    const sortOrder = input.sortOrder ?? (maxOrderRow ? maxOrderRow.sort_order + 1 : 0);

    const payload = {
      id,
      household_id: householdId,
      name_ar: input.nameAr ?? null,
      name_en: input.nameEn ?? null,
      type: input.type,
      opening_balance: roundMoney(input.openingBalance ?? 0),
      icon: input.icon ?? null,
      color: input.color ?? null,
      sort_order: sortOrder,
      is_archived: false,
    };

    const saved = await this.executeServerSave<any>('accounts', payload);
    await db.accounts.put(saved);
    return toWallet(saved);
  }

  async updateWallet(id: string, updates: UpdateWalletInput): Promise<Wallet> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.accounts.get(id);

    const payload: Record<string, unknown> = {
      ...(row ?? {}),
      id,
      household_id: householdId,
    };

    if (updates.nameAr !== undefined) payload.name_ar = updates.nameAr;
    if (updates.nameEn !== undefined) payload.name_en = updates.nameEn;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.openingBalance !== undefined) payload.opening_balance = roundMoney(updates.openingBalance);
    if (updates.icon !== undefined) payload.icon = updates.icon;
    if (updates.color !== undefined) payload.color = updates.color;
    if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

    const saved = await this.executeServerSave<any>('accounts', payload);
    await db.accounts.put(saved);
    return toWallet(saved);
  }

  async archiveWallet(id: string, archive = true): Promise<void> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.accounts.get(id);

    const payload = {
      ...(row ?? {}),
      id,
      household_id: householdId,
      is_archived: archive,
    };

    const saved = await this.executeServerSave<any>('accounts', payload);
    await db.accounts.put(saved);
  }

  // ---------- Categories Writes ----------

  async addCategory(input: CreateCategoryInput): Promise<Category> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const id = input.id ?? crypto.randomUUID();
    const maxOrderRow = await db.categories.orderBy('sort_order').last();
    const sortOrder = input.sortOrder ?? (maxOrderRow ? maxOrderRow.sort_order + 1 : 0);

    const payload = {
      id,
      household_id: householdId,
      kind: input.kind,
      name_ar: input.nameAr ?? null,
      name_en: input.nameEn ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      sort_order: sortOrder,
      is_archived: false,
    };

    const saved = await this.executeServerSave<any>('categories', payload);
    await db.categories.put(saved);
    return toCategory(saved);
  }

  async updateCategory(id: string, updates: UpdateCategoryInput): Promise<Category> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.categories.get(id);

    const payload: Record<string, unknown> = {
      ...(row ?? {}),
      id,
      household_id: householdId,
    };

    if (updates.nameAr !== undefined) payload.name_ar = updates.nameAr;
    if (updates.nameEn !== undefined) payload.name_en = updates.nameEn;
    if (updates.icon !== undefined) payload.icon = updates.icon;
    if (updates.color !== undefined) payload.color = updates.color;
    if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

    const saved = await this.executeServerSave<any>('categories', payload);
    await db.categories.put(saved);
    return toCategory(saved);
  }

  async archiveCategory(id: string, archive = true): Promise<void> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.categories.get(id);

    const payload = {
      ...(row ?? {}),
      id,
      household_id: householdId,
      is_archived: archive,
    };

    const saved = await this.executeServerSave<any>('categories', payload);
    await db.categories.put(saved);
  }

  // ---------- Subcategories Writes ----------

  async addSubcategory(input: CreateSubcategoryInput): Promise<Subcategory> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const id = input.id ?? crypto.randomUUID();
    const maxOrderRow = await db.subcategories.orderBy('sort_order').last();
    const sortOrder = input.sortOrder ?? (maxOrderRow ? maxOrderRow.sort_order + 1 : 0);

    const payload = {
      id,
      household_id: householdId,
      category_id: input.categoryId,
      name_ar: input.nameAr ?? null,
      name_en: input.nameEn ?? null,
      sort_order: sortOrder,
      is_archived: false,
    };

    const saved = await this.executeServerSave<any>('subcategories', payload);
    await db.subcategories.put(saved);
    return toSubcategory(saved);
  }

  async updateSubcategory(id: string, updates: UpdateSubcategoryInput): Promise<Subcategory> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.subcategories.get(id);

    const payload: Record<string, unknown> = {
      ...(row ?? {}),
      id,
      household_id: householdId,
    };

    if (updates.nameAr !== undefined) payload.name_ar = updates.nameAr;
    if (updates.nameEn !== undefined) payload.name_en = updates.nameEn;
    if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

    const saved = await this.executeServerSave<any>('subcategories', payload);
    await db.subcategories.put(saved);
    return toSubcategory(saved);
  }

  async archiveSubcategory(id: string, archive = true): Promise<void> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.subcategories.get(id);

    const payload = {
      ...(row ?? {}),
      id,
      household_id: householdId,
      is_archived: archive,
    };

    const saved = await this.executeServerSave<any>('subcategories', payload);
    await db.subcategories.put(saved);
  }

  // ---------- Items Writes ----------

  async addItem(input: CreateItemInput): Promise<Item> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const id = input.id ?? crypto.randomUUID();
    const maxOrderRow = await db.items.orderBy('sort_order').last();
    const sortOrder = input.sortOrder ?? (maxOrderRow ? maxOrderRow.sort_order + 1 : 0);

    const payload = {
      id,
      household_id: householdId,
      subcategory_id: input.subcategoryId,
      name_ar: input.nameAr ?? null,
      name_en: input.nameEn ?? null,
      sort_order: sortOrder,
      is_archived: false,
    };

    const saved = await this.executeServerSave<any>('items', payload);
    await db.items.put(saved);
    return toItem(saved);
  }

  async updateItem(id: string, updates: UpdateItemInput): Promise<Item> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.items.get(id);

    const payload: Record<string, unknown> = {
      ...(row ?? {}),
      id,
      household_id: householdId,
    };

    if (updates.nameAr !== undefined) payload.name_ar = updates.nameAr;
    if (updates.nameEn !== undefined) payload.name_en = updates.nameEn;
    if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

    const saved = await this.executeServerSave<any>('items', payload);
    await db.items.put(saved);
    return toItem(saved);
  }

  async archiveItem(id: string, archive = true): Promise<void> {
    const { householdId } = await this.getCurrentIdentity();
    const db = (this as any).db as FamilyAccountsDB;
    const row = await db.items.get(id);

    const payload = {
      ...(row ?? {}),
      id,
      household_id: householdId,
      is_archived: archive,
    };

    const saved = await this.executeServerSave<any>('items', payload);
    await db.items.put(saved);
  }

  // ---------- Sync Status ----------

  async syncStatus(): Promise<SyncStatus> {
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!isOnline) {
      return {
        status: 'offline',
        lastSyncedAt: this.lastSyncedAt,
        pendingCount: 0,
      };
    }

    if (this.isSyncing) {
      return {
        status: 'syncing',
        lastSyncedAt: this.lastSyncedAt,
        pendingCount: 0,
      };
    }

    return {
      status: 'synced',
      lastSyncedAt: this.lastSyncedAt,
      pendingCount: 0,
    };
  }
}

// Global default live repository instance (lazy initialized)
let _liveRepository: LiveRepository | null = null;
export const getLiveRepository = (): LiveRepository => {
  if (!_liveRepository) {
    _liveRepository = new LiveRepository();
  }
  return _liveRepository;
};

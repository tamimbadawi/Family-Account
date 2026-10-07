import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface FamilyMember {
  userId: string;
  displayName: string;
  role: 'owner' | 'member';
  username: string;
}

export interface FamilyList {
  members: FamilyMember[];
  isOwner: boolean;
  me: string;
}

type Action =
  | { action: 'list' }
  | { action: 'add_member'; username: string; displayName: string; password: string }
  | { action: 'reset_password'; userId: string; password: string }
  | { action: 'remove_member'; userId: string }
  | { action: 'transfer_owner'; userId: string };

/** Calls the `family-admin` Edge Function; the server checks that only the owner can change anything. */
export async function familyAdmin<T = { ok: true }>(body: Action): Promise<T> {
  const { data, error } = await getSupabaseBrowserClient().functions.invoke('family-admin', { body });
  if (error) {
    // The function answers { error: 'username_taken' | ... }; surface that code
    const context = (error as { context?: Response }).context;
    const code = context ? ((await context.json().catch(() => null)) as { error?: string } | null)?.error : null;
    throw new Error(code ?? 'failed');
  }
  return data as T;
}

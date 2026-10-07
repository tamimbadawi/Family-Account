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

/** An error code from the function, e.g. "username_taken", with any details it sent (e.g. who has the name). */
export class FamilyAdminError extends Error {
  constructor(
    code: string,
    readonly details: Record<string, string> = {}
  ) {
    super(code);
  }
}

/** Calls the `family-admin` Edge Function; the server checks that only the owner can change anything. */
export async function familyAdmin<T = { ok: true }>(body: Action): Promise<T> {
  const { data, error } = await getSupabaseBrowserClient().functions.invoke('family-admin', {
    body,
    // Never leave the screen loading forever: give up after 15 s and show the error
    signal: AbortSignal.timeout(15000),
  });
  if (error) {
    // The function answers { error: 'username_taken' | ... }; surface that code
    const context = (error as { context?: Response }).context;
    const body = context ? ((await context.json().catch(() => null)) as Record<string, string> | null) : null;
    throw new FamilyAdminError(body?.error ?? 'failed', body ?? {});
  }
  return data as T;
}

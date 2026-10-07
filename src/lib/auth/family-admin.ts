import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface FamilyMember {
  userId: string;
  displayName: string;
  role: 'owner' | 'member';
  /** What they sign in with; the app shows displayName everywhere else. */
  email: string;
}

export interface FamilyList {
  members: FamilyMember[];
  isOwner: boolean;
  me: string;
}

type Action =
  | { action: 'list' }
  | { action: 'add_member'; email: string; displayName: string; password: string }
  | { action: 'reset_password'; userId: string; password: string }
  | { action: 'remove_member'; userId: string }
  | { action: 'transfer_owner'; userId: string };

/** An error code from the function, e.g. "email_taken", with any details it sent. */
export class FamilyAdminError extends Error {
  constructor(
    code: string,
    readonly details: Record<string, string> = {}
  ) {
    super(code);
  }
}

/** Calls an Edge Function and turns its { error: code } answer into a FamilyAdminError. */
export async function callFunction<T>(name: 'family-admin' | 'operator', body: object): Promise<T> {
  const { data, error } = await getSupabaseBrowserClient().functions.invoke(name, {
    body,
    // Never leave the screen loading forever: give up after 15 s and show the error
    signal: AbortSignal.timeout(15000),
  });
  if (error) {
    // The function answers { error: 'email_taken' | ... }; surface that code
    const context = (error as { context?: Response }).context;
    const answer = context ? ((await context.json().catch(() => null)) as Record<string, string> | null) : null;
    throw new FamilyAdminError(answer?.error ?? 'failed', answer ?? {});
  }
  return data as T;
}

/** Calls the `family-admin` Edge Function; the server checks that only the owner can change anything. */
export function familyAdmin<T = { ok: true }>(body: Action): Promise<T> {
  return callFunction<T>('family-admin', body);
}

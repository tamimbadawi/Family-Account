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
  | { action: 'get_invite_link' }
  | { action: 'create_family_invite_link' }
  | { action: 'get_invite_info'; code: string }
  | { action: 'join_by_link'; code: string; displayName: string; email: string; password: string }
  | { action: 'start_family_by_invite'; code: string; email: string; password: string }
  | { action: 'add_member'; email: string; displayName: string; password?: string }
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
export async function callFunction<T>(name: 'family-admin' | 'operator' | 'sign-up', body: object): Promise<T> {
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

/** Generates a 24-hour invite link code for someone to start a brand-new family. */
export function createFamilyInviteLink(): Promise<{ ok: true; code: string; expiresAt: string }> {
  return callFunction<{ ok: true; code: string; expiresAt: string }>('family-admin', {
    action: 'create_family_invite_link',
  });
}

/** Fetches family info for an invite link (supports both new-family and member-join codes). */
export function getInviteInfo(code: string): Promise<{ valid: boolean; type?: string; familyName?: string }> {
  return callFunction<{ valid: boolean; type?: string; familyName?: string }>('family-admin', {
    action: 'get_invite_info',
    code,
  });
}

/** Provisions a new auth user (with family_admin flag) via a 24-hour invite code. */
export function startFamilyByInvite(params: {
  code: string;
  email: string;
  password: string;
}): Promise<{ ok: true }> {
  return callFunction<{ ok: true }>('family-admin', {
    action: 'start_family_by_invite',
    ...params,
  });
}

/** Joins the family using an invite code with the recipient's own details. */
export function joinByLink(params: {
  code: string;
  displayName: string;
  email: string;
  password: string;
}): Promise<{ ok: true }> {
  return callFunction<{ ok: true }>('family-admin', {
    action: 'join_by_link',
    ...params,
  });
}

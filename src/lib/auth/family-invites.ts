// Inviting another family (0012_family_invites.sql). Families stay invite-only: a member asks for a
// friend's family here, and the person who runs the app approves it on /operator by creating the
// friend's admin login. In sample-data mode the requests only live in memory.
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';

export interface SentInvite {
  id: string;
  friendName: string;
  email: string;
  status: 'pending' | 'approved' | 'declined' | 'expired';
  createdAt: string;
  /** Only while pending: whole hours until the invite runs out. */
  hoursLeft?: number;
}

/** An invite lives this long from when it is sent (0017_invite_24h.sql). */
export const INVITE_HOURS = 24;
const HOUR_MS = 3_600_000;

/** What the family sees: an invite that ran out with no sign-in is gone, a waiting one says how long it has left. */
export function shownInvites(invites: SentInvite[], now: number): SentInvite[] {
  return invites.flatMap((i) => {
    if (i.status === 'expired') return [];
    if (i.status !== 'pending') return [i];
    const msLeft = new Date(i.createdAt).getTime() + INVITE_HOURS * HOUR_MS - now;
    return msLeft > 0 ? [{ ...i, hoursLeft: Math.ceil(msLeft / HOUR_MS) }] : [];
  });
}

/** Error codes invite_family raises on purpose; anything else is shown as "failed". */
const KNOWN = ['too_many', 'bad_email', 'bad_name', 'suspended', 'not_in_family'];

let sample: SentInvite[] = [];

/** This family's live invites, newest first. */
export async function listFamilyInvites(): Promise<SentInvite[]> {
  if (!isAuthConfigured()) return shownInvites(sample, Date.now());
  const { data, error } = await getSupabaseBrowserClient()
    .from('family_invites')
    .select('id, friend_name, email, status, created_at')
    .neq('status', 'expired')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('failed');
  return shownInvites(
    (data ?? []).map((i) => ({
      id: i.id,
      friendName: i.friend_name,
      email: i.email,
      status: i.status as SentInvite['status'],
      createdAt: i.created_at,
    })),
    Date.now()
  );
}

/** Asks for a friend's family to be started. Throws Error(code) with one of KNOWN or "failed". */
export async function inviteFamily(friendName: string, email: string): Promise<void> {
  if (!isAuthConfigured()) {
    if (!shownInvites(sample, Date.now()).some((i) => i.email === email && i.status === 'pending')) {
      sample = [
        { id: crypto.randomUUID(), friendName, email, status: 'pending', createdAt: new Date().toISOString() },
        ...sample,
      ];
    }
    return;
  }
  const { error } = await getSupabaseBrowserClient().rpc('invite_family', { p_friend_name: friendName, p_email: email });
  if (error) throw new Error(KNOWN.includes(error.message) ? error.message : 'failed');
}

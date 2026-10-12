// Inviting another family (0012_family_invites.sql). Families stay invite-only: a member asks for a
// friend's family here, and the person who runs the app approves it on /operator by creating the
// friend's admin login. In sample-data mode the requests live in localStorage so they persist across refreshes.
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';
import { normalizeEmail, isEmail } from './email';

export interface SentInvite {
  id: string;
  friendName: string;
  email: string;
  status: 'pending' | 'approved' | 'declined' | 'expired';
  createdAt: string;
}

const STORAGE_KEY_INVITES = 'fa_local_invites';

/** Error codes invite_family raises on purpose; anything else is shown as "failed". */
const KNOWN = ['too_many', 'bad_email', 'bad_name', 'suspended', 'not_in_family'];

export function getLocalInvites(): SentInvite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INVITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SentInvite[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalInvites(invites: SentInvite[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_INVITES, JSON.stringify(invites));
  } catch {
    // ignore storage error
  }
}

/** This family's invites, newest first. */
export async function listFamilyInvites(): Promise<SentInvite[]> {
  if (!isAuthConfigured()) {
    return getLocalInvites();
  }
  const { data, error } = await getSupabaseBrowserClient()
    .from('family_invites')
    .select('id, friend_name, email, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('failed');
  return (data ?? []).map((i) => ({
    id: i.id,
    friendName: i.friend_name,
    email: i.email,
    status: i.status as SentInvite['status'],
    createdAt: i.created_at,
  }));
}

/** Asks for a friend's family to be started. Throws Error(code) with one of KNOWN or "failed". */
export async function inviteFamily(friendName: string, email: string): Promise<{ id: string }> {
  const cleanName = friendName.trim();
  const cleanEmail = normalizeEmail(email);

  if (!cleanName || cleanName.length > 60) {
    throw new Error('bad_name');
  }
  if (!isEmail(cleanEmail)) {
    throw new Error('bad_email');
  }

  if (!isAuthConfigured()) {
    const invites = getLocalInvites();
    const existing = invites.find((i) => normalizeEmail(i.email) === cleanEmail && i.status === 'pending');
    if (existing) return { id: existing.id };

    // Limit to 5 invites per 24 hours per household in sample mode (matches 0012_family_invites.sql)
    const oneDayAgo = Date.now() - 24 * 3600 * 1000;
    const recentCount = invites.filter((i) => new Date(i.createdAt).getTime() > oneDayAgo).length;
    if (recentCount >= 5) {
      throw new Error('too_many');
    }

    const newInvite: SentInvite = {
      id: crypto.randomUUID(),
      friendName: cleanName,
      email: cleanEmail,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    invites.unshift(newInvite);
    saveLocalInvites(invites);
    return { id: newInvite.id };
  }

  const { data, error } = await getSupabaseBrowserClient().rpc('invite_family', {
    p_friend_name: cleanName,
    p_email: cleanEmail,
  });
  if (error) throw new Error(KNOWN.includes(error.message) ? error.message : 'failed');
  return { id: typeof data === 'string' ? data : (data as any)?.id ?? crypto.randomUUID() };
}

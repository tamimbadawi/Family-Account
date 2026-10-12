// Local / Sample-data Mode Authentication & Member Management
// Powers login, session cookies, route-guarding in proxy.ts, member management,
// and multi-family isolation when running locally without a live Supabase connection.

import { DEMO_HOUSEHOLD_ID, USER_BABA_ID, USER_MAMA_ID } from '@/lib/data/mock-seed';
import { db } from '@/lib/offline/db';
import { normalizeEmail, toLoginEmail } from './email';

export interface LocalUser {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  password?: string;
  role: 'owner' | 'member';
  householdId: string;
  age?: string | number;
  householdsCount?: string | number;
}

export interface LocalHousehold {
  id: string;
  name: string;
  currency: string;
  ownerId: string;
  age?: string | number;
  householdsCount?: string | number;
}

export interface LocalSession {
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'member';
  householdId: string;
}

const COOKIE_NAME = 'fa_session';
const STORAGE_KEY_USERS = 'fa_local_users';
const STORAGE_KEY_HOUSEHOLDS = 'fa_local_households';

// Default starter accounts in local mode (belonging strictly to DEMO_HOUSEHOLD_ID)
const DEFAULT_USERS: LocalUser[] = [
  {
    userId: '22222222-2222-2222-2222-222222222222',
    email: 'injy@family.local',
    username: 'injy',
    displayName: 'Injy',
    password: '123456',
    role: 'owner',
    householdId: DEMO_HOUSEHOLD_ID,
  },
  {
    userId: USER_MAMA_ID,
    email: 'mama@family.local',
    username: 'mama',
    displayName: 'Mama',
    password: '123456',
    role: 'owner',
    householdId: DEMO_HOUSEHOLD_ID,
  },
  {
    userId: USER_BABA_ID,
    email: 'baba@family.local',
    username: 'baba',
    displayName: 'Baba',
    password: '123456',
    role: 'member',
    householdId: DEMO_HOUSEHOLD_ID,
  },
];

const DEFAULT_HOUSEHOLDS: LocalHousehold[] = [
  {
    id: DEMO_HOUSEHOLD_ID,
    name: 'عائلتنا',
    currency: 'EGP',
    ownerId: '22222222-2222-2222-2222-222222222222',
    householdsCount: 1,
  },
];

export function getLocalHouseholds(): LocalHousehold[] {
  if (typeof window === 'undefined') return DEFAULT_HOUSEHOLDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HOUSEHOLDS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_HOUSEHOLDS, JSON.stringify(DEFAULT_HOUSEHOLDS));
      return DEFAULT_HOUSEHOLDS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_HOUSEHOLDS;
  } catch {
    return DEFAULT_HOUSEHOLDS;
  }
}

export function saveLocalHouseholds(households: LocalHousehold[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_HOUSEHOLDS, JSON.stringify(households));
  } catch {
    // ignore
  }
}

export function getLocalHousehold(id: string): LocalHousehold | undefined {
  return getLocalHouseholds().find((h) => h.id === id);
}

export function updateLocalHousehold(id: string, updates: Partial<LocalHousehold>): void {
  const households = getLocalHouseholds();
  const idx = households.findIndex((h) => h.id === id);
  if (idx !== -1) {
    households[idx] = { ...households[idx], ...updates };
    saveLocalHouseholds(households);
  }
}

/** Read all local users from storage with unique deduplication and family isolation */
export function getLocalUsers(): LocalUser[] {
  if (typeof window === 'undefined') return DEFAULT_USERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    let users: LocalUser[] = DEFAULT_USERS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        users = parsed;
      }
    }

    // 1. Deduplicate users by userId to eliminate duplicate key errors
    const seenIds = new Set<string>();
    const deduplicated: LocalUser[] = [];
    for (const u of users) {
      if (!seenIds.has(u.userId)) {
        seenIds.add(u.userId);
        deduplicated.push(u);
      }
    }
    users = deduplicated;

    // 2. Migration: Ensure any registered user outside the core demo family has their own isolated household
    let changed = false;
    const households = getLocalHouseholds();

    users.forEach((u) => {
      const norm = normalizeEmail(u.email);
      const isDemo =
        norm === 'injy@family.local' ||
        norm === 'mama@family.local' ||
        norm === 'baba@family.local' ||
        u.userId === '22222222-2222-2222-2222-222222222222' ||
        u.userId === USER_MAMA_ID ||
        u.userId === USER_BABA_ID;

      // If a non-demo user was previously lumped into DEMO_HOUSEHOLD_ID, give them their own household
      if (!isDemo && u.householdId === DEMO_HOUSEHOLD_ID) {
        u.householdId = 'household-' + u.userId;
        changed = true;
        if (!households.some((h) => h.id === u.householdId)) {
          households.push({
            id: u.householdId,
            name: u.displayName ? `${u.displayName}'s Family` : 'عائلتنا',
            currency: 'EGP',
            ownerId: u.userId,
            age: u.age,
            householdsCount: u.householdsCount || 1,
          });
        }
      }
    });

    let rawLen = 0;
    try {
      if (raw) rawLen = JSON.parse(raw).length;
    } catch {
      rawLen = 0;
    }

    if (changed || users.length !== rawLen) {
      saveLocalUsers(users);
      saveLocalHouseholds(households);
    }

    return users;
  } catch {
    return DEFAULT_USERS;
  }
}

/** Save local users */
function saveLocalUsers(users: LocalUser[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch {
    // ignore
  }
}

/** Find a local user by email or username */
export function findLocalUser(identifier: string): LocalUser | undefined {
  const norm = normalizeEmail(identifier);
  const loginEmail = toLoginEmail(identifier);
  const users = getLocalUsers();

  return users.find((u) => {
    const uEmail = normalizeEmail(u.email);
    const uUser = normalizeEmail(u.username);
    return (
      uEmail === norm ||
      uEmail === loginEmail ||
      uUser === norm ||
      (norm.includes('@') && norm.split('@')[0] === uUser)
    );
  });
}

/** Read the active session from cookie or localStorage */
export function getLocalSession(): LocalSession | null {
  if (typeof document === 'undefined') return null;

  // 1. Try cookie first (single source of truth matching proxy.ts)
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const c of cookies) {
    const [name, ...val] = c.trim().split('=');
    if (name === COOKIE_NAME && val.length > 0) {
      try {
        const decoded = decodeURIComponent(val.join('='));
        const parsed = JSON.parse(decoded) as LocalSession;
        if (parsed && parsed.userId && parsed.displayName) {
          return parsed;
        }
      } catch {
        // malformed cookie
      }
    }
  }

  // 2. Fallback to localStorage session
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(COOKIE_NAME);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalSession;
        if (parsed && parsed.userId && parsed.displayName) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/** Whether the currently active local session is an owner */
export function isLocalOwner(): boolean {
  const s = getLocalSession();
  return s ? s.role === 'owner' : false;
}

/** Sign out: completely purge local session cookie, storage, and dispatch update event */
export function signOutLocal(): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `${COOKIE_NAME}=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(COOKIE_NAME);
      localStorage.removeItem('fa_active_user');
      localStorage.removeItem('fa_session_user');
    } catch {
      // ignore
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(COOKIE_NAME);
      sessionStorage.clear();
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('local-session-change'));
  }
}

/** Sign in with local credentials */
export function signInLocal(
  identifier: string,
  password?: string
): { success: true; user: LocalSession } | { success: false; error: 'wrongPassword' | 'userNotFound' } {
  // Purge any stale session before establishing a new one
  signOutLocal();

  const user = findLocalUser(identifier);
  if (!user) {
    return { success: false, error: 'userNotFound' };
  }

  // Password verification:
  if (user.password && password && user.password !== password) {
    return { success: false, error: 'wrongPassword' };
  }

  const session: LocalSession = {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    householdId: user.householdId,
  };

  // Set cookie for proxy.ts middleware to recognize session across page navigations
  if (typeof document !== 'undefined') {
    const encoded = encodeURIComponent(JSON.stringify(session));
    document.cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=2592000; SameSite=Lax`;
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(COOKIE_NAME, JSON.stringify(session));
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('local-session-change'));
  }

  return { success: true, user: session };
}

/** Register a user in local mode, automatically determining if they are starting a family (Admin invite) or joining an existing family (Member invite) based on their invited email */
export async function registerLocalUser(params: {
  email: string;
  password?: string;
  familyName?: string;
  age?: string | number;
  householdsCount?: string | number;
}): Promise<LocalUser> {
  const normEmail = normalizeEmail(params.email);

  // Validate that this email has an approved/pending invite
  const check = findInviteByEmail(normEmail);
  if (!check.valid || !check.invite) {
    throw new Error(check.error || 'email_not_invited');
  }

  // If invited as a member of an existing family:
  if (check.type === 'member') {
    return registerLocalMemberWithInvite({
      email: normEmail,
      displayName: params.familyName?.trim() || 'Member',
      password: params.password,
      age: params.age,
    });
  }

  // Otherwise (invited as Admin / new family):
  return registerNewLocalFamily(params);
}

/** Register a completely new family account with its own isolated household via an Admin Invite (by invited email) */
export async function registerNewLocalFamily(params: {
  email: string;
  password?: string;
  familyName?: string;
  age?: string | number;
  householdsCount?: string | number;
  inviteCode?: string;
}): Promise<LocalUser> {
  const normEmail = normalizeEmail(params.email);

  // Validate that this email has an approved/pending Admin Invite
  const check = findInviteByEmail(normEmail);
  if (!check.valid || !check.invite) {
    throw new Error(check.error || 'email_not_invited');
  }

  if (check.type !== 'admin') {
    throw new Error('wrong_invite_type_admin');
  }

  markInviteAcceptedByEmail(normEmail);
  if (params.inviteCode) {
    markLocalInviteAccepted(params.inviteCode);
  }

  const users = getLocalUsers();

  if (users.some((u) => normalizeEmail(u.email) === normEmail)) {
    throw new Error('email_taken');
  }

  if (params.password && params.password.length < 6) {
    throw new Error('short_password');
  }

  const username = normEmail.includes('@') ? normEmail.split('@')[0] : normEmail;
  const newHouseholdId = crypto.randomUUID();
  const newUserId = crypto.randomUUID();
  const familyName = params.familyName?.trim() || `${username}'s Family`;

  // Create isolated household
  const households = getLocalHouseholds();
  const newHousehold: LocalHousehold = {
    id: newHouseholdId,
    name: familyName,
    currency: 'EGP',
    ownerId: newUserId,
    age: params.age,
    householdsCount: params.householdsCount || 1,
  };
  households.push(newHousehold);
  saveLocalHouseholds(households);

  const newUser: LocalUser = {
    userId: newUserId,
    email: normEmail.includes('@') ? normEmail : toLoginEmail(normEmail),
    username,
    displayName: username,
    password: params.password || '123456',
    role: 'owner',
    householdId: newHouseholdId,
    age: params.age,
    householdsCount: params.householdsCount || 1,
  };

  users.push(newUser);
  saveLocalUsers(users);

  // Sync to Dexie
  if (typeof indexedDB !== 'undefined') {
    try {
      await db.households.put({
        id: newHousehold.id,
        name: newHousehold.name,
        currency: newHousehold.currency,
        created_at: new Date().toISOString(),
      });
      await db.household_members.put({
        household_id: newHouseholdId,
        user_id: newUserId,
        display_name: newUser.displayName,
        role: 'owner',
        locale: 'en',
        created_at: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  }

  return newUser;
}

/** Register a member to an existing family household via a Member Invite (by invited email) */
export async function registerLocalMemberWithInvite(params: {
  email: string;
  displayName: string;
  password?: string;
  age?: string | number;
  inviteCode?: string;
}): Promise<LocalUser> {
  const normEmail = normalizeEmail(params.email);

  // Validate that this email has an approved/pending Member Invite
  const check = findInviteByEmail(normEmail);
  if (!check.valid || !check.invite) {
    throw new Error(check.error || 'email_not_invited');
  }

  if (check.type !== 'member') {
    throw new Error('wrong_invite_type_member');
  }

  const householdId = check.invite.householdId || DEMO_HOUSEHOLD_ID;
  const user = await addLocalMember({
    email: normEmail,
    displayName: params.displayName,
    password: params.password,
    role: 'member',
    householdId,
  });

  if (params.age) {
    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.userId === user.userId);
    if (idx !== -1) {
      users[idx].age = params.age;
      saveLocalUsers(users);
    }
  }

  markInviteAcceptedByEmail(normEmail);
  if (params.inviteCode) {
    markLocalInviteAccepted(params.inviteCode);
  }

  return user;
}

/** Add a new household member in local mode within a specific household */
export async function addLocalMember(params: {
  email: string;
  displayName: string;
  password?: string;
  role?: 'owner' | 'member';
  householdId?: string;
}): Promise<LocalUser> {
  const users = getLocalUsers();
  const normEmail = normalizeEmail(params.email);

  if (users.some((u) => normalizeEmail(u.email) === normEmail)) {
    throw new Error('email_taken');
  }

  if (params.password && params.password.length < 6) {
    throw new Error('short_password');
  }

  const username = normEmail.includes('@') ? normEmail.split('@')[0] : normEmail;
  const session = getLocalSession();
  const householdId = params.householdId ?? session?.householdId ?? DEMO_HOUSEHOLD_ID;

  const newUser: LocalUser = {
    userId: crypto.randomUUID(),
    email: normEmail.includes('@') ? normEmail : toLoginEmail(normEmail),
    username,
    displayName: params.displayName.trim(),
    password: params.password || '123456',
    role: params.role ?? 'member',
    householdId,
  };

  users.push(newUser);
  saveLocalUsers(users);

  // Sync with Dexie household_members table
  if (typeof indexedDB !== 'undefined') {
    try {
      await db.household_members.put({
        household_id: householdId,
        user_id: newUser.userId,
        display_name: newUser.displayName,
        role: newUser.role,
        locale: 'en',
        created_at: new Date().toISOString(),
      });
    } catch {
      // ignore dexie write issues
    }
  }

  return newUser;
}

/** Reset a member's password in local mode */
export function resetLocalPassword(userId: string, newPassword: string): void {
  if (newPassword && newPassword.length < 6) {
    throw new Error('short_password');
  }
  const users = getLocalUsers();
  const idx = users.findIndex((u) => u.userId === userId);
  if (idx === -1) throw new Error('not_member');
  users[idx].password = newPassword;
  saveLocalUsers(users);
}

/** Remove a member in local mode */
export async function removeLocalMember(userId: string): Promise<void> {
  let users = getLocalUsers();
  users = users.filter((u) => u.userId !== userId);
  saveLocalUsers(users);

  if (typeof indexedDB !== 'undefined') {
    try {
      const session = getLocalSession();
      const hid = session?.householdId ?? DEMO_HOUSEHOLD_ID;
      await db.household_members.delete([hid, userId]);
    } catch {
      // ignore
    }
  }
}

/** Transfer admin role to another member */
export function transferLocalOwner(targetUserId: string): void {
  const users = getLocalUsers();
  const target = users.find((u) => u.userId === targetUserId);
  if (!target) throw new Error('not_member');

  users.forEach((u) => {
    if (u.householdId === target.householdId) {
      if (u.userId === targetUserId) u.role = 'owner';
      else if (u.role === 'owner') u.role = 'member';
    }
  });

  saveLocalUsers(users);

  // Update session if current user was the owner
  const current = getLocalSession();
  if (current && current.householdId === target.householdId) {
    if (current.userId === targetUserId) current.role = 'owner';
    else current.role = 'member';
    if (typeof document !== 'undefined') {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(current))}; path=/; max-age=2592000; SameSite=Lax`;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(COOKIE_NAME, JSON.stringify(current));
      } catch {
        // ignore
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('local-session-change'));
    }
  }
}

// ---------- Local Invite Management (Admin & Member Invites) ----------

export interface LocalInvite {
  id: string;
  code: string;
  type: 'admin' | 'member';
  invitedName: string;
  invitedEmail: string;
  householdId?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
}

const STORAGE_KEY_AUTH_INVITES = 'fa_local_auth_invites';

const DEFAULT_INVITES: LocalInvite[] = [
  {
    id: 'inv-admin-demo',
    code: 'ADM-2026',
    type: 'admin',
    invitedName: 'Friend Family Admin',
    invitedEmail: 'admin@friend.local',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inv-member-demo',
    code: 'MEM-2026',
    type: 'member',
    invitedName: 'New Member',
    invitedEmail: 'member@family.local',
    householdId: DEMO_HOUSEHOLD_ID,
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
];

export function getLocalInvites(): LocalInvite[] {
  if (typeof window === 'undefined') return DEFAULT_INVITES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_INVITES);
    let list: LocalInvite[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed.filter(
          (i): i is LocalInvite => Boolean(i && typeof i === 'object' && typeof i.code === 'string')
        );
      }
    }
    // Ensure default seeds are always accessible
    for (const seed of DEFAULT_INVITES) {
      if (!list.some((i) => i.code?.toUpperCase() === seed.code.toUpperCase())) {
        list.push(seed);
      }
    }
    return list;
  } catch {
    return DEFAULT_INVITES;
  }
}

export function saveLocalInvites(invites: LocalInvite[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_AUTH_INVITES, JSON.stringify(invites));
  } catch {
    // ignore
  }
}

export function findLocalInvite(code: string): LocalInvite | undefined {
  if (!code || typeof code !== 'string') return undefined;
  const clean = code.trim().toUpperCase();
  const invites = getLocalInvites();
  return invites.find((i) => Boolean(i?.code && i.code.toUpperCase() === clean));
}

export function createLocalInvite(params: {
  type: 'admin' | 'member';
  invitedName: string;
  invitedEmail: string;
  householdId?: string;
}): LocalInvite {
  const invites = getLocalInvites();
  const normEmail = normalizeEmail(params.invitedEmail);

  // Re-use pending invite if already exists for this email and type
  const existing = invites.find(
    (i) => normalizeEmail(i.invitedEmail) === normEmail && i.type === params.type && i.status === 'pending'
  );
  if (existing) return existing;

  const prefix = params.type === 'admin' ? 'ADM-' : 'MEM-';
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = prefix + randomSuffix;

  const newInv: LocalInvite = {
    id: crypto.randomUUID(),
    code,
    type: params.type,
    invitedName: params.invitedName.trim(),
    invitedEmail: normEmail,
    householdId: params.householdId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  invites.unshift(newInv);
  saveLocalInvites(invites);
  return newInv;
}

export function validateLocalInvite(
  code: string,
  expectedType?: 'admin' | 'member'
): { valid: boolean; invite?: LocalInvite; error?: string } {
  if (!code || typeof code !== 'string') return { valid: false, error: 'invite_required' };
  const clean = code.trim().toUpperCase();
  if (!clean) return { valid: false, error: 'invite_required' };

  // Demo seeds
  if (clean === 'ADM-2026') {
    if (expectedType && expectedType !== 'admin') {
      return { valid: false, error: 'wrong_invite_type_admin' };
    }
    return { valid: true, invite: DEFAULT_INVITES[0] };
  }
  if (clean === 'MEM-2026') {
    if (expectedType && expectedType !== 'member') {
      return { valid: false, error: 'wrong_invite_type_member' };
    }
    return { valid: true, invite: DEFAULT_INVITES[1] };
  }

  const invites = getLocalInvites();
  const found = invites.find((i) => Boolean(i?.code && i.code.toUpperCase() === clean));
  if (!found) {
    return { valid: false, error: 'invalid_invite' };
  }

  if (found.status === 'accepted') {
    return { valid: false, error: 'invite_already_used' };
  }
  if (found.status === 'expired' || found.status === 'declined') {
    return { valid: false, error: 'invite_expired' };
  }

  if (expectedType && found.type !== expectedType) {
    return {
      valid: false,
      error: found.type === 'admin' ? 'wrong_invite_type_member' : 'wrong_invite_type_admin',
    };
  }

  return { valid: true, invite: found };
}

export function markLocalInviteAccepted(code: string): void {
  if (!code || typeof code !== 'string') return;
  const clean = code.trim().toUpperCase();
  if (clean === 'ADM-2026' || clean === 'MEM-2026') return; // Demo codes remain reusable
  const invites = getLocalInvites();
  const idx = invites.findIndex((i) => Boolean(i?.code && i.code.toUpperCase() === clean));
  if (idx !== -1) {
    invites[idx].status = 'accepted';
    saveLocalInvites(invites);
  }
}

/** Validate whether an email was invited (as Admin or Member) without needing any code */
export function findInviteByEmail(email: string): {
  valid: boolean;
  type?: 'admin' | 'member';
  invite?: LocalInvite | any;
  error?: string;
} {
  const norm = normalizeEmail(email);
  if (!norm) return { valid: false, error: 'invite_required' };

  // 1. Seed demo emails
  if (norm === 'admin@friend.local' || norm === 'admin@newfamily.com' || norm === 'admin@demo.local') {
    return { valid: true, type: 'admin', invite: DEFAULT_INVITES[0] };
  }
  if (norm === 'member@family.local' || norm === 'newmember@family.local' || norm === 'member@demo.local') {
    return { valid: true, type: 'member', invite: DEFAULT_INVITES[1] };
  }

  // 2. Check local auth invites
  const invites = getLocalInvites();
  const match = invites.find((i) => normalizeEmail(i.invitedEmail) === norm);
  if (match) {
    if (match.status === 'accepted') return { valid: false, error: 'invite_already_used' };
    if (match.status === 'expired' || match.status === 'declined') return { valid: false, error: 'invite_expired' };
    return { valid: true, type: match.type, invite: match };
  }

  // 3. Check family invites storage ('fa_local_invites')
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('fa_local_invites');
      if (raw) {
        const familyInvs = JSON.parse(raw);
        if (Array.isArray(familyInvs)) {
          const fMatch = familyInvs.find((fi: any) => normalizeEmail(fi.email) === norm);
          if (fMatch) {
            if (fMatch.status === 'declined' || fMatch.status === 'expired') {
              return { valid: false, error: 'invite_expired' };
            }
            return {
              valid: true,
              type: 'admin',
              invite: {
                id: fMatch.id,
                code: 'ADM-AUTO',
                type: 'admin',
                invitedName: fMatch.friendName,
                invitedEmail: fMatch.email,
                status: fMatch.status,
                createdAt: fMatch.createdAt,
              },
            };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return { valid: false, error: 'email_not_invited' };
}

export function markInviteAcceptedByEmail(email: string): void {
  const norm = normalizeEmail(email);
  if (!norm) return;
  const invites = getLocalInvites();
  const idx = invites.findIndex((i) => normalizeEmail(i.invitedEmail) === norm);
  if (idx !== -1) {
    invites[idx].status = 'accepted';
    saveLocalInvites(invites);
  }
}


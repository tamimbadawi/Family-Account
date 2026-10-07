import { callFunction } from './family-admin';

/** One family as the operator sees it: counts only, never amounts, notes or categories. */
export interface OperatorFamily {
  householdId: string;
  name: string;
  status: 'active' | 'suspended';
  currencies: string[];
  createdAt: string;
  adminEmail: string;
  members: number;
  wallets: number;
  entries: number;
  lastEntryAt: string | null;
}

/** A family admin the operator created who hasn't signed in and set up the family yet. */
export interface WaitingFamily {
  email: string;
  familyName: string;
  createdAt: string;
}

/** Someone in a family asked for a friend's family to be started (family_invites, 0012). */
export interface FamilyRequest {
  inviteId: string;
  friendName: string;
  email: string;
  createdAt: string;
  /** The family that sent the invite, and who in it. */
  fromFamily: string;
  fromName: string;
}

type Action =
  | { action: 'list' }
  | { action: 'create_family_admin'; familyName: string; email: string; password: string; inviteId?: string }
  | { action: 'decline_invite'; inviteId: string }
  | { action: 'set_status'; householdId: string; status: 'active' | 'suspended' }
  | { action: 'reset_admin_password'; householdId: string; password: string };

/** Calls the `operator` Edge Function; only emails in its OPERATOR_EMAILS secret get an answer. */
export function operator<T = { ok: true }>(body: Action): Promise<T> {
  return callFunction<T>('operator', body);
}

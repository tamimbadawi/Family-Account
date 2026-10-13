import { callFunction, FamilyAdminError } from './family-admin';

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
  /** When the unused login is deleted (24 h after it was made, 0013_invite_expiry.sql). */
  expiresAt?: string;
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

/** A message someone sent from Settings → Contact support (support_messages, 0016), not yet marked done. */
export interface SupportInboxMessage {
  id: string;
  family: string;
  sender: string;
  section: string | null;
  message: string;
  /** Short-lived links to the photos (about an hour). */
  photoUrls: string[];
  createdAt: string;
}

/** One person in a family, as the operator dashboard sees them (operator_insights, 0025). */
export interface InsightsMember {
  name: string;
  email: string | null;
  role: 'owner' | 'member';
  joinedAt: string;
  lastSignInAt: string | null;
  /** Real entries this person added (sample entries are never counted). */
  entries: number;
  lastEntryAt: string | null;
}

export interface InsightsFamily {
  householdId: string;
  name: string;
  status: 'active' | 'suspended';
  createdAt: string;
  entries: number;
  entries7d: number;
  lastEntryAt: string | null;
  /** The family still shows the sample entries every new family starts with. */
  hasSample: boolean;
  members: InsightsMember[];
}

/** A Contact support message from the last 30 days, open or done (photos only on the open ones, from 'list'). */
export interface InsightsSupport {
  id: string;
  family: string;
  sender: string | null;
  email: string | null;
  section: string | null;
  message: string;
  photoCount: number;
  status: 'new' | 'done';
  createdAt: string;
  handledAt: string | null;
}

/** Usage numbers for the operator dashboard: counts and dates only, never amounts. */
export interface OperatorInsights {
  totals: {
    families: number;
    people: number;
    entries: number;
    entries7d: number;
    entries30d: number;
    activeFamilies7d: number;
    signIns7d: number;
    supportOpen: number;
  };
  /** Entries added per day (Cairo time), the last 30 days, oldest first. */
  daily: { day: string; entries: number }[];
  families: InsightsFamily[];
  supportRecent: InsightsSupport[];
}

type Action =
  | { action: 'list' }
  | { action: 'insights' }
  | { action: 'create_family_admin'; familyName: string; email: string; password: string; inviteId?: string }
  | { action: 'decline_invite'; inviteId: string }
  | { action: 'support_done'; messageId: string }
  | { action: 'set_status'; householdId: string; status: 'active' | 'suspended' }
  | { action: 'reset_admin_password'; householdId: string; password: string };

/** Calls the `operator` Edge Function; only emails in its OPERATOR_EMAILS secret get an answer. */
export function operator<T = { ok: true }>(body: Action): Promise<T> {
  return callFunction<T>('operator', body);
}

/**
 * True when the signed-in person runs the app (their email is in OPERATOR_EMAILS), so Settings can
 * show the link to /operator. An older deployed function answers "unknown_action" only after the
 * email check has passed, so that counts as yes too. Any other failure counts as no.
 */
export async function isOperator(): Promise<boolean> {
  try {
    await callFunction('operator', { action: 'whoami' });
    return true;
  } catch (err) {
    return err instanceof FamilyAdminError && err.message === 'unknown_action';
  }
}

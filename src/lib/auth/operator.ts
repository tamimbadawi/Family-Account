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

type Action =
  | { action: 'list' }
  | { action: 'create_family_admin'; email: string; password: string }
  | { action: 'set_status'; householdId: string; status: 'active' | 'suspended' }
  | { action: 'reset_admin_password'; householdId: string; password: string };

/** Calls the `operator` Edge Function; only emails in its OPERATOR_EMAILS secret get an answer. */
export function operator<T = { ok: true }>(body: Action): Promise<T> {
  return callFunction<T>('operator', body);
}

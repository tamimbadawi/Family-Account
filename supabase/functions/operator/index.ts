// operator · lets the person who runs the app (Tamim) start new families and look after them.
// Only emails listed in the OPERATOR_EMAILS secret (comma-separated, set in Supabase → Edge Functions
// → Secrets, never in git) may call it. It returns counts only, never amounts, notes or categories.
//
// Starting a family: the operator types the family's name, its admin's email and a temporary password.
// The admin signs in with them, chooses their own password, then on Welcome finds the family name filled
// in, types their own name (what the app shows) and picks the family's currencies. See docs/MULTI-FAMILY.md.
//
// Family invites: anyone in a family can ask for a friend's family (invite_family, 0011). The open
// requests come back with 'list'; starting a family with an inviteId approves that request.
import { createClient } from 'npm:@supabase/supabase-js@2';

const normalizeEmail = (e: string) => e.trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: caller, error: callerError } = await admin.auth.getUser(jwt);
  if (callerError || !caller.user) return reply(401, { error: 'not_signed_in' });

  const operators = (Deno.env.get('OPERATOR_EMAILS') ?? '').split(',').map(normalizeEmail).filter(Boolean);
  if (!operators.includes(normalizeEmail(caller.user.email ?? ''))) return reply(403, { error: 'not_operator' });

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'bad_json' });
  }

  switch (body.action) {
    // Every family, with counts only, then families whose admin hasn't signed in and set up yet
    case 'list': {
      const { data: rows, error } = await admin.rpc('operator_families');
      if (error) {
        console.error('[operator] operator_families failed', error.code);
        return reply(500, { error: 'failed' });
      }
      const families = await Promise.all(
        (rows ?? []).map(async (f: Record<string, unknown>) => {
          const { data } = f.admin_user_id
            ? await admin.auth.admin.getUserById(f.admin_user_id as string)
            : { data: { user: null } };
          return {
            householdId: f.household_id,
            name: f.name,
            status: f.status,
            currencies: f.currencies,
            createdAt: f.created_at,
            adminEmail: data.user?.email ?? '',
            members: f.members,
            wallets: f.wallets,
            entries: f.entries,
            lastEntryAt: f.last_entry_at,
          };
        })
      );
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const started = new Set((rows ?? []).map((f: Record<string, unknown>) => f.admin_user_id));
      const { data: memberRows } = await admin.from('household_members').select('user_id');
      const inAFamily = new Set((memberRows ?? []).map((m) => m.user_id));
      const waiting = (users?.users ?? [])
        .filter((u) => u.app_metadata?.family_admin && !started.has(u.id) && !inAFamily.has(u.id))
        .map((u) => ({ email: u.email ?? '', familyName: (u.app_metadata?.family_name as string) ?? '', createdAt: u.created_at }));
      const { data: inviteRows } = await admin.rpc('operator_family_invites');
      const requests = (inviteRows ?? []).map((i: Record<string, unknown>) => ({
        inviteId: i.invite_id,
        friendName: i.friend_name,
        email: i.email,
        createdAt: i.created_at,
        fromFamily: i.from_family,
        fromName: i.from_name ?? '',
      }));
      return reply(200, { families, waiting, requests });
    }

    case 'create_family_admin': {
      const email = normalizeEmail(body.email ?? '');
      const password = body.password ?? '';
      const familyName = (body.familyName ?? '').trim().slice(0, 60);
      if (!familyName) return reply(400, { error: 'no_family_name' });
      if (!EMAIL_RE.test(email)) return reply(400, { error: 'bad_email' });
      if (password.length < 6) return reply(400, { error: 'short_password' });
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        // Only the service role can set app_metadata: create_household checks family_admin,
        // and Welcome fills in the family name the operator chose
        app_metadata: { family_admin: true, family_name: familyName },
        user_metadata: { must_change_password: true },
      });
      if (error || !created.user) {
        const code = (error as { code?: string } | null)?.code ?? '';
        if (code === 'email_exists' || code === 'user_already_exists' || /already/i.test(error?.message ?? '')) {
          return reply(409, { error: 'email_taken' });
        }
        if (code === 'weak_password') return reply(400, { error: 'weak_password' });
        console.error('[operator] createUser failed', code);
        return reply(500, { error: 'failed' });
      }
      if (body.inviteId) {
        const { error: decideError } = await admin.rpc('decide_family_invite', { p_invite_id: body.inviteId, p_status: 'approved' });
        if (decideError) console.error('[operator] decide_family_invite failed', decideError.code);
      }
      return reply(200, { ok: true });
    }

    // Says no to a family invite request (approving happens by starting the family, above)
    case 'decline_invite': {
      if (!body.inviteId) return reply(400, { error: 'bad_request' });
      const { error } = await admin.rpc('decide_family_invite', { p_invite_id: body.inviteId, p_status: 'declined' });
      return error ? reply(500, { error: 'failed' }) : reply(200, { ok: true });
    }

    case 'set_status': {
      if (!body.householdId || !['active', 'suspended'].includes(body.status)) return reply(400, { error: 'bad_request' });
      const { error } = await admin.rpc('set_family_status', { p_household_id: body.householdId, p_status: body.status });
      return error ? reply(500, { error: 'failed' }) : reply(200, { ok: true });
    }

    // A family admin forgot their password: the operator sets a temporary one (after checking who
    // is asking, e.g. by phone). They choose their own again at the next sign-in.
    case 'reset_admin_password': {
      if (!body.householdId || (body.password ?? '').length < 6) return reply(400, { error: 'short_password' });
      const { data: owner } = await admin
        .from('household_members')
        .select('user_id')
        .eq('household_id', body.householdId)
        .eq('role', 'owner')
        .maybeSingle();
      if (!owner) return reply(404, { error: 'not_found' });
      const { error } = await admin.auth.admin.updateUserById(owner.user_id, {
        password: body.password,
        user_metadata: { must_change_password: true },
      });
      return error ? reply(500, { error: 'failed' }) : reply(200, { ok: true });
    }

    default:
      return reply(400, { error: 'unknown_action' });
  }
});

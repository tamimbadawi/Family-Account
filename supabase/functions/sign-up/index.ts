// sign-up · lets an invited person create their own account from the sign-in page. Open to anyone
// (nobody is signed in yet), so the invite is the check: the email must have a family invite that is
// still waiting and was sent in the last 24 hours (signup_invite, 0019). Anyone else is refused.
//
// The login is made here with the service role, already confirmed, so no confirmation email is sent and
// the person goes straight in. It carries app_metadata.family_admin, which create_family requires
// (0019_signup_invited_only): a login made any other way cannot start a family. The invite is then
// marked approved, which the inviting family sees as "Started".
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

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'bad_json' });
  }
  const email = normalizeEmail(String(body.email ?? ''));
  const password = String(body.password ?? '');
  if (!EMAIL_RE.test(email)) return reply(400, { error: 'bad_email' });
  if (password.length < 8) return reply(400, { error: 'short_password' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inviteId, error: inviteError } = await admin.rpc('signup_invite', { p_email: email });
  if (inviteError) {
    console.error('[sign-up] invite lookup failed', inviteError.code);
    return reply(500, { error: 'failed' });
  }
  if (!inviteId) return reply(403, { error: 'not_invited' });

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Only the service role can set app_metadata: create_family checks family_admin
    app_metadata: { family_admin: true },
  });
  if (error || !created.user) {
    const code = (error as { code?: string } | null)?.code ?? '';
    if (code === 'email_exists' || code === 'user_already_exists' || /already/i.test(error?.message ?? '')) {
      return reply(409, { error: 'email_taken' });
    }
    if (code === 'weak_password') return reply(400, { error: 'short_password' });
    console.error('[sign-up] createUser failed', code);
    return reply(500, { error: 'failed' });
  }

  const { error: decideError } = await admin.rpc('decide_family_invite', { p_invite_id: inviteId, p_status: 'approved' });
  if (decideError) console.error('[sign-up] decide_family_invite failed', decideError.code);
  return reply(200, { ok: true });
});

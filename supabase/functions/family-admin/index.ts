// family-admin · lets a family's admin (household owner) manage that family's logins from the app.
// Runs on Supabase with the service-role key from its own environment; that key never
// reaches the app, Vercel or git. Every action first checks the caller's JWT and role,
// and every query is limited to the caller's own household.
//
// People sign in with their email (docs/MULTI-FAMILY.md). The name the admin types when adding
// someone is what the app shows everywhere; the email is only for signing in.
import { createClient } from 'npm:@supabase/supabase-js@2';

const normalizeEmail = (e: string) => e.trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{0,29}$/; // same rule as 0007 / isEnglishName()

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

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Who is calling?
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: caller, error: callerError } = await admin.auth.getUser(jwt);
  if (callerError || !caller.user) return reply(401, { error: 'not_signed_in' });

  const { data: me } = await admin
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', caller.user.id)
    .maybeSingle();
  if (!me) return reply(403, { error: 'no_household' });
  const hid = me.household_id;
  // A family the operator suspended can't change anything either
  const { data: family } = await admin.from('households').select('status').eq('id', hid).maybeSingle();
  if (family?.status !== 'active') return reply(403, { error: 'suspended' });
  const isOwner = me.role === 'owner';

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'bad_json' });
  }

  // Everyone in the household may see the member list
  if (body.action === 'list') {
    const { data: rows } = await admin
      .from('household_members')
      .select('user_id, display_name, role')
      .eq('household_id', hid)
      .order('created_at');
    const members = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.user_id);
        return { userId: r.user_id, displayName: r.display_name, role: r.role, email: data.user?.email ?? '' };
      })
    );
    return reply(200, { members, isOwner, me: caller.user.id });
  }

  if (!isOwner) return reply(403, { error: 'owner_only' });

  const target = body.userId;
  const inHousehold = async (uid: string) => {
    const { data } = await admin.from('household_members').select('role').eq('household_id', hid).eq('user_id', uid).maybeSingle();
    return data;
  };

  switch (body.action) {
    case 'add_member': {
      const email = normalizeEmail(body.email ?? '');
      const displayName = (body.displayName ?? '').trim();
      const password = body.password ?? '';
      if (!NAME_RE.test(displayName)) return reply(400, { error: 'bad_name' });
      if (!EMAIL_RE.test(email)) return reply(400, { error: 'bad_email' });
      if (password.length < 6) return reply(400, { error: 'short_password' });
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { must_change_password: true },
      });
      if (error || !created.user) {
        const code = (error as { code?: string } | null)?.code ?? '';
        // Never say which family has that email: it may belong to someone else's family
        if (code === 'email_exists' || code === 'user_already_exists' || /already/i.test(error?.message ?? '')) {
          return reply(409, { error: 'email_taken' });
        }
        if (code === 'weak_password') return reply(400, { error: 'weak_password' });
        console.error('[family-admin] createUser failed', code);
        return reply(500, { error: 'add_failed' });
      }
      const { error: memberError } = await admin
        .from('household_members')
        .insert({ household_id: hid, user_id: created.user.id, display_name: displayName, role: 'member' });
      if (memberError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return reply(500, { error: 'add_failed' });
      }
      return reply(200, { ok: true });
    }
    case 'reset_password': {
      if (!target || !(await inHousehold(target))) return reply(404, { error: 'not_member' });
      if ((body.password ?? '').length < 6) return reply(400, { error: 'short_password' });
      const { error } = await admin.auth.admin.updateUserById(target, {
        password: body.password,
        user_metadata: { must_change_password: true },
      });
      return error ? reply(500, { error: 'reset_failed' }) : reply(200, { ok: true });
    }
    case 'remove_member': {
      if (!target || target === caller.user.id) return reply(400, { error: 'cannot_remove_self' });
      const row = await inHousehold(target);
      if (!row || row.role === 'owner') return reply(404, { error: 'not_member' });
      // Their past entries stay; they lose access at once and can no longer sign in
      await admin.from('household_members').delete().eq('household_id', hid).eq('user_id', target);
      await admin.auth.admin.updateUserById(target, { ban_duration: '876000h' });
      return reply(200, { ok: true });
    }
    case 'transfer_owner': {
      if (!target || target === caller.user.id || !(await inHousehold(target))) return reply(404, { error: 'not_member' });
      await admin.from('household_members').update({ role: 'owner' }).eq('household_id', hid).eq('user_id', target);
      await admin.from('household_members').update({ role: 'member' }).eq('household_id', hid).eq('user_id', caller.user.id);
      return reply(200, { ok: true });
    }
    default:
      return reply(400, { error: 'unknown_action' });
  }
});

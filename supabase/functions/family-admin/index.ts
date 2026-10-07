// family-admin · lets the household owner (Injy) manage family logins from the app.
// Runs on Supabase with the service-role key from its own environment; that key never
// reaches the app, Vercel or git. Every action first checks the caller's JWT and role.
import { createClient } from 'npm:@supabase/supabase-js@2';

const DOMAIN = 'family.local';
const usernameToEmail = (u: string) => `${u.trim().toLowerCase().replace(/\s+/g, '')}@${DOMAIN}`;
const emailToUsername = (e?: string | null) => (e ? e.slice(0, e.lastIndexOf('@')) : '');
const USERNAME_RE = /^[a-z0-9._-]{2,30}$/;
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
        return { userId: r.user_id, displayName: r.display_name, role: r.role, username: emailToUsername(data.user?.email) };
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
      const username = (body.username ?? '').trim().toLowerCase();
      const displayName = (body.displayName ?? '').trim();
      const password = body.password ?? '';
      if (!USERNAME_RE.test(username)) return reply(400, { error: 'bad_username' });
      if (!NAME_RE.test(displayName)) return reply(400, { error: 'bad_name' });
      if (password.length < 6) return reply(400, { error: 'short_password' });
      const { data: created, error } = await admin.auth.admin.createUser({
        email: usernameToEmail(username),
        password,
        email_confirm: true,
        user_metadata: { must_change_password: true },
      });
      if (error || !created.user) {
        const code = (error as { code?: string } | null)?.code ?? '';
        if (code === 'email_exists' || code === 'user_already_exists' || /already/i.test(error?.message ?? '')) {
          // Say who signs in with that name (a removed member keeps their login, so it can be nobody here)
          const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
          const holder = list?.users.find((u) => u.email === usernameToEmail(username));
          const { data: row } = holder
            ? await admin.from('household_members').select('display_name').eq('household_id', hid).eq('user_id', holder.id).maybeSingle()
            : { data: null };
          return reply(409, { error: row ? 'username_taken' : 'username_taken_removed', name: row?.display_name ?? '' });
        }
        if (code === 'weak_password') return reply(400, { error: 'weak_password' });
        console.error('[family-admin] createUser failed', code, error?.message);
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

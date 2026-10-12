// family-admin · lets a family's admin (household owner) manage that family's logins from the app.
// Runs on Supabase with the service-role key from its own environment; that key never
// reaches the app, Vercel or git.
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

const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// 24-hour invite codes. 'new_family' lets someone start their own family; 'member' lets someone join this one.
type InviteKind = 'new_family' | 'member';
const INVITE_HOURS = 24;

async function signInvite(kind: InviteKind, hid: string, exp: number): Promise<string> {
  const payload = `${kind}:${hid}:${exp}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${payload}.${hex.slice(0, 32)}`;
}

async function verifyInvite(kind: InviteKind, code: string): Promise<{ valid: boolean; expired?: boolean; hid?: string }> {
  const [payload, sig] = (code ?? '').split('.');
  if (!payload || !sig) return { valid: false };
  const parts = payload.split(':');
  if (parts.length !== 3 || parts[0] !== kind) return { valid: false };
  const [, hid, expStr] = parts;
  const exp = Number(expStr);
  if (!exp || isNaN(exp) || !/^[0-9a-f-]{36}$/i.test(hid)) return { valid: false };

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.slice(0, 32) !== sig) return { valid: false };

  if (Date.now() > exp) {
    return { valid: false, expired: true };
  }
  return { valid: true, hid };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'bad_json' });
  }

  // --- Public Unauthenticated Actions ---

  // When a recipient opens the join link: check code and get info to display
  if (body.action === 'get_invite_info') {
    const code = String(body.code ?? '');
    if (code.startsWith('new_family:')) {
      const result = await verifyInvite('new_family', code);
      if (result.expired) return reply(400, { error: 'invite_expired' });
      if (!result.valid) return reply(400, { error: 'invalid_code' });
      return reply(200, { valid: true, type: 'new_family' });
    }

    const member = await verifyInvite('member', code);
    if (member.expired) return reply(400, { error: 'invite_expired' });
    if (!member.valid || !member.hid) return reply(400, { error: 'invalid_code' });
    const hid = member.hid;
    const { data: family } = await admin.from('households').select('name, status').eq('id', hid).maybeSingle();
    if (!family || family.status !== 'active') return reply(403, { error: 'suspended' });
    return reply(200, { valid: true, type: 'join_member', familyName: family.name });
  }

  // Recipient creates an account to start their own family (via 24h invite link)
  if (body.action === 'start_family_by_invite') {
    const code = String(body.code ?? '');
    const result = await verifyInvite('new_family', code);
    if (result.expired) return reply(400, { error: 'invite_expired' });
    if (!result.valid) return reply(400, { error: 'invalid_code' });

    const email = normalizeEmail(body.email ?? '');
    const password = String(body.password ?? '');

    if (!EMAIL_RE.test(email)) return reply(400, { error: 'bad_email' });
    if (password.length < 6) return reply(400, { error: 'short_password' });

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { family_admin: true },
    });
    if (error || !created.user) {
      const errCode = (error as { code?: string } | null)?.code ?? '';
      if (errCode === 'email_exists' || errCode === 'user_already_exists' || /already/i.test(error?.message ?? '')) {
        return reply(409, { error: 'email_taken' });
      }
      if (errCode === 'weak_password') return reply(400, { error: 'weak_password' });
      console.error('[family-admin] start_family_by_invite createUser failed', errCode);
      return reply(500, { error: 'add_failed' });
    }
    return reply(200, { ok: true });
  }

  // Recipient joins existing household as a member
  if (body.action === 'join_by_link') {
    const member = await verifyInvite('member', String(body.code ?? ''));
    if (member.expired) return reply(400, { error: 'invite_expired' });
    if (!member.valid || !member.hid) return reply(400, { error: 'invalid_code' });
    const hid = member.hid;
    const { data: family } = await admin.from('households').select('status').eq('id', hid).maybeSingle();
    if (!family || family.status !== 'active') return reply(403, { error: 'suspended' });

    const displayName = (body.displayName ?? '').trim();
    const email = normalizeEmail(body.email ?? '');
    const password = String(body.password ?? '');

    if (!NAME_RE.test(displayName)) return reply(400, { error: 'bad_name' });
    if (!EMAIL_RE.test(email)) return reply(400, { error: 'bad_email' });
    if (password.length < 6) return reply(400, { error: 'short_password' });

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) {
      const code = (error as { code?: string } | null)?.code ?? '';
      if (code === 'email_exists' || code === 'user_already_exists' || /already/i.test(error?.message ?? '')) {
        return reply(409, { error: 'email_taken' });
      }
      if (code === 'weak_password') return reply(400, { error: 'weak_password' });
      console.error('[family-admin] join_by_link createUser failed', code);
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

  // --- Authenticated Actions (requires member in household) ---
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
  const { data: family } = await admin.from('households').select('name, status').eq('id', hid).maybeSingle();
  if (family?.status !== 'active') return reply(403, { error: 'suspended' });
  const isOwner = me.role === 'owner';

  // Generate 24-hour invite link for a brand new family
  if (body.action === 'create_family_invite_link') {
    const exp = Date.now() + INVITE_HOURS * 60 * 60 * 1000;
    const code = await signInvite('new_family', hid, exp);
    return reply(200, { ok: true, code, expiresAt: new Date(exp).toISOString() });
  }

  // The family admin makes a 24-hour link that lets someone join this family
  if (body.action === 'get_invite_link') {
    if (!isOwner) return reply(403, { error: 'owner_only' });
    const exp = Date.now() + INVITE_HOURS * 60 * 60 * 1000;
    const code = await signInvite('member', hid, exp);
    return reply(200, { ok: true, code, familyName: family.name, expiresAt: new Date(exp).toISOString() });
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

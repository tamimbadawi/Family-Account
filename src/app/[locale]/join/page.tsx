'use client';

import * as React from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencySelect } from '@/components/family/CurrencySelect';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';
import { getInviteInfo, joinByLink, startFamilyByInvite, FamilyAdminError } from '@/lib/auth/family-admin';
import { isEmail, normalizeEmail } from '@/lib/auth/email';
import { isEnglishName } from '@/lib/members';
import { DEFAULT_CURRENCY } from '@/lib/format';

/** Read the hash to determine which mode we are in */
function parseHash(hash: string): { mode: 'new_family' | 'member' | 'none'; code: string | null } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const invite = params.get('invite');
  const code = params.get('code') || params.get('t');
  if (invite) return { mode: 'new_family', code: invite };
  if (code) return { mode: 'member', code };
  return { mode: 'none', code: null };
}

/**
 * Where an invite link lands.
 *
 * - #invite=... → new family flow: recipient fills in Family Name, Name, Email, Password, Currency
 *                 to create their own household.
 * - #code=...   → member join flow: recipient fills Name, Email, Password to join an existing family.
 */
export default function JoinPage() {
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();

  // Shared fields
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Member-join specific
  const [familyName, setFamilyName] = React.useState<string>('');
  const [memberName, setMemberName] = React.useState('');

  // New-family specific
  const [householdName, setHouseholdName] = React.useState('');
  const [adminName, setAdminName] = React.useState('');
  const [mainCurrency, setMainCurrency] = React.useState(DEFAULT_CURRENCY);

  // Determined after hash parse + server check
  const [mode, setMode] = React.useState<'new_family' | 'member' | 'none' | 'loading'>('loading');
  const inviteCodeRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const { mode: m, code } = parseHash(window.location.hash);
    inviteCodeRef.current = code;

    if (m === 'none' || (!code && m !== 'none')) {
      // Resolved synchronously: no code or bad hash
      Promise.resolve().then(() => {
        setMode('none');
        setError(tAuth('joinExpired'));
      });
      return;
    }

    if (!isAuthConfigured()) {
      // Sample-data mode: just show the form
      Promise.resolve().then(() => setMode(m));
      return;
    }

    getInviteInfo(code!)
      .then((info) => {
        if (!info.valid) {
          setMode('none');
          setError(m === 'new_family' ? tAuth('startFamilyExpired') : tAuth('joinExpired'));
          return;
        }
        if (m === 'member' && info.familyName) setFamilyName(info.familyName);
        setMode(m);
      })
      .catch(() => {
        setMode('none');
        setError(tAuth('joinExpired'));
      });
  }, [tAuth]);

  // ---- NEW FAMILY SUBMIT ----
  const handleStartFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const trimmedHousehold = householdName.trim();
    const trimmedAdmin = adminName.trim();

    if (!trimmedHousehold) return setError(tAuth('householdName'));
    if (!trimmedAdmin || !isEnglishName(trimmedAdmin)) return setError(tAuth('nameEnglishOnly'));
    if (!isEmail(email)) return setError(tAuth('joinInvalidEmail'));
    if (password.length < 6) return setError(tAuth('joinPasswordShort'));

    if (!isAuthConfigured()) {
      router.push('/');
      return;
    }

    if (!inviteCodeRef.current) return setError(tAuth('startFamilyExpired'));

    setBusy(true);
    setError(null);
    try {
      // Step 1: provision the auth user (grants family_admin flag)
      await startFamilyByInvite({
        code: inviteCodeRef.current,
        email: normalizeEmail(email),
        password,
      });

      // Step 2: sign in
      const { data, error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (signInError || !data.user) {
        setError(navigator.onLine ? tAuth('wrongPassword') : tAuth('noConnection'));
        return;
      }

      // Step 3: create the household (the flag now passes the DB check)
      const { error: rpcError } = await getSupabaseBrowserClient().rpc('create_family', {
        p_name: trimmedHousehold,
        p_display_name: trimmedAdmin,
        p_locale: locale,
        p_currencies: [mainCurrency],
      });
      if (rpcError) throw new Error(rpcError.message);

      router.replace('/');
    } catch (err) {
      if (err instanceof FamilyAdminError) {
        if (err.message === 'invite_expired') {
          setError(tAuth('startFamilyExpired'));
        } else if (err.message === 'email_taken') {
          setError(tAuth('emailTaken'));
        } else if (err.message === 'short_password') {
          setError(tAuth('joinPasswordShort'));
        } else {
          setError(tAuth('signUpFailed'));
        }
      } else {
        setError(navigator.onLine ? tAuth('signUpFailed') : tAuth('noConnection'));
      }
    } finally {
      setBusy(false);
    }
  };

  // ---- MEMBER JOIN SUBMIT ----
  const handleJoinMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const trimmedName = memberName.trim();
    if (!trimmedName || !isEnglishName(trimmedName)) return setError(tAuth('nameEnglishOnly'));
    if (!isEmail(email)) return setError(tAuth('joinInvalidEmail'));
    if (password.length < 6) return setError(tAuth('joinPasswordShort'));

    if (!isAuthConfigured()) {
      router.push('/');
      return;
    }

    if (!inviteCodeRef.current) return setError(tAuth('joinExpired'));

    setBusy(true);
    setError(null);
    try {
      await joinByLink({
        code: inviteCodeRef.current,
        displayName: trimmedName,
        email: normalizeEmail(email),
        password,
      });

      const { data, error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (signInError || !data.user) {
        setError(navigator.onLine ? tAuth('wrongPassword') : tAuth('noConnection'));
        return;
      }

      router.replace('/');
    } catch (err) {
      if (err instanceof FamilyAdminError) {
        if (err.message === 'email_taken') {
          setError(tAuth('emailTaken'));
        } else if (err.message === 'invalid_code' || err.message === 'suspended') {
          setError(tAuth('joinExpired'));
        } else if (err.message === 'bad_name') {
          setError(tAuth('nameEnglishOnly'));
        } else if (err.message === 'short_password') {
          setError(tAuth('joinPasswordShort'));
        } else {
          setError(tAuth('signUpFailed'));
        }
      } else {
        setError(navigator.onLine ? tAuth('signUpFailed') : tAuth('noConnection'));
      }
    } finally {
      setBusy(false);
    }
  };

  const passwordInput = (
    <div>
      <label className="mb-1.5 block text-caption font-medium text-ink-muted">{tAuth('password')}</label>
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={tAuth('password')}
          autoComplete="new-password"
          required
          className="h-14 bg-surface pe-12 text-body shadow-xs"
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute inset-y-0 end-0 flex items-center px-4 text-ink-muted hover:text-ink transition-colors"
          aria-label={showPassword ? tAuth('hidePassword') : tAuth('showPassword')}
        >
          {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
    </div>
  );

  const emailInput = (
    <div>
      <label className="mb-1.5 block text-caption font-medium text-ink-muted">{tAuth('email')}</label>
      <Input
        type="email"
        inputMode="email"
        dir="ltr"
        value={email}
        onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
        placeholder={tAuth('emailPlaceholder')}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="email"
        spellCheck={false}
        required
        className="h-14 bg-surface text-body shadow-xs"
      />
    </div>
  );

  const shell = (title: string, subtitle: string, form: React.ReactNode) => (
    <div className="mx-auto flex h-dvh max-w-[520px] flex-col justify-between overflow-hidden bg-canvas px-6 pt-[max(env(safe-area-inset-top,0px),1.5rem)] pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] text-ink select-none">
      <div className="flex flex-col items-center text-center mt-2">
        <div className="relative size-20 overflow-hidden rounded-[22px] bg-surface shadow-card">
          <Image src="/icons/icon-1024.png" alt={tAuth('appName')} width={80} height={80} priority className="size-full object-cover" />
        </div>
        <h1 className="mt-4 text-title font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-caption text-ink-muted">{subtitle}</p>
      </div>
      {form}
      <div />
    </div>
  );

  // Loading / error state
  if (mode === 'loading' || mode === 'none') {
    return shell(
      tAuth('appName'),
      '',
      <div className="w-full my-auto max-w-sm mx-auto space-y-4">
        {error && <p role="alert" className="text-body font-medium text-danger text-center">{error}</p>}
      </div>
    );
  }

  // ---- NEW FAMILY FORM ----
  if (mode === 'new_family') {
    return shell(
      tAuth('startFamilyTitle'),
      tAuth('startFamilySubtitle'),
      <form onSubmit={handleStartFamily} className="w-full space-y-3.5 my-auto max-w-sm mx-auto overflow-y-auto">
        <div>
          <label className="mb-1.5 block text-caption font-medium text-ink-muted">{tAuth('startFamilyHouseholdName')}</label>
          <Input
            type="text"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder={tAuth('startFamilyHouseholdPlaceholder')}
            required
            className="h-14 bg-surface text-body shadow-xs"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-caption font-medium text-ink-muted">{tAuth('yourName')}</label>
          <Input
            type="text"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder={tAuth('namePlaceholder')}
            autoFocus
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            required
            className="h-14 bg-surface text-body shadow-xs"
          />
          <p className="mt-1 text-caption text-ink-muted">{tAuth('nameEnglishOnly')}</p>
        </div>

        {emailInput}
        {passwordInput}

        <div>
          <label className="mb-1.5 block text-caption font-medium text-ink-muted">{tAuth('currencies')}</label>
          <CurrencySelect value={mainCurrency} onChange={setMainCurrency} />
          <p className="mt-1 text-caption text-ink-muted">{tAuth('currenciesHint')}</p>
        </div>

        {error && <p role="alert" className="text-body font-medium text-danger">{error}</p>}

        <Button type="submit" disabled={busy} className="h-14 w-full text-heading font-semibold mt-2 text-accent-ink">
          {tAuth('startFamilyContinue')}
        </Button>
      </form>
    );
  }

  // ---- MEMBER JOIN FORM ----
  return shell(
    tAuth('joinTitle', { family: familyName || tAuth('appName') }),
    tAuth('joinSubtitle'),
    <form onSubmit={handleJoinMember} className="w-full space-y-3.5 my-auto max-w-sm mx-auto">
      <div>
        <label className="mb-1.5 block text-caption font-medium text-ink-muted">{tAuth('yourName')}</label>
        <Input
          type="text"
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          placeholder={tAuth('namePlaceholder')}
          autoFocus
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          required
          className="h-14 bg-surface text-body shadow-xs"
        />
        <p className="mt-1 text-caption text-ink-muted">{tAuth('nameEnglishOnly')}</p>
      </div>

      {emailInput}
      {passwordInput}

      {error && <p role="alert" className="text-body font-medium text-danger">{error}</p>}

      <Button type="submit" disabled={busy} className="h-14 w-full text-heading font-semibold mt-2 text-accent-ink">
        {tAuth('joinContinue')}
      </Button>
    </form>
  );
}

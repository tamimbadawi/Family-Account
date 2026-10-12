'use client';

import * as React from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Eye, EyeOff, Smartphone } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';
import { toLoginEmail } from '@/lib/auth/email';
import { routeAfterSignIn } from '@/lib/auth/after-sign-in';
import {
  signInLocal,
  registerLocalUser,
  findInviteByEmail,
} from '@/lib/auth/local-auth';

function LoginForm() {
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();

  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [familyName, setFamilyName] = React.useState('');
  const [age, setAge] = React.useState('');
  const [householdsCount, setHouseholdsCount] = React.useState('1');
  const [showPassword, setShowPassword] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Prepopulate email and set mode if email param is present in URL
  React.useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      setMode('signup');

      if (!isAuthConfigured()) {
        const check = findInviteByEmail(emailParam);
        if (check.valid && check.invite?.invitedName) {
          setFamilyName(check.invite.invitedName);
        }
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    // Local sample-data mode
    if (!isAuthConfigured()) {
      if (mode === 'signup') {
        const cleanEmail = email.trim();
        if (!cleanEmail) {
          setError(tAuth('email'));
          return;
        }

        if (!familyName.trim()) {
          setError(tAuth('familyName'));
          return;
        }

        if (password.length < 6) {
          setError(tAuth('passwordTooShort'));
          return;
        }

        if (password !== confirmPassword) {
          setError(tAuth('passwordsDontMatch'));
          return;
        }

        setBusy(true);
        setError(null);

        try {
          const user = await registerLocalUser({
            email: cleanEmail,
            password,
            familyName: familyName.trim(),
            age: age ? parseInt(age, 10) : undefined,
            householdsCount: householdsCount ? parseInt(householdsCount, 10) : 1,
          });
          signInLocal(user.email, password);
          window.location.href = `/${locale}`;
          return;
        } catch (err: any) {
          const msg = err instanceof Error ? err.message : '';
          if (msg === 'email_not_invited') setError(tAuth('emailNotInvited'));
          else if (msg === 'invite_already_used') setError(tAuth('inviteAlreadyUsed'));
          else if (msg === 'email_taken') setError('That email is already registered');
          else if (msg === 'short_password') setError(tAuth('passwordTooShort'));
          else setError(tAuth('emailNotInvited'));
          setBusy(false);
          return;
        }
      } else {
        const res = signInLocal(email, password);
        if (!res.success) {
          setError(tAuth('wrongPassword'));
          return;
        }
        window.location.href = `/${locale}`;
        return;
      }
    }

    // Live mode (Supabase)
    if (mode === 'signup') {
      if (!familyName.trim()) {
        setError(tAuth('familyName'));
        return;
      }
      if (password.length < 6) {
        setError(tAuth('passwordTooShort'));
        return;
      }
      if (password !== confirmPassword) {
        setError(tAuth('passwordsDontMatch'));
        return;
      }
    }

    setBusy(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: toLoginEmail(email),
          password,
          options: {
            data: {
              family_name: familyName.trim(),
              age: age ? parseInt(age, 10) : null,
              households_count: householdsCount ? parseInt(householdsCount, 10) : 1,
            },
          },
        });

        if (signUpError || !data.user) {
          setError(signUpError?.message || (navigator.onLine ? tAuth('wrongPassword') : tAuth('noConnection')));
          return;
        }

        // Auto sign in if session is not immediately established
        if (!data.session) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: toLoginEmail(email),
            password,
          });
          if (signInData?.user) {
            router.replace(await routeAfterSignIn(signInData.user));
            return;
          }
        }

        router.replace(await routeAfterSignIn(data.user));
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: toLoginEmail(email),
          password,
        });
        if (signInError || !data.user) {
          setError(navigator.onLine ? tAuth('wrongPassword') : tAuth('noConnection'));
          return;
        }
        router.replace(await routeAfterSignIn(data.user));
      }
    } catch {
      setError(tAuth('noConnection'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-[420px] flex-col justify-between overflow-hidden bg-canvas px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-[max(env(safe-area-inset-bottom,0px),1rem)] text-ink select-none">
      {/* App Header: Same font size and layout across all tabs */}
      <div className="flex flex-col items-center text-center shrink-0">
        <div className="relative size-14 overflow-hidden rounded-[18px] shadow-card bg-surface">
          <Image
            src="/icons/icon-1024.png"
            alt={tAuth('appName')}
            width={56}
            height={56}
            priority
            className="size-full object-cover"
          />
        </div>
        <h1 className="mt-2.5 text-title font-bold tracking-tight text-ink">
          {tAuth('appName')}
        </h1>
        <p className="mt-0.5 text-caption text-ink-muted">
          {mode === 'signup' ? tAuth('inviteRequired') : tAuth('loginSubtitle')}
        </p>
      </div>

      {/* Main Form Area */}
      <form onSubmit={handleSubmit} className="w-full space-y-2.5 my-auto max-w-sm mx-auto shrink-0">
        {/* Main Mode Tabs: Existing Account vs New Sign-in */}
        <div className="flex rounded-full bg-surface-2 p-1 text-caption font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`flex-1 min-h-[44px] rounded-full py-2.5 transition-all text-center truncate px-2 flex items-center justify-center text-caption font-semibold ${
              mode === 'signin'
                ? 'bg-surface text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {tAuth('existingSignIn')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`flex-1 min-h-[44px] rounded-full py-2.5 transition-all text-center truncate px-2 flex items-center justify-center text-caption font-semibold ${
              mode === 'signup'
                ? 'bg-surface text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {tAuth('newSignIn')}
          </button>
        </div>

        {mode === 'signup' ? (
          <>
            {/* Email Input */}
            <div>
              <label htmlFor="login-email" className="mb-1 block text-caption font-medium text-ink-muted">
                {tAuth('email')}
              </label>
              <Input
                id="login-email"
                type="text"
                inputMode="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                placeholder={tAuth('emailPlaceholder')}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                spellCheck={false}
                required
                className="h-11 bg-surface text-body shadow-xs rounded-xl"
              />
            </div>

            {/* Family Name */}
            <div>
              <label htmlFor="register-family-name" className="mb-1 block text-caption font-medium text-ink-muted">
                {tAuth('familyName')}
              </label>
              <Input
                id="register-family-name"
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder={tAuth('familyNamePlaceholder')}
                required
                className="h-11 bg-surface text-body shadow-xs rounded-xl"
              />
            </div>

            {/* Age & Number of households (Grid 2 cols) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="register-age" className="mb-1 block text-caption font-medium text-ink-muted">
                  {tAuth('age')}
                </label>
                <Input
                  id="register-age"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder={tAuth('agePlaceholder')}
                  className="h-11 bg-surface text-body shadow-xs rounded-xl"
                />
              </div>

              <div>
                <label htmlFor="register-households-count" className="mb-1 block text-caption font-medium text-ink-muted">
                  {tAuth('householdsCount')}
                </label>
                <Input
                  id="register-households-count"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="20"
                  value={householdsCount}
                  onChange={(e) => setHouseholdsCount(e.target.value)}
                  placeholder={tAuth('householdsCountPlaceholder')}
                  className="h-11 bg-surface text-body shadow-xs rounded-xl"
                />
              </div>
            </div>

            {/* Password & Confirm Password (Grid 2 cols) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="login-password" className="mb-1 block text-caption font-medium text-ink-muted">
                  {tAuth('password')}
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={tAuth('password')}
                    autoComplete="new-password"
                    required
                    className="h-11 bg-surface pe-9 text-body shadow-xs rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute inset-y-0 end-0 flex items-center px-2.5 text-ink-muted hover:text-ink transition-colors"
                    aria-label={showPassword ? tAuth('hidePassword') : tAuth('showPassword')}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="login-confirm-password" className="mb-1 block text-caption font-medium text-ink-muted">
                  {tAuth('confirmPassword')}
                </label>
                <Input
                  id="login-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={tAuth('confirmPassword')}
                  autoComplete="new-password"
                  required
                  className="h-11 bg-surface text-body shadow-xs rounded-xl"
                />
              </div>
            </div>
          </>
        ) : (
          /* Sign In Fields */
          <>
            <div>
              <label htmlFor="login-email" className="mb-1 block text-caption font-medium text-ink-muted">
                {tAuth('email')}
              </label>
              <Input
                id="login-email"
                type="text"
                inputMode="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                placeholder={tAuth('emailPlaceholder')}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                spellCheck={false}
                required
                className="h-12 bg-surface text-body shadow-xs rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1 block text-caption font-medium text-ink-muted">
                {tAuth('password')}
              </label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tAuth('password')}
                  autoComplete="current-password"
                  required
                  className="h-12 bg-surface pe-12 text-body shadow-xs rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute inset-y-0 end-0 flex items-center px-4 text-ink-muted hover:text-ink transition-colors min-h-[44px] min-w-[44px]"
                  aria-label={showPassword ? tAuth('hidePassword') : tAuth('showPassword')}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-caption font-medium text-danger text-center">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="h-12 w-full text-heading font-semibold mt-2 text-accent-ink rounded-xl shadow-xs"
        >
          {mode === 'signup' ? tAuth('signUp') : tAuth('signIn')}
        </Button>
      </form>

      {/* Bottom Install App Link */}
      <div className="flex flex-col items-center gap-1 pb-1 text-center shrink-0">
        <Link
          href="/install"
          className="inline-flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-caption font-semibold text-accent hover:underline transition-colors"
        >
          <Smartphone className="size-4" />
          <span>{tAuth('howToInstall')}</span>
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

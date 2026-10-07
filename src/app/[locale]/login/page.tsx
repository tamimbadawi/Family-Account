'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Smartphone } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InstallBanner } from '@/components/install/InstallBanner';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';
import { normalizeEmail } from '@/lib/auth/email';
import { routeAfterSignIn } from '@/lib/auth/after-sign-in';

export default function LoginPage() {
  const tAuth = useTranslations('auth');
  const router = useRouter();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    // Local sample-data mode (no Supabase configured): any input goes straight in
    if (!isAuthConfigured()) {
      router.push('/');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (signInError || !data.user) {
        setError(navigator.onLine ? tAuth('wrongPassword') : tAuth('noConnection'));
        return;
      }
      router.replace(await routeAfterSignIn(data.user));
    } catch {
      setError(tAuth('noConnection'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-dvh max-w-[520px] flex-col justify-between overflow-hidden bg-canvas px-6 pt-[max(env(safe-area-inset-top,0px),1.5rem)] pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] text-ink select-none">
      <div>
        <InstallBanner />
      </div>

      <div className="flex flex-col items-center text-center mt-2">
        <div className="relative size-24 overflow-hidden rounded-[22px] shadow-card bg-surface">
          <Image
            src="/icons/icon-1024.png"
            alt={tAuth('appName')}
            width={96}
            height={96}
            priority
            className="size-full object-cover"
          />
        </div>
        <h1 className="mt-4 text-title font-bold tracking-tight text-ink">
          {tAuth('appName')}
        </h1>
        <p className="mt-1 text-caption text-ink-muted">
          {tAuth('loginSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-3.5 my-auto max-w-sm mx-auto">
        <div>
          <label className="mb-1.5 block text-caption font-medium text-ink-muted">
            {tAuth('email')}
          </label>
          <Input
            type="email"
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
            className="h-14 bg-surface text-body shadow-xs"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-caption font-medium text-ink-muted">
            {tAuth('password')}
          </label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tAuth('password')}
              autoComplete="current-password"
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

        {error && (
          <p role="alert" className="text-body font-medium text-danger">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} className="h-14 w-full text-heading font-semibold mt-2 text-accent-ink">
          {tAuth('signIn')}
        </Button>
      </form>

      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <Link
          href="/install"
          className="inline-flex items-center gap-1.5 text-caption font-semibold text-accent hover:underline transition-colors"
        >
          <Smartphone className="size-4" />
          <span>{tAuth('howToInstall')}</span>
        </Link>
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';
import { routeAfterSignIn } from '@/lib/auth/after-sign-in';
import { joinToken } from '@/lib/auth/invite';

/**
 * Where a personal invite link lands. The one-time token is only used when the person taps Continue,
 * so a link preview (WhatsApp, Messages) opening the page can never use it up.
 */
export default function JoinPage() {
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const accept = async () => {
    if (busy) return;
    // Local sample-data mode (no Supabase configured): straight in, as on the sign-in page
    if (!isAuthConfigured()) {
      router.push('/');
      return;
    }
    const token = joinToken(window.location.hash);
    if (!token) return setError(tAuth('joinExpired'));
    setBusy(true);
    setError(null);
    try {
      const { data, error: verifyError } = await getSupabaseBrowserClient().auth.verifyOtp({
        token_hash: token,
        type: 'magiclink',
      });
      if (verifyError || !data.user) {
        setError(navigator.onLine ? tAuth('joinExpired') : tAuth('noConnection'));
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
    <div className="mx-auto flex h-dvh max-w-[520px] flex-col overflow-hidden bg-canvas px-6 pt-[max(env(safe-area-inset-top,0px),1.5rem)] pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] text-ink select-none">
      <div className="my-auto flex flex-col items-center text-center">
        <div className="relative size-24 overflow-hidden rounded-[22px] bg-surface shadow-card">
          <Image
            src="/icons/icon-1024.png"
            alt={tAuth('appName')}
            width={96}
            height={96}
            priority
            className="size-full object-cover"
          />
        </div>
        <h1 className="mt-6 text-title font-bold tracking-tight text-ink">{tAuth('joinTitle')}</h1>
        <p className="mt-2 text-body text-ink-muted">{tAuth('joinSubtitle')}</p>
        {error && (
          <p role="alert" className="mt-4 text-body font-medium text-danger">
            {error}
          </p>
        )}
      </div>
      <Button
        onClick={accept}
        disabled={busy}
        className="mx-auto h-14 w-full max-w-sm text-heading font-semibold text-accent-ink"
      >
        {tAuth('joinContinue')}
      </Button>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { routeAfterSignIn } from '@/lib/auth/after-sign-in';

const MIN_LENGTH = 6;

/** First sign-in with a temporary password: the person picks their own, so nobody else ever knows it. */
export default function ChoosePasswordPage() {
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [repeat, setRepeat] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < MIN_LENGTH) return setError(tAuth('passwordTooShort'));
    if (password !== repeat) return setError(tAuth('passwordsDontMatch'));
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: updateError } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      });
      if (updateError || !data.user) {
        setError(tAuth('noConnection'));
        return;
      }
      router.replace(await routeAfterSignIn(data.user));
    } catch {
      setError(tAuth('noConnection'));
    } finally {
      setBusy(false);
    }
  };

  const field = (value: string, onChange: (v: string) => void, label: string, autoComplete: string) => (
    <div>
      <label className="mb-1.5 block text-caption font-medium text-ink-muted">{label}</label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          aria-label={label}
          autoComplete={autoComplete}
          required
          className="h-14 bg-surface pe-12 text-body shadow-xs"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 end-0 flex items-center px-4 text-ink-muted hover:text-ink transition-colors"
          aria-label={show ? tAuth('hidePassword') : tAuth('showPassword')}
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex h-dvh max-w-[520px] flex-col overflow-hidden bg-canvas px-6 pt-[max(env(safe-area-inset-top,0px),1.5rem)] pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] text-ink select-none">
      <div className="mt-8 text-center">
        <h1 className="text-title font-bold tracking-tight text-ink">{tAuth('chooseTitle')}</h1>
        <p className="mt-2 text-body text-ink-muted">{tAuth('chooseSubtitle')}</p>
      </div>
      <form onSubmit={handleSubmit} className="mx-auto my-auto w-full max-w-sm space-y-3.5">
        {field(password, setPassword, tAuth('newPassword'), 'new-password')}
        {field(repeat, setRepeat, tAuth('repeatPassword'), 'new-password')}
        {error && (
          <p role="alert" className="text-body font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="mt-2 h-14 w-full text-heading font-semibold text-accent-ink">
          {tAuth('savePassword')}
        </Button>
      </form>
    </div>
  );
}

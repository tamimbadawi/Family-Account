'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, KeyRound, Pause, Play, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { isAuthConfigured } from '@/lib/supabase/client';
import { FamilyAdminError } from '@/lib/auth/family-admin';
import { isEmail, normalizeEmail } from '@/lib/auth/email';
import { operator, type OperatorFamily, type WaitingFamily } from '@/lib/auth/operator';
import { formatDay } from '@/lib/format';

type Sheet = { kind: 'new' } | { kind: 'reset'; family: OperatorFamily } | { kind: 'status'; family: OperatorFamily } | null;

const ACTION =
  'flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted transition-transform active:scale-95 cursor-pointer';

/**
 * /operator · for the person who runs the app (OPERATOR_EMAILS in the `operator` Edge Function).
 * Start a new family by setting its admin's email and a first password, see every family as counts
 * only, pause a family, or reset a family admin's password. Never shows amounts or entries.
 */
export default function OperatorPage() {
  const t = useTranslations('operator');
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const live = isAuthConfigured();

  const [families, setFamilies] = React.useState<OperatorFamily[] | null>(null);
  const [waiting, setWaiting] = React.useState<WaitingFamily[]>([]);
  const [familyName, setFamilyName] = React.useState('');
  const [denied, setDenied] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [sheet, setSheet] = React.useState<Sheet>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!live) return;
    let cancelled = false;
    operator<{ families: OperatorFamily[]; waiting: WaitingFamily[] }>({ action: 'list' })
      .then((result) => {
        if (cancelled) return;
        setFamilies(result.families);
        setWaiting(result.waiting ?? []);
        setLoadFailed(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof FamilyAdminError && err.message === 'not_operator') setDenied(true);
        else setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [live, attempt]);

  const open = (next: Sheet) => {
    setError(null);
    setFamilyName('');
    setEmail('');
    setPassword('');
    setSheet(next);
  };

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setSheet(null);
      toast.success(done);
      setAttempt((a) => a + 1);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'failed';
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.failed'));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!sheet || busy) return;
    if (sheet.kind === 'new') {
      if (!familyName.trim()) return setError(t('errors.no_family_name'));
      if (!isEmail(email)) return setError(t('errors.bad_email'));
      if (password.length < 6) return setError(t('errors.short_password'));
      void run(
        () => operator({ action: 'create_family_admin', familyName: familyName.trim(), email: normalizeEmail(email), password }),
        t('created', { name: familyName.trim() })
      );
    } else if (sheet.kind === 'reset') {
      if (password.length < 6) return setError(t('errors.short_password'));
      void run(
        () => operator({ action: 'reset_admin_password', householdId: sheet.family.householdId, password }),
        t('resetDone')
      );
    } else {
      const status = sheet.family.status === 'active' ? 'suspended' : 'active';
      void run(
        () => operator({ action: 'set_status', householdId: sheet.family.householdId, status }),
        status === 'active' ? t('resumed') : t('paused')
      );
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
      <div className="flex shrink-0 items-center gap-2 border-b border-line/30 px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 select-none">
        <Link
          href="/settings"
          className="-ms-2 flex size-11 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-surface-2"
          aria-label={tSettings('back')}
        >
          <ChevronLeft className="size-6 rtl:rotate-180" />
        </Link>
        <h1 className="truncate text-title font-bold text-ink">{t('title')}</h1>
      </div>

      <div className="flex-1 space-y-4 px-5 py-4 pb-24">
        {!live || denied ? (
          <p className="text-body text-ink-muted">{live ? t('denied') : t('liveOnly')}</p>
        ) : (
          <>
            <p className="text-body text-ink-muted">{t('hint')}</p>

            <Button onClick={() => open({ kind: 'new' })} className="h-14 w-full gap-2 text-heading font-semibold text-accent-ink">
              <Plus className="size-5" />
              {t('newFamily')}
            </Button>

            {loadFailed && !families ? (
              <div className="space-y-3 rounded-card border border-line/40 bg-surface p-4 text-center shadow-card">
                <p className="text-body text-ink">{t('loadFailed')}</p>
                <Button variant="outline" onClick={() => setAttempt((a) => a + 1)} className="h-12 w-full text-body font-semibold">
                  {t('tryAgain')}
                </Button>
              </div>
            ) : !families ? (
              <Skeleton className="h-24 w-full rounded-card" />
            ) : families.length === 0 && waiting.length === 0 ? (
              <p className="text-body text-ink-muted">{t('empty')}</p>
            ) : (
              <>
              {waiting.map((w) => (
                <div key={w.email} className="space-y-1 rounded-card border border-dashed border-line bg-surface p-4">
                  <p className="truncate text-body font-semibold text-ink">{w.familyName || t('unnamed')}</p>
                  <p dir="ltr" className="truncate text-caption text-ink-muted text-start">
                    {w.email}
                  </p>
                  <p className="text-caption text-ink-muted">{t('waiting')}</p>
                </div>
              ))}
              {
              families.map((f) => (
                <div key={f.householdId} className="space-y-1 rounded-card border border-line/40 bg-surface p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold text-ink">{f.name}</p>
                      <p dir="ltr" className="truncate text-caption text-ink-muted text-start">
                        {f.adminEmail}
                      </p>
                    </div>
                    <button type="button" aria-label={t('resetPassword')} className={ACTION} onClick={() => open({ kind: 'reset', family: f })}>
                      <KeyRound className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={f.status === 'active' ? t('pause') : t('resume')}
                      className={`${ACTION} ${f.status === 'active' ? 'text-danger' : 'text-income'}`}
                      onClick={() => open({ kind: 'status', family: f })}
                    >
                      {f.status === 'active' ? <Pause className="size-5" /> : <Play className="size-5" />}
                    </button>
                  </div>
                  <p className="text-caption text-ink-muted tabular-nums">
                    {t('counts', { members: f.members, wallets: f.wallets, entries: f.entries })} · {f.currencies.join(' + ')}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {f.status === 'suspended' && <span className="font-semibold text-danger">{t('pausedLabel')} · </span>}
                    {f.lastEntryAt ? t('lastEntry', { date: formatDay(f.lastEntryAt.slice(0, 10), locale) }) : t('noEntries')}
                  </p>
                </div>
              ))}
              </>
            )}
          </>
        )}
      </div>

      <Drawer open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <DrawerContent className="max-h-[96dvh]">
          <div className="min-h-0 overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-0 pt-1 pb-2">
              <DrawerTitle className="text-title font-bold text-ink">
                {sheet?.kind === 'new' && t('newFamily')}
                {sheet?.kind === 'reset' && t('resetFor', { name: sheet.family.name })}
                {sheet?.kind === 'status' &&
                  (sheet.family.status === 'active' ? t('pauseFor', { name: sheet.family.name }) : t('resumeFor', { name: sheet.family.name }))}
              </DrawerTitle>
            </DrawerHeader>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {sheet?.kind === 'new' && (
                <>
                  <Input
                    aria-label={t('familyName')}
                    placeholder={t('familyName')}
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    autoCapitalize="words"
                    className="h-14 bg-surface-2 text-body"
                  />
                  <Input
                    type="email"
                    inputMode="email"
                    dir="ltr"
                    aria-label={t('adminEmail')}
                    placeholder={t('adminEmail')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    className="h-14 bg-surface-2 text-body"
                  />
                  <p className="text-caption text-ink-muted">{t('newHint')}</p>
                </>
              )}
              {(sheet?.kind === 'new' || sheet?.kind === 'reset') && (
                <>
                  <Input
                    aria-label={t('password')}
                    placeholder={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    className="h-14 bg-surface-2 text-body"
                  />
                  <p className="text-caption text-ink-muted">{t('passwordHint')}</p>
                </>
              )}
              {sheet?.kind === 'status' && (
                <p className="text-body text-ink-muted">{sheet.family.status === 'active' ? t('pauseHint') : t('resumeHint')}</p>
              )}

              {error && (
                <p role="alert" className="text-body font-medium text-danger">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={busy}
                className={`h-14 w-full text-heading font-semibold text-accent-ink ${
                  sheet?.kind === 'status' && sheet.family.status === 'active' ? 'bg-danger' : ''
                }`}
              >
                {sheet?.kind === 'new' && t('create')}
                {sheet?.kind === 'reset' && t('resetPassword')}
                {sheet?.kind === 'status' && (sheet.family.status === 'active' ? t('pause') : t('resume'))}
              </Button>
            </form>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

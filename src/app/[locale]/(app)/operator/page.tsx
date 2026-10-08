'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronLeft, KeyRound, Pause, Play, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useRestoreSheetAfterKeyboard } from '@/components/settings/useRestoreSheetAfterKeyboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { isAuthConfigured } from '@/lib/supabase/client';
import { FamilyAdminError } from '@/lib/auth/family-admin';
import { isEmail, normalizeEmail } from '@/lib/auth/email';
import {
  operator,
  type FamilyRequest,
  type OperatorFamily,
  type SupportInboxMessage,
  type WaitingFamily,
} from '@/lib/auth/operator';
import { inviteLink, sendInvite } from '@/lib/auth/invite';
import { formatDay } from '@/lib/format';

type Sheet =
  | { kind: 'new'; request?: FamilyRequest }
  | { kind: 'decline'; request: FamilyRequest }
  | { kind: 'reset'; family: OperatorFamily } | { kind: 'status'; family: OperatorFamily } | null;

const ACTION =
  'flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted transition-transform active:scale-95 cursor-pointer';

/**
 * /operator · for the person who runs the app (OPERATOR_EMAILS in the `operator` Edge Function).
 * Start a new family by setting its admin's email and a first password, see every family as counts
 * only, pause a family, or reset a family admin's password. Never shows amounts or entries.
 * Messages sent from Settings → Contact support wait at the top until marked done.
 */
export default function OperatorPage() {
  const t = useTranslations('operator');
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const live = isAuthConfigured();

  const [families, setFamilies] = React.useState<OperatorFamily[] | null>(null);
  const [waiting, setWaiting] = React.useState<(WaitingFamily & { hoursLeft?: number })[]>([]);
  const [requests, setRequests] = React.useState<FamilyRequest[]>([]);
  const [support, setSupport] = React.useState<SupportInboxMessage[]>([]);
  const [closing, setClosing] = React.useState<string | null>(null);
  const [familyName, setFamilyName] = React.useState('');
  const [denied, setDenied] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [sheet, setSheet] = React.useState<Sheet>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  useRestoreSheetAfterKeyboard(sheetRef, sheet !== null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!live) return;
    let cancelled = false;
    operator<{
      families: OperatorFamily[];
      waiting: WaitingFamily[];
      requests?: FamilyRequest[];
      support?: SupportInboxMessage[];
    }>({ action: 'list' })
      .then((result) => {
        if (cancelled) return;
        setFamilies(result.families);
        // Hours until an unused login is deleted, worked out once per load
        const now = Date.now();
        setWaiting(
          (result.waiting ?? []).map((w) => ({
            ...w,
            hoursLeft: w.expiresAt
              ? Math.max(1, Math.ceil((new Date(w.expiresAt).getTime() - now) / 3_600_000))
              : undefined,
          }))
        );
        setRequests(result.requests ?? []);
        setSupport(result.support ?? []);
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

  const run = async (
    work: () => Promise<unknown>,
    done: string,
    action?: { label: string; onClick: () => void }
  ) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setSheet(null);
      toast.success(done, action && { action, duration: 10000 });
      setAttempt((a) => a + 1);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'failed';
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.failed'));
    } finally {
      setBusy(false);
    }
  };

  /** Closes a support message straight away; it leaves the list without a reload. */
  const markDone = async (m: SupportInboxMessage) => {
    setClosing(m.id);
    try {
      await operator({ action: 'support_done', messageId: m.id });
      setSupport((prev) => prev.filter((x) => x.id !== m.id));
      toast.success(t('supportDone'));
    } catch {
      toast.error(t('errors.failed'));
    } finally {
      setClosing(null);
    }
  };

  const submit = () => {
    if (!sheet || busy) return;
    if (sheet.kind === 'new') {
      if (!familyName.trim()) return setError(t('errors.no_family_name'));
      if (!isEmail(email)) return setError(t('errors.bad_email'));
      if (password.length < 6) return setError(t('errors.short_password'));
      const login = { email: normalizeEmail(email), password };
      void run(
        () =>
          operator({
            action: 'create_family_admin',
            familyName: familyName.trim(),
            ...login,
            ...(sheet.request && { inviteId: sheet.request.inviteId }),
          }),
        t('created', { name: familyName.trim() }),
        // Send the new admin their sign-in details straight away
        {
          label: t('sendLogin'),
          onClick: () =>
            void sendInvite(t('loginTitle'), t('loginText', login), inviteLink(window.location.origin, locale)).then((r) => {
              if (r === 'copied') toast.success(t('loginCopied'));
            }),
        }
      );
    } else if (sheet.kind === 'decline') {
      void run(() => operator({ action: 'decline_invite', inviteId: sheet.request.inviteId }), t('declined'));
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
            ) : families.length === 0 && waiting.length === 0 && requests.length === 0 && support.length === 0 ? (
              <p className="text-body text-ink-muted">{t('empty')}</p>
            ) : (
              <>
              {support.length > 0 && <h2 className="text-heading font-semibold text-ink">{t('supportTitle')}</h2>}
              {support.map((m) => (
                <div key={m.id} className="space-y-2 rounded-card border border-accent/40 bg-surface p-4 shadow-card">
                  <div className="min-w-0">
                    <p className="truncate text-body font-semibold text-ink">
                      {m.sender ? t('supportFrom', { name: m.sender, family: m.family }) : m.family}
                    </p>
                    <p className="text-caption text-ink-muted">
                      {m.section && tSettings.has(`supportSection.${m.section}`) && (
                        <>{tSettings(`supportSection.${m.section}`)} · </>
                      )}
                      {formatDay(m.createdAt.slice(0, 10), locale)}
                    </p>
                  </div>
                  {m.message && (
                    <p dir="auto" className="whitespace-pre-wrap break-words text-body text-ink">
                      {m.message}
                    </p>
                  )}
                  {m.photoUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {m.photoUrls.map((url, i) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t('supportPhoto', { n: i + 1 })}
                          className="size-20 overflow-hidden rounded-2xl bg-surface-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage link */}
                          <img src={url} alt="" className="size-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    disabled={closing === m.id}
                    onClick={() => void markDone(m)}
                    className="h-12 w-full gap-2 text-body font-semibold"
                  >
                    <Check className="size-5" />
                    {t('supportMarkDone')}
                  </Button>
                </div>
              ))}
              {requests.length > 0 && <h2 className="text-heading font-semibold text-ink">{t('requests')}</h2>}
              {requests.map((q) => (
                <div key={q.inviteId} className="space-y-2 rounded-card border border-accent/40 bg-surface p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold text-ink">{q.friendName}</p>
                      <p dir="ltr" className="truncate text-caption text-ink-muted text-start">
                        {q.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t('decline')}
                      className={`${ACTION} text-danger`}
                      onClick={() => open({ kind: 'decline', request: q })}
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                  <p className="text-caption text-ink-muted">
                    {t('invitedBy', { name: q.fromName || q.fromFamily, family: q.fromFamily })} ·{' '}
                    {formatDay(q.createdAt.slice(0, 10), locale)}
                  </p>
                  <Button
                    onClick={() => {
                      open({ kind: 'new', request: q });
                      setFamilyName(q.friendName);
                      setEmail(q.email);
                    }}
                    className="h-12 w-full text-body font-semibold text-accent-ink"
                  >
                    {t('startTheirFamily')}
                  </Button>
                </div>
              ))}
              {waiting.map((w) => (
                <div key={w.email} className="space-y-1 rounded-card border border-dashed border-line bg-surface p-4">
                  <p className="truncate text-body font-semibold text-ink">{w.familyName || t('unnamed')}</p>
                  <p dir="ltr" className="truncate text-caption text-ink-muted text-start">
                    {w.email}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {w.hoursLeft ? t('waitingExpires', { hours: w.hoursLeft }) : t('waiting')}
                  </p>
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

      <Drawer open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)} repositionInputs>
        <DrawerContent ref={sheetRef} className="max-h-[96dvh]">
          <div className="min-h-0 overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-0 pt-1 pb-2">
              <DrawerTitle className="text-title font-bold text-ink">
                {sheet?.kind === 'new' && t('newFamily')}
                {sheet?.kind === 'decline' && t('declineFor', { name: sheet.request.friendName })}
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
              {sheet?.kind === 'decline' && <p className="text-body text-ink-muted">{t('declineHint')}</p>}
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
                  (sheet?.kind === 'status' && sheet.family.status === 'active') || sheet?.kind === 'decline' ? 'bg-danger' : ''
                }`}
              >
                {sheet?.kind === 'new' && t('create')}
                {sheet?.kind === 'decline' && t('decline')}
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

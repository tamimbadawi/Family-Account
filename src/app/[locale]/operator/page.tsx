'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronLeft, KeyRound, Pause, Play, Plus, X } from 'lucide-react';
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
  type InsightsFamily,
  type OperatorFamily,
  type OperatorInsights,
  type SupportInboxMessage,
  type WaitingFamily,
} from '@/lib/auth/operator';
import { timeAgo } from '@/lib/operator/time';
import { DailyEntriesChart } from '@/components/operator/DailyEntriesChart';
import { inviteLink, sendInvite } from '@/lib/auth/invite';
import { formatDay } from '@/lib/format';

type Sheet =
  | { kind: 'new'; request?: FamilyRequest }
  | { kind: 'decline'; request: FamilyRequest }
  | { kind: 'reset'; family: OperatorFamily } | { kind: 'status'; family: OperatorFamily } | null;

type Tab = 'overview' | 'families' | 'inbox' | 'help';
const TABS: Tab[] = ['overview', 'families', 'inbox', 'help'];

const CARD = 'rounded-card border border-line/40 bg-surface p-4 shadow-card';

const ACTION =
  'flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted transition-transform active:scale-95 cursor-pointer';

/**
 * /operator · the dashboard for the person who runs the app (OPERATOR_EMAILS in the `operator` Edge
 * Function). Its own screen, outside the family app. Four tabs:
 *  - Overview: how much the app is used (families, people, entries per day), counts only.
 *  - Families: every family and its people (last sign-in, entries added); start, pause, reset.
 *  - Inbox: messages from Settings → Contact support, who sent them, from where, with photos.
 *  - Needs help: people and families that look stuck.
 * Never shows amounts, notes, categories or wallet names.
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
  const [insights, setInsights] = React.useState<OperatorInsights | null>(null);
  const [tab, setTab] = React.useState<Tab>('overview');
  const [openFamily, setOpenFamily] = React.useState<string | null>(null);
  // "5 minutes ago" is worked out from the moment the data arrived
  const [now, setNow] = React.useState(0);
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
        const loadedAt = Date.now();
        setNow(loadedAt);
        setFamilies(result.families);
        // Hours until an unused login is deleted, worked out once per load
              setWaiting(
          (result.waiting ?? []).map((w) => ({
            ...w,
            hoursLeft: w.expiresAt
              ? Math.max(1, Math.ceil((new Date(w.expiresAt).getTime() - loadedAt) / 3_600_000))
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
    // Usage numbers come separately, so the families and messages still show if this part fails
    operator<OperatorInsights>({ action: 'insights' })
      .then((result) => !cancelled && setInsights(result))
      .catch(() => !cancelled && setInsights(null));
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
      setAttempt((a) => a + 1);
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
          onClick: () => {
            const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
            void sendInvite(t('loginTitle'), t(isAndroid ? 'loginTextAndroid' : 'loginText', login), inviteLink(window.location.origin, locale)).then((r) => {
              if (r === 'copied') toast.success(t('loginCopied'));
            });
          },
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


  const ago = (iso: string) => timeAgo(iso, locale, now);
  const insightsFor = (id: string): InsightsFamily | undefined => insights?.families.find((f) => f.householdId === id);

  // Needs help: computed from what is already loaded
  const quietPeople = (insights?.families ?? []).flatMap((f) =>
    f.members.filter((m) => m.entries === 0).map((m) => ({ ...m, family: f.name }))
  );
  const sampleFamilies = (insights?.families ?? []).filter((f) => f.hasSample);
  const helpCount = quietPeople.length + sampleFamilies.length + waiting.length + requests.length;
  const doneMessages = (insights?.supportRecent ?? []).filter((m) => m.status === 'done');

  const badge = (n: number) =>
    n > 0 ? (
      <span className="ms-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-caption font-semibold tabular-nums text-accent-ink">
        {n}
      </span>
    ) : null;

  const stat = (label: string, value: number | undefined) => (
    <div className={`${CARD} space-y-0.5`}>
      <p className="text-title font-bold tabular-nums text-ink">{value ?? '–'}</p>
      <p className="text-caption leading-tight text-ink-muted">{label}</p>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 border-b border-line/30 px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 select-none">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="-ms-2 flex size-11 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-surface-2"
            aria-label={t('backToApp')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </Link>
          <h1 className="truncate text-title font-bold text-ink">{t('dashboard')}</h1>
        </div>
        {live && !denied && (
          <div role="tablist" className="flex rounded-full bg-surface-2 p-1 text-caption font-semibold">
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex min-h-10 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full px-1 transition-colors ${
                  tab === key ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {t(`tabs.${key}`)}
                {key === 'inbox' && badge(support.length)}
                {key === 'help' && badge(helpCount)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 pb-24">
        {!live || denied ? (
          <div className={`${CARD} space-y-2`}>
            <p className="text-body text-ink">{live ? t('denied') : t('liveOnly')}</p>
            {live && <p className="text-caption text-ink-muted">{t('deniedHint')}</p>}
          </div>
        ) : loadFailed && !families ? (
          <div className={`${CARD} space-y-3 text-center`}>
            <p className="text-body text-ink">{t('loadFailed')}</p>
            <Button variant="outline" onClick={() => setAttempt((a) => a + 1)} className="h-12 w-full text-body font-semibold">
              {t('tryAgain')}
            </Button>
          </div>
        ) : !families ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-card" />
            <Skeleton className="h-40 w-full rounded-card" />
          </div>
        ) : tab === 'overview' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {stat(t('statFamilies'), insights?.totals.families ?? families.length)}
              {stat(t('statPeople'), insights?.totals.people)}
              {stat(t('statEntries7d'), insights?.totals.entries7d)}
              {stat(t('statActive7d'), insights?.totals.activeFamilies7d)}
              {stat(t('statEntries30d'), insights?.totals.entries30d)}
              {stat(t('statSignIns7d'), insights?.totals.signIns7d)}
            </div>
            {insights && (
              <div className={`${CARD} space-y-1`}>
                <h2 className="text-heading font-semibold text-ink">{t('chartTitle')}</h2>
                <p className="text-caption text-ink-muted">{t('chartHint')}</p>
                <DailyEntriesChart daily={insights.daily} />
              </div>
            )}
            {(support.length > 0 || helpCount > 0) && (
              <div className="space-y-2">
                {support.length > 0 && (
                  <button type="button" onClick={() => setTab('inbox')} className={`${CARD} block w-full text-start`}>
                    <p className="text-body font-semibold text-ink">{t('openMessages', { count: support.length })}</p>
                    <p className="text-caption text-ink-muted">{t('openMessagesHint')}</p>
                  </button>
                )}
                {helpCount > 0 && (
                  <button type="button" onClick={() => setTab('help')} className={`${CARD} block w-full text-start`}>
                    <p className="text-body font-semibold text-ink">{t('needHelpCount', { count: helpCount })}</p>
                    <p className="text-caption text-ink-muted">{t('needHelpHint')}</p>
                  </button>
                )}
              </div>
            )}
            {!insights && <p className="text-caption text-ink-muted">{t('insightsMissing')}</p>}
          </>
        ) : tab === 'families' ? (
          <>
            <p className="text-body text-ink-muted">{t('hint')}</p>
            <Button onClick={() => open({ kind: 'new' })} className="h-14 w-full gap-2 text-heading font-semibold text-accent-ink">
              <Plus className="size-5" />
              {t('newFamily')}
            </Button>
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
            {families.length === 0 && <p className="text-body text-ink-muted">{t('empty')}</p>}
            {families.map((f) => {
              const more = insightsFor(f.householdId);
              const expanded = openFamily === f.householdId;
              return (
                <div key={f.householdId} className={`${CARD} space-y-2`}>
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
                    {more
                      ? t('familyCounts', { members: f.members, entries: more.entries, week: more.entries7d })
                      : t('counts', { members: f.members, wallets: f.wallets, entries: f.entries })}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {f.status === 'suspended' && <span className="font-semibold text-danger">{t('pausedLabel')} · </span>}
                    {more?.hasSample && <span className="font-semibold text-warning">{t('sampleOn')} · </span>}
                    {(more?.lastEntryAt ?? f.lastEntryAt)
                      ? t('lastEntryAgo', { when: ago((more?.lastEntryAt ?? f.lastEntryAt)!) })
                      : t('noEntries')}
                  </p>
                  {more && more.members.length > 0 && (
                    <>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setOpenFamily(expanded ? null : f.householdId)}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-body font-semibold text-accent"
                      >
                        {expanded ? t('hidePeople') : t('showPeople', { count: more.members.length })}
                        <ChevronDown className={`size-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded && (
                        <div className="divide-y divide-line/30 rounded-xl bg-surface-2/40">
                          {more.members.map((m) => (
                            <div key={`${m.email}-${m.joinedAt}`} className="space-y-0.5 px-3 py-2.5">
                              <p className="text-body font-semibold text-ink">
                                {m.name}
                                {m.role === 'owner' && <span className="ms-2 text-caption font-normal text-ink-muted">{t('admin')}</span>}
                              </p>
                              {m.email && (
                                <p dir="ltr" className="truncate text-caption text-ink-muted text-start">
                                  {m.email}
                                </p>
                              )}
                              <p className="text-caption text-ink-muted tabular-nums">
                                {t('memberEntries', { count: m.entries })} ·{' '}
                                {m.lastSignInAt ? t('signedInAgo', { when: ago(m.lastSignInAt) }) : t('neverSignedIn')}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </>
        ) : tab === 'inbox' ? (
          <>
            {support.length === 0 && <p className="text-body text-ink-muted">{t('inboxEmpty')}</p>}
            {support.map((m) => {
              const more = insights?.supportRecent.find((x) => x.id === m.id);
              return (
                <div key={m.id} className="space-y-2 rounded-card border border-accent/40 bg-surface p-4 shadow-card">
                  <div className="min-w-0">
                    <p className="truncate text-body font-semibold text-ink">
                      {m.sender ? t('supportFrom', { name: m.sender, family: m.family }) : m.family}
                    </p>
                    {more?.email && (
                      <p dir="ltr" className="truncate text-caption text-ink-muted text-start">
                        {more.email}
                      </p>
                    )}
                    <p className="text-caption text-ink-muted">
                      {m.section && tSettings.has(`supportSection.${m.section}`) && (
                        <>{t('supportWhere', { where: tSettings(`supportSection.${m.section}`) })} · </>
                      )}
                      {ago(m.createdAt)}
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
                          className="size-24 overflow-hidden rounded-2xl bg-surface-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage link */}
                          <img src={url} alt="" className="size-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  {m.photoUrls.length > 0 && <p className="text-caption text-ink-muted">{t('photoHint')}</p>}
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
              );
            })}
            {doneMessages.length > 0 && (
              <>
                <h2 className="pt-2 text-heading font-semibold text-ink">{t('inboxDoneTitle')}</h2>
                {doneMessages.map((m) => (
                  <div key={m.id} className={`${CARD} space-y-1`}>
                    <p className="truncate text-body font-semibold text-ink">
                      {m.sender ? t('supportFrom', { name: m.sender, family: m.family }) : m.family}
                    </p>
                    <p className="text-caption text-ink-muted">
                      {m.section && tSettings.has(`supportSection.${m.section}`) && (
                        <>{t('supportWhere', { where: tSettings(`supportSection.${m.section}`) })} · </>
                      )}
                      {ago(m.createdAt)}
                      {m.handledAt && <> · {t('doneAgo', { when: ago(m.handledAt) })}</>}
                    </p>
                    {m.message && (
                      <p dir="auto" className="whitespace-pre-wrap break-words text-body text-ink-muted">
                        {m.message}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {helpCount === 0 && <p className="text-body text-ink-muted">{t('helpEmpty')}</p>}
            {requests.length > 0 && (
              <button type="button" onClick={() => setTab('families')} className={`${CARD} block w-full text-start`}>
                <p className="text-body font-semibold text-ink">{t('helpRequests', { count: requests.length })}</p>
                <p className="text-caption text-ink-muted">{requests.map((q) => q.friendName).join(' · ')}</p>
              </button>
            )}
            {waiting.length > 0 && <h2 className="text-heading font-semibold text-ink">{t('helpLogins')}</h2>}
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
            {quietPeople.length > 0 && <h2 className="text-heading font-semibold text-ink">{t('helpQuiet')}</h2>}
            {quietPeople.map((m) => (
              <div key={`${m.family}-${m.email}-${m.joinedAt}`} className={`${CARD} space-y-0.5`}>
                <p className="truncate text-body font-semibold text-ink">
                  {m.name} <span className="font-normal text-ink-muted">({m.family})</span>
                </p>
                {m.email && (
                  <p dir="ltr" className="truncate text-caption text-ink-muted text-start">
                    {m.email}
                  </p>
                )}
                <p className="text-caption text-ink-muted">
                  {t('joinedAgo', { when: ago(m.joinedAt) })} ·{' '}
                  {m.lastSignInAt ? t('signedInAgo', { when: ago(m.lastSignInAt) }) : t('neverSignedIn')}
                </p>
              </div>
            ))}
            {sampleFamilies.length > 0 && <h2 className="text-heading font-semibold text-ink">{t('helpSample')}</h2>}
            {sampleFamilies.map((f) => (
              <div key={f.householdId} className={`${CARD} space-y-0.5`}>
                <p className="truncate text-body font-semibold text-ink">{f.name}</p>
                <p className="text-caption text-ink-muted">
                  {t('helpSampleHint', { when: ago(f.createdAt) })}
                </p>
              </div>
            ))}
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

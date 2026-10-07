'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Crown, KeyRound, Pencil, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { WalletShortcut } from '@/components/layout/WalletShortcut';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useRestoreSheetAfterKeyboard } from '@/components/settings/useRestoreSheetAfterKeyboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useHouseholdMembers } from '@/lib/data/provider';
import { isAuthConfigured } from '@/lib/supabase/client';
import { familyAdmin, type FamilyList, type FamilyMember } from '@/lib/auth/family-admin';
import { isEmail, loginLabel, normalizeEmail } from '@/lib/auth/email';
import { isEnglishName } from '@/lib/members';
import { FAMILY_NAME_MAX, useFamilyName } from '@/lib/auth/family-name';

type Sheet =
  | { kind: 'add' }
  | { kind: 'rename' }
  | { kind: 'reset'; member: FamilyMember }
  | { kind: 'remove'; member: FamilyMember }
  | { kind: 'owner'; member: FamilyMember }
  | null;

const ROW = 'flex min-h-14 items-center gap-3 px-3.5 py-2.5';
const ACTION =
  'flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted transition-transform active:scale-95 cursor-pointer';

/** Settings → Family: everyone sees who is in the household; only the admin (owner) can change it. */
export default function FamilyPage() {
  const t = useTranslations('family');
  const tSettings = useTranslations('settings');
  const live = isAuthConfigured();
  const sampleMembers = useHouseholdMembers();
  const family = useFamilyName();

  const [list, setList] = React.useState<FamilyList | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [sheet, setSheet] = React.useState<Sheet>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  useRestoreSheetAfterKeyboard(sheetRef, sheet !== null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const load = React.useCallback(async () => {
    try {
      setList(await familyAdmin<FamilyList>({ action: 'list' }));
    } catch {
      toast.error(t('loadFailed'));
    }
  }, [t]);

  React.useEffect(() => {
    if (!live) return;
    let cancelled = false;
    familyAdmin<FamilyList>({ action: 'list' })
      .then((result) => {
        if (!cancelled) {
          setList(result);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [live, attempt]);

  const open = (next: Sheet) => {
    setError(null);
    setName('');
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
      await load();
    } catch (err) {
      const code = err instanceof Error ? err.message : 'failed';
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.failed'));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!sheet || busy) return;
    if (sheet.kind === 'rename') {
      if (!name.trim()) return setError(t('errors.no_family_name'));
      void run(() => family.rename(name), t('renamed'));
    } else if (sheet.kind === 'add') {
      // The name is what the app shows; the email is only what they sign in with
      if (!isEnglishName(name)) return setError(t('errors.bad_name'));
      if (!isEmail(email)) return setError(t('errors.bad_email'));
      void run(
        () => familyAdmin({ action: 'add_member', email: normalizeEmail(email), displayName: name.trim(), password }),
        t('added', { name: name.trim() })
      );
    } else if (sheet.kind === 'reset') {
      void run(() => familyAdmin({ action: 'reset_password', userId: sheet.member.userId, password }), t('resetDone'));
    } else if (sheet.kind === 'remove') {
      void run(() => familyAdmin({ action: 'remove_member', userId: sheet.member.userId }), t('removed'));
    } else {
      void run(() => familyAdmin({ action: 'transfer_owner', userId: sheet.member.userId }), t('adminDone'));
    }
  };

  const members: FamilyMember[] = live
    ? (list?.members ?? [])
    : sampleMembers.map((m) => ({ userId: m.userId, displayName: m.displayName, role: m.role, email: '' }));
  const isOwner = live && Boolean(list?.isOwner);
  // The family admin can change the family's name (sample-data mode: anyone, as there is no admin)
  const canRename = isOwner || !live;

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
      <div className="flex shrink-0 items-center justify-between border-b border-line/30 px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 select-none">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/settings"
            className="-ms-2 flex size-11 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-surface-2"
            aria-label={tSettings('back')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </Link>
          <h1 className="truncate text-title font-bold text-ink">{t('title')}</h1>
        </div>
        <WalletShortcut />
      </div>

      <div className="flex-1 space-y-4 px-5 py-4 pb-24">
        <div className="flex min-h-14 items-center gap-3 rounded-card border border-line/40 bg-surface px-3.5 py-2.5 shadow-card">
          <div className="min-w-0 flex-1">
            <div className="text-caption text-ink-muted">{t('familyName')}</div>
            {family.name === null ? (
              <Skeleton className="mt-1 h-5 w-40" />
            ) : (
              <div className="truncate text-body font-semibold text-ink">{family.name}</div>
            )}
          </div>
          {canRename && family.name !== null && (
            <button
              type="button"
              aria-label={t('renameFamily')}
              className={ACTION}
              onClick={() => {
                open({ kind: 'rename' });
                setName(family.name ?? '');
              }}
            >
              <Pencil className="size-5" />
            </button>
          )}
        </div>

        <p className="text-body text-ink-muted">{isOwner ? t('ownerHint') : t('memberHint')}</p>

        {live && !list && loadFailed ? (
          <div className="space-y-3 rounded-card border border-line/40 bg-surface p-4 text-center shadow-card">
            <p className="text-body text-ink">{t('loadFailed')}</p>
            <Button variant="outline" onClick={() => setAttempt((a) => a + 1)} className="h-12 w-full text-body font-semibold">
              {t('tryAgain')}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-line/40 rounded-card border border-line/40 bg-surface shadow-card">
          {live && !list
            ? [1, 2].map((i) => (
                <div key={i} className={ROW}>
                  <Skeleton className="size-10 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))
            : members.map((m) => (
                <div key={m.userId} className={ROW}>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-member-1-soft text-body font-bold text-member-1">
                    {m.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-body font-semibold text-ink">
                      <span className="truncate">{m.displayName}</span>
                      {m.role === 'owner' && <Crown aria-label={t('admin')} className="size-4 shrink-0 text-warning" />}
                    </div>
                    <div className="truncate text-caption text-ink-muted">
                      {m.role === 'owner' ? t('admin') : t('member')}
                      {m.email && <span dir="ltr"> · {loginLabel(m.email)}</span>}
                    </div>
                  </div>
                  {isOwner && m.userId !== list?.me && (
                    <div className="flex gap-1.5">
                      <button type="button" aria-label={t('resetPassword')} className={ACTION} onClick={() => open({ kind: 'reset', member: m })}>
                        <KeyRound className="size-5" />
                      </button>
                      <button type="button" aria-label={t('makeAdmin')} className={ACTION} onClick={() => open({ kind: 'owner', member: m })}>
                        <Crown className="size-5" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('remove')}
                        className={`${ACTION} text-danger`}
                        onClick={() => open({ kind: 'remove', member: m })}
                      >
                        <UserMinus className="size-5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {isOwner && (
          <Button onClick={() => open({ kind: 'add' })} className="h-14 w-full gap-2 text-heading font-semibold text-accent-ink">
            <UserPlus className="size-5" />
            {t('addMember')}
          </Button>
        )}
      </div>

      <Drawer open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)} repositionInputs>
        <DrawerContent ref={sheetRef} className="max-h-[96dvh]">
          <div className="min-h-0 overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-0 pt-1 pb-2">
              <DrawerTitle className="text-title font-bold text-ink">
                {sheet?.kind === 'add' && t('addMember')}
                {sheet?.kind === 'rename' && t('renameFamily')}
                {sheet?.kind === 'reset' && t('resetFor', { name: sheet.member.displayName })}
                {sheet?.kind === 'remove' && t('removeFor', { name: sheet.member.displayName })}
                {sheet?.kind === 'owner' && t('adminFor', { name: sheet.member.displayName })}
              </DrawerTitle>
            </DrawerHeader>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {sheet?.kind === 'rename' && (
                <Input
                  aria-label={t('familyName')}
                  placeholder={t('familyName')}
                  value={name}
                  maxLength={FAMILY_NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  className="h-14 bg-surface-2 text-body"
                />
              )}
              {sheet?.kind === 'add' && (
                <>
                  <Input
                    aria-label={t('name')}
                    placeholder={t('namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    dir="ltr"
                    lang="en"
                    autoCapitalize="words"
                    className="h-14 bg-surface-2 text-body"
                  />
                  <p className="text-caption text-ink-muted">{t('nameHint')}</p>
                  <Input
                    type="email"
                    inputMode="email"
                    dir="ltr"
                    aria-label={t('email')}
                    placeholder={t('email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    className="h-14 bg-surface-2 text-body"
                  />
                  <p className="text-caption text-ink-muted">{t('emailHint')}</p>
                </>
              )}
              {(sheet?.kind === 'add' || sheet?.kind === 'reset') && (
                <>
                  <Input
                    aria-label={t('password')}
                    placeholder={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    className="h-14 bg-surface-2 text-body"
                  />
                  <p className="text-caption text-ink-muted">{t('tempPasswordHint')}</p>
                </>
              )}
              {sheet?.kind === 'remove' && <p className="text-body text-ink-muted">{t('removeHint')}</p>}
              {sheet?.kind === 'owner' && <p className="text-body text-ink-muted">{t('adminHint')}</p>}

              {error && (
                <p role="alert" className="text-body font-medium text-danger">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={busy}
                className={`h-14 w-full text-heading font-semibold ${sheet?.kind === 'remove' ? 'bg-danger text-accent-ink' : 'text-accent-ink'}`}
              >
                {sheet?.kind === 'add' && t('addMember')}
                {sheet?.kind === 'rename' && t('save')}
                {sheet?.kind === 'reset' && t('resetPassword')}
                {sheet?.kind === 'remove' && t('remove')}
                {sheet?.kind === 'owner' && t('makeAdmin')}
              </Button>
            </form>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

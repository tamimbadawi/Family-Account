'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, Crown, Heart, KeyRound, Pencil, Send, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { WalletShortcut } from '@/components/layout/WalletShortcut';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useRestoreSheetAfterKeyboard } from '@/components/settings/useRestoreSheetAfterKeyboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useHousehold, useHouseholdMembers, useRepository } from '@/lib/data/provider';
import { CurrencySelect } from '@/components/family/CurrencySelect';
import { currencyName, currencySymbol } from '@/lib/format';
import { isOfflineError } from '@/lib/data/errors';
import { isAuthConfigured } from '@/lib/supabase/client';
import { familyAdmin, createFamilyInviteLink, type FamilyList, type FamilyMember } from '@/lib/auth/family-admin';
import { joinLink, familyInviteLink, sendInvite } from '@/lib/auth/invite';
import { FAMILY_NAME_MAX, useFamilyName } from '@/lib/auth/family-name';

type Sheet =
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
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const live = isAuthConfigured();
  const repo = useRepository();
  const household = useHousehold();
  const sampleMembers = useHouseholdMembers();
  const family = useFamilyName();

  const currentCurrencies = React.useMemo(() => {
    return household?.currencies ?? (household?.currency ? [household.currency] : ['EGP']);
  }, [household]);
  const defaultMain = currentCurrencies[0] || 'EGP';
  const defaultSecond = currentCurrencies[1] || '';

  const [overrideMain, setOverrideMain] = React.useState<string | null>(null);
  const [overrideSecond, setOverrideSecond] = React.useState<string | null>(null);
  const [savingCurrencies, setSavingCurrencies] = React.useState(false);

  const mainCurrency = overrideMain ?? defaultMain;
  const secondCurrency = overrideSecond !== null ? overrideSecond : defaultSecond;

  const hasCurrencyChanges = mainCurrency !== defaultMain || secondCurrency !== defaultSecond;

  const handleSaveCurrencies = async () => {
    if (savingCurrencies) return;
    setSavingCurrencies(true);
    try {
      const next = secondCurrency ? [mainCurrency, secondCurrency] : [mainCurrency];
      await repo.setHouseholdCurrencies(next);
      setOverrideMain(null);
      setOverrideSecond(null);
      toast.success(t('currenciesSaved'));
    } catch (err) {
      if (isOfflineError(err) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        toast.error(tCommon('noConnection'));
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('wallet still uses')) {
          toast.error(t('currencyInUse'));
        } else if (msg.includes('one or two') || msg.includes('Choose')) {
          toast.error(t('chooseCurrencies'));
        } else {
          toast.error(t('errors.failed'));
        }
      }
    } finally {
      setSavingCurrencies(false);
    }
  };

  const [list, setList] = React.useState<FamilyList | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [sheet, setSheet] = React.useState<Sheet>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  useRestoreSheetAfterKeyboard(sheetRef, sheet !== null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
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
    setPassword('');
    setSheet(next);
  };

  /** Shares the family member invite link directly. Zero inputs needed. */
  const inviteMember = async () => {
    setBusy(true);
    try {
      let code = 'sample';
      let familyName = family.name ?? '';
      if (live) {
        const res = await familyAdmin<{ ok: boolean; code: string; familyName: string }>({
          action: 'get_invite_link',
        });
        code = res.code;
        familyName = res.familyName || familyName;
      }
      const url = joinLink(window.location.origin, locale, code);
      const text = t('inviteWithLink', { family: familyName });
      const result = await sendInvite(t('inviteTitle'), text, url);
      if (result === 'copied') toast.success(t('inviteCopied'));
      else if (result === 'failed') toast.error(t('inviteFailed'));
    } catch {
      toast.error(t('inviteFailed'));
    } finally {
      setBusy(false);
    }
  };

  /** Generates a 24h invite link for a new family and shares it immediately. Zero inputs needed. */
  const inviteNewFamily = async () => {
    setBusy(true);
    try {
      let url: string;
      if (live) {
        const res = await createFamilyInviteLink();
        url = familyInviteLink(window.location.origin, locale, res.code);
      } else {
        // Sample-data mode: generate a demo link
        url = familyInviteLink(window.location.origin, locale, 'demo');
      }
      const text = t('newFamilyInviteText');
      const result = await sendInvite(t('inviteTitle'), text, url);
      if (result === 'copied') toast.success(t('inviteCopied'));
      else if (result === 'failed') toast.error(t('inviteFailed'));
    } catch {
      toast.error(t('inviteFailed'));
    } finally {
      setBusy(false);
    }
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
      if (live) await load();
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
  const canEditCurrencies = isOwner || !live;

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
          <h1 className="shrink-0 text-title font-bold text-ink">{t('title')}</h1>
          {family.name === null ? (
            <Skeleton className="h-6 w-24" />
          ) : canRename ? (
            <button
              type="button"
              aria-label={`${t('renameFamily')}: ${family.name}`}
              className="flex h-11 min-w-0 cursor-pointer items-center gap-1.5 text-title font-semibold text-accent transition-opacity active:opacity-70"
              onClick={() => {
                open({ kind: 'rename' });
                setName(family.name ?? '');
              }}
            >
              <span aria-hidden className="text-ink-faint">·</span>
              <span dir="auto" className="truncate">
                {family.name}
              </span>
              <Pencil className="size-4 shrink-0" />
            </button>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5 text-title font-semibold text-accent">
              <span aria-hidden className="text-ink-faint">·</span>
              <span dir="auto" className="truncate">
                {family.name}
              </span>
            </span>
          )}
        </div>
        <WalletShortcut />
      </div>

      <div className="flex-1 space-y-3 px-5 py-3 pb-20">
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

        {(isOwner || !live) && (
          <div className="space-y-2">
            <Button onClick={inviteMember} disabled={busy} className="h-14 w-full gap-2 text-heading font-semibold text-accent-ink">
              <Send className="size-5 rtl:-scale-x-100" />
              {t('inviteMember')}
            </Button>
            <p className="text-center text-caption text-ink-muted">{t('inviteMemberHint')}</p>
          </div>
        )}

        {/* Currencies card */}
        <section className="space-y-2.5 rounded-card border border-line/40 bg-surface p-3.5 shadow-card">
          <div className="space-y-0.5">
            <h2 className="text-body font-semibold text-ink">{t('currencies')}</h2>
            <p className="text-caption text-ink-muted">{t('currenciesHint')}</p>
          </div>

          {canEditCurrencies ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="main-currency" className="text-caption font-medium text-ink-muted">
                    {t('mainCurrency')}
                  </label>
                  <CurrencySelect
                    id="main-currency"
                    value={mainCurrency}
                    exclude={secondCurrency}
                    onChange={setOverrideMain}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="second-currency" className="text-caption font-medium text-ink-muted">
                    {t('secondCurrency')}
                  </label>
                  <CurrencySelect
                    id="second-currency"
                    value={secondCurrency}
                    exclude={mainCurrency}
                    noneLabel={t('noSecondCurrency')}
                    onChange={setOverrideSecond}
                  />
                </div>
              </div>

              {hasCurrencyChanges && (
                <Button
                  type="button"
                  onClick={handleSaveCurrencies}
                  disabled={savingCurrencies}
                  className="h-12 w-full text-body font-semibold text-accent-ink"
                >
                  {savingCurrencies ? t('saving') : t('saveCurrencies')}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <div>
                <span className="block text-caption text-ink-muted">{t('mainCurrency')}</span>
                <span className="truncate text-body font-semibold text-ink">
                  {currencyName(mainCurrency, locale)} ({currencySymbol(mainCurrency, locale)})
                </span>
              </div>
              {secondCurrency && (
                <div>
                  <span className="block text-caption text-ink-muted">{t('secondCurrency')}</span>
                  <span className="truncate text-body font-semibold text-ink">
                    {currencyName(secondCurrency, locale)} ({currencySymbol(secondCurrency, locale)})
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="space-y-3 rounded-card bg-accent-soft p-4">
            <div className="flex gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-accent">
                <Heart className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-heading font-semibold text-ink">{t('otherFamilies')}</h2>
                <p className="text-body text-ink-muted">{t('otherFamiliesHint')}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={inviteNewFamily}
              disabled={busy}
              className="h-14 w-full gap-2 border-transparent bg-surface text-heading font-semibold text-accent"
            >
              <Send className="size-5 rtl:-scale-x-100" />
              {t('inviteFamily')}
            </Button>
            <p className="text-center text-caption text-ink-muted">{t('newFamilyInviteHint')}</p>
          </div>
        </section>
      </div>

      <Drawer open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)} repositionInputs>
        <DrawerContent ref={sheetRef} className="max-h-[96dvh]">
          <div className="min-h-0 overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-0 pt-1 pb-2">
              <DrawerTitle className="text-title font-bold text-ink">
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
              {sheet?.kind === 'reset' && (
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

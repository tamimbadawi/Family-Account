'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ChevronRight,
  Download,
  FolderTree,
  Globe,
  KeyRound,
  LifeBuoy,
  LogOut,
  PiggyBank,
  Repeat,
  Target,
  Trash2,
  Users,
  Wallet,
  Coins,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useRepository } from '@/lib/data/provider';
import { localISODate } from '@/lib/format';
import { useFamilyMembers } from '@/lib/auth/use-family-members';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';
import { entriesToCsv } from '@/lib/reports/export';
import { SupportDrawer } from '@/components/settings/SupportDrawer';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const familyNames = useFamilyMembers().map((m) => m.displayName).join(' · ');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const repo = useRepository();

  const [isExporting, setIsExporting] = React.useState(false);
  const [isSupportOpen, setIsSupportOpen] = React.useState(false);

  const handleLanguageToggle = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    router.replace(pathname, { locale: nextLocale });
  };

  const handleDownloadCsv = async () => {
    try {
      setIsExporting(true);
      const entries = await repo.listEntries({ includeDeleted: false });
      const csvContent = entriesToCsv(entries, locale as 'ar' | 'en');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-accounts-${localISODate()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('downloadSuccess'));
    } catch (err) {
      console.error(err);
      toast.error('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const signingOutRef = React.useRef(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const handleSignOut = async () => {
    if (!isAuthConfigured()) {
      toast.info(t('signOut'));
      return;
    }
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    // The first tap shows at once that it worked
    setIsSigningOut(true);
    // No step may leave the person waiting: each one gets a moment at most, then we move on
    const within = (work: Promise<unknown>, ms: number) =>
      Promise.race([work.catch((err) => console.warn('[sign-out]', err)), new Promise((done) => setTimeout(done, ms))]);
    await within(getSupabaseBrowserClient().auth.signOut(), 2000);
    // Whatever the server said, forget the session on this phone
    try {
      for (const part of document.cookie.split(';')) {
        const name = part.split('=')[0].trim();
        if (name.startsWith('sb-')) document.cookie = `${name}=; path=/; max-age=0`;
      }
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('sb-')) window.localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn('[sign-out]', err);
    }
    // Nothing of the family stays on the phone after signing out
    await within(repo.clearCache?.() ?? Promise.resolve(), 1500);
    // A full page load, so the sign-in screen always opens (a soft move could stay on this screen)
    window.location.replace(`/${locale}/login`);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-2.5 [@media(max-height:700px)]:space-y-1.5 [@media(max-height:700px)]:pb-1 [@media(max-height:700px)]:pt-0 select-none">
      {/* Primary Inset Group */}
      <div className="bg-surface rounded-card border border-line/40 shadow-card divide-y divide-line/30">
        {/* Categories */}
        <Link
          href="/settings/categories"
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-1 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <FolderTree className="size-4.5" />
            </div>
            <span className="text-body font-semibold text-ink">
              {t('categories')}
            </span>
          </div>
          <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
        </Link>

        {/* Wallets */}
        <Link
          href="/settings/wallets"
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-1 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-income-soft text-income">
              <Wallet className="size-4.5" />
            </div>
            <span className="text-body font-semibold text-ink">
              {t('wallets')}
            </span>
          </div>
          <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
        </Link>

        {/* Budgets */}
        <Link
          href="/settings/budgets"
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-1 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-member-2-soft text-member-2">
              <PiggyBank className="size-4.5" />
            </div>
            <span className="text-body font-semibold text-ink">
              {t('budgets')}
            </span>
          </div>
          <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
        </Link>

        {/* Recurring Entries */}
        <Link
          href="/settings/recurring"
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-1 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <Repeat className="size-4.5" />
            </div>
            <span className="text-body font-semibold text-ink">
              {t('recurring')}
            </span>
          </div>
          <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
        </Link>

        {/* Savings Goals */}
        <Link
          href="/settings/goals"
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-1 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-income-soft text-income">
              <Target className="size-4.5" />
            </div>
            <span className="text-body font-semibold text-ink">
              {t('goals')}
            </span>
          </div>
          <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
        </Link>

        {/* Recently Deleted */}
        <Link
          href="/settings/deleted"
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-1 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-expense-soft text-expense">
              <Trash2 className="size-4.5" />
            </div>
            <span className="text-body font-semibold text-ink">
              {t('recentlyDeleted')}
            </span>
          </div>
          <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
        </Link>
      </div>

      {/* Preferences & Family Group */}
      <div className="bg-surface rounded-card border border-line/40 shadow-card divide-y divide-line/30">
        {/* Language and Currencies share one row, so Settings still fits the screen without scrolling */}
        <div className="grid grid-cols-2 divide-x divide-line/30 rtl:divide-x-reverse">
          <button
            type="button"
            onClick={handleLanguageToggle}
            className="flex min-h-[48px] items-center gap-2.5 px-3.5 py-2.5 [@media(max-height:700px)]:py-0.5 text-start transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none cursor-pointer"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/12 text-warning">
              <Globe className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-body font-semibold text-ink leading-tight">{t('language')}</div>
              <div className="text-caption text-ink-muted leading-tight">{locale === 'ar' ? 'العربية' : 'English'}</div>
            </div>
          </button>

          <Link
            href="/settings/currencies"
            className="flex min-h-[48px] items-center gap-2.5 px-3.5 py-2.5 [@media(max-height:700px)]:py-0.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-income-soft text-income">
              <Coins className="size-4.5" />
            </div>
            <span className="min-w-0 text-body font-semibold text-ink leading-tight">{t('currencies')}</span>
          </Link>
        </div>
        {/* Download CSV */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleDownloadCsv}
          onKeyDown={(e) => e.key === 'Enter' && handleDownloadCsv()}
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-0.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-member-3-soft text-member-3">
              <Download className="size-4.5" />
            </div>
            <div className="text-start">
              <div className="text-body font-semibold text-ink leading-tight">
                {t('download')}
              </div>
            </div>
          </div>
          {isExporting ? (
            <span className="text-caption text-ink-muted">...</span>
          ) : (
            <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
          )}
        </div>

        {/* Contact support */}
        <button
          type="button"
          onClick={() => setIsSupportOpen(true)}
          className="w-full flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-1 text-start transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <LifeBuoy className="size-4.5" />
            </div>
            <span className="text-body font-semibold text-ink">{t('support')}</span>
          </div>
          <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
        </button>

        {/* Family */}
        <Link
          href="/settings/family"
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-0.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-member-1-soft text-member-1">
              <Users className="size-4.5" />
            </div>
            <div>
              <div className="text-body font-semibold text-ink leading-tight">
                {t('family')}
              </div>
              <div className="text-caption text-ink-muted leading-tight">
                {familyNames}
              </div>
            </div>
          </div>
          <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
        </Link>

        {/* Change password (only with real sign-in) */}
        {isAuthConfigured() && (
          <Link
            href="/choose-password"
            className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-1 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <KeyRound className="size-4.5" />
              </div>
              <span className="text-body font-semibold text-ink">{t('changePassword')}</span>
            </div>
            <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
          </Link>
        )}
        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          aria-busy={isSigningOut}
          className="w-full flex min-h-[48px] items-center justify-between px-3.5 py-2.5 [@media(max-height:700px)]:py-1 text-start transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-expense-soft text-expense">
              <LogOut className="size-4.5 rtl:rotate-180" />
            </div>
            <span className="text-body font-semibold text-expense">
              {isSigningOut ? t('signingOut') : t('signOut')}
            </span>
          </div>
        </button>
      </div>

      <SupportDrawer open={isSupportOpen} onOpenChange={setIsSupportOpen} />
    </div>
  );
}

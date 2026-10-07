'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ChevronRight,
  Download,
  FolderTree,
  Globe,
  KeyRound,
  LogOut,
  PiggyBank,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useRepository } from '@/lib/data/provider';
import { localISODate } from '@/lib/format';
import { useFamilyMembers } from '@/lib/auth/use-family-members';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';
import { entriesToCsv } from '@/lib/reports/export';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const familyNames = useFamilyMembers().map((m) => m.displayName).join(' · ');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const repo = useRepository();

  const [isExporting, setIsExporting] = React.useState(false);

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

  const handleSignOut = async () => {
    if (!isAuthConfigured()) {
      toast.info(t('signOut'));
      return;
    }
    await getSupabaseBrowserClient().auth.signOut();
    router.replace('/login');
  };

  return (
    <div className="px-5 space-y-2.5 pt-1 select-none">
      {/* Primary Inset Group */}
      <div className="bg-surface rounded-card border border-line/40 shadow-card divide-y divide-line/30">
        {/* Categories */}
        <Link
          href="/settings/categories"
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
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
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
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
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
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

        {/* Recently Deleted */}
        <Link
          href="/settings/deleted"
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
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

      {/* Preferences & Tools Group */}
      <div className="bg-surface rounded-card border border-line/40 shadow-card divide-y divide-line/30">
        {/* Language switch */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleLanguageToggle}
          onKeyDown={(e) => e.key === 'Enter' && handleLanguageToggle()}
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/12 text-warning">
              <Globe className="size-4.5" />
            </div>
            <div className="text-start">
              <div className="text-body font-semibold text-ink leading-tight">
                {t('language')}
              </div>
              <div className="text-caption text-ink-muted leading-tight">
                {locale === 'ar' ? 'العربية' : 'English'}
              </div>
            </div>
          </div>
          <span className="text-caption font-semibold px-2 py-0.5 rounded-lg bg-surface-2 text-ink">
            {locale === 'ar' ? 'English' : 'عربي'}
          </span>
        </div>

        {/* Download CSV */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleDownloadCsv}
          onKeyDown={(e) => e.key === 'Enter' && handleDownloadCsv()}
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-member-3-soft text-member-3">
              <Download className="size-4.5" />
            </div>
            <div className="text-start">
              <div className="text-body font-semibold text-ink leading-tight">
                {t('download')}
              </div>
              <div className="text-caption text-ink-muted leading-tight">
                CSV (Excel)
              </div>
            </div>
          </div>
          {isExporting ? (
            <span className="text-caption text-ink-muted">...</span>
          ) : (
            <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
          )}
        </div>
      </div>

      {/* Family Section */}
      <div className="bg-surface rounded-card border border-line/40 shadow-card">
        <Link
          href="/settings/family"
          className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
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
      </div>

      {/* Change password (only with real sign-in) */}
      {isAuthConfigured() && (
        <div className="bg-surface rounded-card border border-line/40 shadow-card">
          <Link
            href="/choose-password"
            className="flex min-h-[48px] items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <KeyRound className="size-4.5" />
              </div>
              <span className="text-body font-semibold text-ink">{t('changePassword')}</span>
            </div>
            <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
          </Link>
        </div>
      )}

      {/* Sign out section */}
      <div className="bg-surface rounded-card border border-line/40 shadow-card">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex min-h-[48px] items-center justify-between px-3.5 py-2.5 text-start transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-expense-soft text-expense">
              <LogOut className="size-4.5 rtl:rotate-180" />
            </div>
            <span className="text-body font-semibold text-expense">
              {t('signOut')}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

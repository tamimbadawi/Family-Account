'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ChevronRight,
  Download,
  FolderTree,
  Globe,
  LogOut,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useRepository } from '@/lib/data/provider';

export default function SettingsPage() {
  const t = useTranslations('settings');
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
      const entries = await repo.listEntries({ includeDeleted: true });
      const BOM = '\uFEFF';
      const headers = [
        'Date',
        'Type',
        'Amount',
        'Category (AR)',
        'Category (EN)',
        'Item (AR)',
        'Item (EN)',
        'Wallet',
        'To Wallet',
        'Note',
      ];
      const rows = entries.map((e) => [
        e.occurredOn,
        e.type,
        e.amount.toFixed(2),
        `"${(e.categoryNameAr || '').replace(/"/g, '""')}"`,
        `"${(e.categoryNameEn || '').replace(/"/g, '""')}"`,
        `"${(e.itemNameAr || '').replace(/"/g, '""')}"`,
        `"${(e.itemNameEn || '').replace(/"/g, '""')}"`,
        `"${(e.accountNameEn || e.accountNameAr || '').replace(/"/g, '""')}"`,
        `"${(e.toAccountNameEn || e.toAccountNameAr || '').replace(/"/g, '""')}"`,
        `"${(e.note || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent =
        BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
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

  return (
    <div className="space-y-3.5 pt-1 select-none">
      {/* Primary Inset Group */}
      <div className="bg-surface rounded-card border border-line/40 shadow-card divide-y divide-line/30">
        {/* Categories */}
        <Link
          href="/settings/categories"
          className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <FolderTree className="size-5" />
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
          className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-income-soft text-income">
              <Wallet className="size-5" />
            </div>
            <span className="text-body font-semibold text-ink">
              {t('wallets')}
            </span>
          </div>
          <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
        </Link>

        {/* Recently Deleted */}
        <Link
          href="/settings/deleted"
          className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-expense-soft text-expense">
              <Trash2 className="size-5" />
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
          className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <Globe className="size-5" />
            </div>
            <div className="text-start">
              <div className="text-body font-semibold text-ink">
                {t('language')}
              </div>
              <div className="text-caption text-ink-muted">
                {locale === 'ar' ? 'العربية' : 'English'}
              </div>
            </div>
          </div>
          <span className="text-caption font-semibold px-2.5 py-1 rounded-lg bg-surface-2 text-ink">
            {locale === 'ar' ? 'English' : 'عربي'}
          </span>
        </div>

        {/* Download CSV */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleDownloadCsv}
          onKeyDown={(e) => e.key === 'Enter' && handleDownloadCsv()}
          className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-600 dark:text-blue-400">
              <Download className="size-5" />
            </div>
            <div className="text-start">
              <div className="text-body font-semibold text-ink">
                {t('download')}
              </div>
              <div className="text-caption text-ink-muted">
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
        <div className="flex items-center justify-between p-4 select-none">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400">
              <Users className="size-5" />
            </div>
            <div>
              <div className="text-body font-semibold text-ink">
                {t('family')}
              </div>
              <div className="text-caption text-ink-muted">
                ماما · بابا
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign out section */}
      <div className="bg-surface rounded-card border border-line/40 shadow-card">
        <button
          type="button"
          onClick={() => toast.info(t('signOut'))}
          className="w-full flex items-center justify-between p-4 text-start transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-expense-soft text-expense">
              <LogOut className="size-5 rtl:rotate-180" />
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

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronRight,
  FolderTree,
  Globe,
  LogOut,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';

export default function SettingsPage() {
  const t = useTranslations('settings');

  const navItems = [
    {
      href: '/settings',
      label: t('categories'),
      icon: FolderTree,
      color: 'text-accent',
      bgColor: 'bg-accent/12',
    },
    {
      href: '/settings',
      label: t('wallets'),
      icon: Wallet,
      color: 'text-income',
      bgColor: 'bg-income-soft',
    },
    {
      href: '/settings',
      label: t('family'),
      icon: Users,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-500/12',
    },
    {
      href: '/settings',
      label: t('language'),
      icon: Globe,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/12',
    },
    {
      href: '/settings/deleted',
      label: t('recentlyDeleted'),
      icon: Trash2,
      color: 'text-expense',
      bgColor: 'bg-expense-soft',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain px-5 py-3 pb-24">
      {/* iOS style inset grouped card */}
      <div className="bg-surface rounded-card border border-line/40 shadow-sm divide-y divide-line/30 overflow-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/40 active:bg-surface-2 select-none"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.bgColor} ${item.color}`}
                >
                  <Icon className="size-5" />
                </div>
                <span className="text-body font-semibold text-ink">
                  {item.label}
                </span>
              </div>
              <ChevronRight className="size-5 text-ink-muted rtl:rotate-180" />
            </Link>
          );
        })}
      </div>

      {/* Sign out section */}
      <div className="mt-6 bg-surface rounded-card border border-line/40 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => {}}
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

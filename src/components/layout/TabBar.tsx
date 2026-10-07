'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { History, Home, PieChart, Plus, Settings } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';

export function TabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { openAdd } = useEntrySheet();

  const tabs = [
    {
      href: '/',
      label: t('home'),
      icon: Home,
      isActive: pathname === '/' || pathname === '',
    },
    {
      href: '/history',
      label: t('history'),
      icon: History,
      isActive: pathname.startsWith('/history'),
    },
    {
      href: '/reports',
      label: t('reports'),
      icon: PieChart,
      isActive: pathname.startsWith('/reports'),
    },
    {
      href: '/settings',
      label: t('settings'),
      icon: Settings,
      isActive: pathname.startsWith('/settings'),
    },
  ];

  return (
    <nav
      aria-label="App navigation"
      className="shrink-0 border-t border-line bg-surface select-none pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab, i) => {
          const Icon = tab.icon;
          const active = tab.isActive;

          return (
            <React.Fragment key={tab.href}>
              {/* + sits in the middle of the bar, so it never covers an amount the way a floating button did */}
              {i === 2 && (
                <div className="flex flex-1 items-center justify-center">
                  <button
                    type="button"
                    aria-label={t('addEntry')}
                    onClick={() => openAdd()}
                    className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-ink shadow-card transition-transform active:scale-95 cursor-pointer"
                  >
                    <Plus className="size-7" strokeWidth={2.25} />
                  </button>
                </div>
              )}
              <Link
                href={tab.href}
                className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors ${
                  active ? 'text-accent font-semibold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icon className="size-6 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-caption leading-none tracking-tight whitespace-nowrap">{tab.label}</span>
              </Link>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { History, Home, PieChart, Settings } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

export function TabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

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
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.isActive;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors ${
                active ? 'text-accent font-semibold' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon className="size-6 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
              <span className="text-[13px] leading-none tracking-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

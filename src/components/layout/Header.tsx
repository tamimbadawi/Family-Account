'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Wallet } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

export function Header() {
  const tNav = useTranslations('nav');
  const tApp = useTranslations('app');
  const pathname = usePathname();

  // Sub-screens under /settings/ render their own unified header with back chevron
  if (pathname.startsWith('/settings/')) {
    return null;
  }

  const isHome = pathname === '/';

  let title = tApp('name');
  if (pathname.startsWith('/history')) {
    title = tNav('history');
  } else if (pathname.startsWith('/reports')) {
    title = tNav('reports');
  } else if (pathname.startsWith('/settings')) {
    title = tNav('settings');
  }

  return (
    <header className="shrink-0 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-2 select-none">
      <h1 className="text-title font-bold text-ink">{title}</h1>
      {isHome && (
        <Link
          href="/settings/wallets?from=home"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-xs -me-1 active:scale-95 transition-transform"
          aria-label={tNav('wallets')}
        >
          <Wallet className="size-6" />
        </Link>
      )}
    </header>
  );
}

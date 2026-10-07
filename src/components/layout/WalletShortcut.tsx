'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Wallet } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

// Top-corner shortcut to Settings → Wallets, shown on every screen.
// Passes the current path so the Wallets back chevron returns here.
export function WalletShortcut() {
  const tNav = useTranslations('nav');
  const pathname = usePathname();

  return (
    <Link
      href={`/settings/wallets?from=${encodeURIComponent(pathname)}`}
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-xs -me-1 active:scale-95 transition-transform"
      aria-label={tNav('wallets')}
    >
      <Wallet className="size-6" />
    </Link>
  );
}

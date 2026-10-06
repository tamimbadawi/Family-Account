'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Share, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches;
  const isDismissed = sessionStorage.getItem('dismiss_install_banner') === '1';
  return isIos && !isStandalone && !isDismissed;
}

function getServerSnapshot() {
  return false;
}

export function InstallBanner() {
  const t = useTranslations('install');
  const isEligible = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = React.useState(false);

  const show = isEligible && !dismissed;

  if (!show) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('dismiss_install_banner', '1');
    setDismissed(true);
  };

  return (
    <div className="relative mb-4 flex items-center justify-between gap-3 rounded-2xl bg-surface p-3.5 shadow-card border border-line">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Share className="size-5" />
        </div>
        <p className="text-caption font-medium text-ink leading-snug truncate">
          {t('bannerText')}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild size="sm" variant="secondary" className="h-9 px-3 text-caption font-semibold">
          <Link href="/install">{t('bannerAction')}</Link>
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

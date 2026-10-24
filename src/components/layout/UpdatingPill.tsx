'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useLiveSyncUpdating } from '@/lib/data/provider';

/**
 * A quiet pill near the top of the app shell, shown only when a pull
 * started by live sync takes longer than 600 ms, gone when it ends.
 * Absolute positioning: no layout shift, no toast, no dialog.
 */
export function UpdatingPill() {
  const isUpdating = useLiveSyncUpdating();
  const t = useTranslations('common');

  if (!isUpdating) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute top-[calc(max(env(safe-area-inset-top),0.5rem)+2.5rem)] left-1/2 z-50 -translate-x-1/2 rounded-pill bg-surface-2/95 backdrop-blur-sm px-3 py-1 text-caption font-medium text-ink-muted shadow-card border border-line motion-safe:transition-opacity motion-safe:duration-150"
    >
      {t('updating')}
    </div>
  );
}

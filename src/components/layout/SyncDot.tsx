'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useSyncStatus } from '@/lib/data/provider';

export function SyncDot() {
  const t = useTranslations('sync');
  const sync = useSyncStatus();

  const isPending = (sync?.pendingCount ?? 0) > 0 || sync?.status === 'syncing';
  const isOffline = sync?.status === 'offline';

  let dotClass = 'bg-income';
  let label = t('synced');

  if (isPending) {
    dotClass = 'border-2 border-ink-muted bg-transparent';
    label = t('pending', { count: sync?.pendingCount ?? 0 });
  } else if (isOffline) {
    dotClass = 'bg-warning';
    label = t('offline');
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-caption font-medium text-ink-muted shadow-xs select-none"
      title={label}
    >
      <span className={`size-2 shrink-0 rounded-full transition-colors ${dotClass}`} />
      <span className="text-caption leading-none">{label}</span>
    </div>
  );
}

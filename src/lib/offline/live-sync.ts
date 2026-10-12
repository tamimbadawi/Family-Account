'use client';

// =========================================================
// Live Sync  ·  Family Accounts (حساباتنا)
// Subscribes with Supabase Realtime (postgres_changes) to the signed-in
// person's household tables. On any event, debounces and asks for a pull()
// via the repository's refresh(). The pull stays the single way data enters the phone.
// =========================================================

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  LiveSyncScheduler,
  type RealtimeStatus,
} from './live-sync-scheduler';

export {
  LiveSyncScheduler,
  getBackoffDelay,
  DEBOUNCE_MS,
  UPDATING_THRESHOLD_MS,
  SAFETY_NET_INTERVAL_MS,
  BACKOFF_DELAYS_MS,
} from './live-sync-scheduler';

export type {
  LiveSyncSchedulerOptions,
  RealtimeStatus,
} from './live-sync-scheduler';

export const SYNCED_HOUSEHOLD_TABLES = [
  'accounts',
  'categories',
  'subcategories',
  'items',
  'transactions',
  'budgets',
  'recurring_rules',
  'savings_goals',
  'household_members',
] as const;

export interface StartLiveSyncParams {
  householdId: string;
  refresh: () => Promise<void>;
  onUpdatingChange?: (updating: boolean) => void;
}

/**
 * Starts live multi-device sync for the given household.
 * Returns a cleanup function that cleanly stops timers and unsubscribes.
 */
export function startLiveSync({
  householdId,
  refresh,
  onUpdatingChange,
}: StartLiveSyncParams): () => void {
  if (typeof window === 'undefined' || !householdId) {
    return () => {};
  }

  const client = getSupabaseBrowserClient();
  let channel: RealtimeChannel | null = null;
  let isStopped = false;

  const scheduler = new LiveSyncScheduler({
    runPull: refresh,
    onUpdatingChange,
    onResubscribe: () => {
      subscribeChannel();
    },
  });

  function subscribeChannel() {
    if (isStopped) return;

    if (channel) {
      void client.removeChannel(channel).catch(() => {});
      channel = null;
    }

    const newChannel = client.channel(`household:${householdId}:live-sync`);

    for (const table of SYNCED_HOUSEHOLD_TABLES) {
      newChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          scheduler.onEvent();
        }
      );
    }

    // households table uses `id` rather than `household_id`
    newChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'households',
        filter: `id=eq.${householdId}`,
      },
      () => {
        scheduler.onEvent();
      }
    );

    newChannel.subscribe((status, err) => {
      if (err) {
        console.warn('[live-sync] subscription status error', err);
      }
      scheduler.onChannelStatus(status as RealtimeStatus);
    });

    channel = newChannel;
  }

  // Initial subscription and start safety net
  subscribeChannel();
  scheduler.startSafetyNet();

  const onVisibilityChange = () => {
    scheduler.onVisibilityChange(document.visibilityState === 'visible');
  };
  const onOnline = () => {
    scheduler.onOnline(true);
  };
  const onOffline = () => {
    scheduler.onOnline(false);
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    isStopped = true;
    scheduler.stop();
    if (channel) {
      void client.removeChannel(channel).catch(() => {});
      channel = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

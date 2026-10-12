// Pure scheduling logic for Live Sync (no Supabase imports)
// Handles debouncing, trailing pulls, reconnect backoff, and 60s safety net.

export const DEBOUNCE_MS = 400;
export const UPDATING_THRESHOLD_MS = 600;
export const SAFETY_NET_INTERVAL_MS = 60_000;
export const BACKOFF_DELAYS_MS = [2_000, 5_000, 15_000, 30_000] as const;

export type RealtimeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

export function getBackoffDelay(attempt: number, delays: readonly number[] = BACKOFF_DELAYS_MS): number {
  if (attempt < 0) return delays[0] ?? 2_000;
  if (attempt >= delays.length) {
    return delays[delays.length - 1] ?? 30_000;
  }
  return delays[attempt] ?? 30_000;
}

export interface LiveSyncSchedulerOptions {
  runPull: () => Promise<void>;
  onUpdatingChange?: (updating: boolean) => void;
  onResubscribe?: () => void;
  debounceMs?: number;
  updatingThresholdMs?: number;
  safetyNetIntervalMs?: number;
  backoffDelays?: readonly number[];
}

export class LiveSyncScheduler {
  private isPulling = false;
  private hasTrailing = false;
  private isUpdating = false;
  private isStopped = false;

  private isVisible = true;
  private isOnline = true;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private updatingTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyNetTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private backoffAttempt = 0;

  private readonly debounceMs: number;
  private readonly updatingThresholdMs: number;
  private readonly safetyNetIntervalMs: number;
  private readonly backoffDelays: readonly number[];

  constructor(private readonly options: LiveSyncSchedulerOptions) {
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS;
    this.updatingThresholdMs = options.updatingThresholdMs ?? UPDATING_THRESHOLD_MS;
    this.safetyNetIntervalMs = options.safetyNetIntervalMs ?? SAFETY_NET_INTERVAL_MS;
    this.backoffDelays = options.backoffDelays ?? BACKOFF_DELAYS_MS;
  }

  /** Called on any realtime event from postgres_changes. */
  onEvent(): void {
    if (this.isStopped) return;

    if (this.isPulling) {
      this.hasTrailing = true;
      return;
    }

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.executePull();
    }, this.debounceMs);
  }

  /** Directly triggers a pull (e.g. after resubscribing or on safety net). */
  triggerPullNow(): void {
    if (this.isStopped) return;

    if (this.isPulling) {
      this.hasTrailing = true;
      return;
    }

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    void this.executePull();
  }

  private async executePull(): Promise<void> {
    if (this.isStopped || this.isPulling) return;
    this.isPulling = true;

    // Start 600 ms timer for Updating... pill
    this.clearUpdatingTimer();
    this.updatingTimer = setTimeout(() => {
      if (this.isPulling && !this.isStopped) {
        this.isUpdating = true;
        this.options.onUpdatingChange?.(true);
      }
    }, this.updatingThresholdMs);

    try {
      await this.options.runPull();
    } catch (err) {
      console.warn('[live-sync] pull failed', err);
    } finally {
      this.clearUpdating();
      this.isPulling = false;

      // Check trailing pull
      if (this.hasTrailing && !this.isStopped) {
        this.hasTrailing = false;
        void this.executePull();
      }
    }
  }

  private clearUpdating(): void {
    this.clearUpdatingTimer();
    if (this.isUpdating) {
      this.isUpdating = false;
      this.options.onUpdatingChange?.(false);
    }
  }

  private clearUpdatingTimer(): void {
    if (this.updatingTimer !== null) {
      clearTimeout(this.updatingTimer);
      this.updatingTimer = null;
    }
  }

  /** Called when Supabase channel status changes. */
  onChannelStatus(status: RealtimeStatus): void {
    if (this.isStopped) return;

    if (status === 'SUBSCRIBED') {
      this.backoffAttempt = 0;
      this.clearReconnectTimer();
      // Run one pull once SUBSCRIBED again
      this.triggerPullNow();
      return;
    }

    if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isStopped || this.reconnectTimer !== null) return;

    const delay = getBackoffDelay(this.backoffAttempt, this.backoffDelays);
    this.backoffAttempt++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isStopped) {
        this.options.onResubscribe?.();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Handles page visibility changes. */
  onVisibilityChange(visible: boolean): void {
    if (this.isStopped) return;
    this.isVisible = visible;

    if (visible) {
      this.startSafetyNet();
      this.options.onResubscribe?.();
    } else {
      this.stopSafetyNet();
    }
  }

  /** Handles network online / offline changes. */
  onOnline(online: boolean): void {
    if (this.isStopped) return;
    this.isOnline = online;

    if (online) {
      if (this.isVisible) {
        this.startSafetyNet();
      }
      this.options.onResubscribe?.();
    } else {
      this.stopSafetyNet();
    }
  }

  /** Starts the 60 second safety net interval if visible and online. */
  startSafetyNet(): void {
    this.stopSafetyNet();
    if (!this.isVisible || !this.isOnline || this.isStopped) return;

    this.safetyNetTimer = setInterval(() => {
      if (this.isVisible && this.isOnline && !this.isStopped) {
        this.triggerPullNow();
      }
    }, this.safetyNetIntervalMs);
  }

  /** Pauses the safety net timer. */
  stopSafetyNet(): void {
    if (this.safetyNetTimer !== null) {
      clearInterval(this.safetyNetTimer);
      this.safetyNetTimer = null;
    }
  }

  /** Clean stop: cancels all timers, clears updating state, marks stopped. */
  stop(): void {
    this.isStopped = true;

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.clearUpdating();
    this.stopSafetyNet();
    this.clearReconnectTimer();

    this.isPulling = false;
    this.hasTrailing = false;
  }
}

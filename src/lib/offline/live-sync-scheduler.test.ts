import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LiveSyncScheduler,
  getBackoffDelay,
  DEBOUNCE_MS,
  SAFETY_NET_INTERVAL_MS,
} from './live-sync-scheduler';

describe('LiveSyncScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates backoff delays according to the sequence 2s, 5s, 15s, 30s', () => {
    expect(getBackoffDelay(0)).toBe(2_000);
    expect(getBackoffDelay(1)).toBe(5_000);
    expect(getBackoffDelay(2)).toBe(15_000);
    expect(getBackoffDelay(3)).toBe(30_000);
    expect(getBackoffDelay(4)).toBe(30_000);
    expect(getBackoffDelay(100)).toBe(30_000);
    expect(getBackoffDelay(-1)).toBe(2_000);
  });

  it('a burst gives one pull', async () => {
    const runPull = vi.fn().mockResolvedValue(undefined);
    const scheduler = new LiveSyncScheduler({ runPull });

    // Rapid burst of 5 events within 200ms
    scheduler.onEvent();
    vi.advanceTimersByTime(50);
    scheduler.onEvent();
    vi.advanceTimersByTime(50);
    scheduler.onEvent();
    vi.advanceTimersByTime(50);
    scheduler.onEvent();
    vi.advanceTimersByTime(50);
    scheduler.onEvent();

    expect(runPull).not.toHaveBeenCalled();

    // Advance 400ms after the last event in the burst
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(runPull).toHaveBeenCalledTimes(1);

    // No extra pull runs afterwards
    await vi.advanceTimersByTimeAsync(1000);
    expect(runPull).toHaveBeenCalledTimes(1);
  });

  it('an event during a pull gives exactly one trailing pull', async () => {
    let resolvePull: () => void = () => {};
    const runPull = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePull = resolve;
      });
    });

    const scheduler = new LiveSyncScheduler({ runPull });

    scheduler.onEvent();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(runPull).toHaveBeenCalledTimes(1);

    // While pull 1 is in progress, multiple events arrive
    scheduler.onEvent();
    scheduler.onEvent();
    scheduler.onEvent();

    expect(runPull).toHaveBeenCalledTimes(1);

    // Resolve pull 1
    resolvePull();
    await Promise.resolve();

    // Trailing pull executes immediately
    expect(runPull).toHaveBeenCalledTimes(2);

    // Resolve trailing pull
    resolvePull();
    await Promise.resolve();

    // Advance time to confirm no further pulls execute
    await vi.advanceTimersByTimeAsync(2000);
    expect(runPull).toHaveBeenCalledTimes(2);
  });

  it('never runs pulls in parallel', async () => {
    let resolvePull: () => void = () => {};
    let activePulls = 0;
    let maxParallelPulls = 0;

    const runPull = vi.fn().mockImplementation(async () => {
      activePulls++;
      maxParallelPulls = Math.max(maxParallelPulls, activePulls);
      await new Promise<void>((resolve) => {
        resolvePull = resolve;
      });
      activePulls--;
    });

    const scheduler = new LiveSyncScheduler({ runPull });

    scheduler.onEvent();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    scheduler.onEvent();
    scheduler.triggerPullNow();

    resolvePull();
    await Promise.resolve();

    resolvePull();
    await Promise.resolve();

    expect(maxParallelPulls).toBe(1);
  });

  it('the backoff sequence: resubscribes with backoff on error and resets on SUBSCRIBED', async () => {
    const runPull = vi.fn().mockResolvedValue(undefined);
    const onResubscribe = vi.fn();
    const scheduler = new LiveSyncScheduler({ runPull, onResubscribe });

    // 1st error -> waits 2s
    scheduler.onChannelStatus('CHANNEL_ERROR');
    await vi.advanceTimersByTimeAsync(1999);
    expect(onResubscribe).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onResubscribe).toHaveBeenCalledTimes(1);

    // 2nd error -> waits 5s
    scheduler.onChannelStatus('TIMED_OUT');
    await vi.advanceTimersByTimeAsync(4999);
    expect(onResubscribe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(onResubscribe).toHaveBeenCalledTimes(2);

    // 3rd error -> waits 15s
    scheduler.onChannelStatus('CLOSED');
    await vi.advanceTimersByTimeAsync(14999);
    expect(onResubscribe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(onResubscribe).toHaveBeenCalledTimes(3);

    // 4th error -> waits 30s
    scheduler.onChannelStatus('CHANNEL_ERROR');
    await vi.advanceTimersByTimeAsync(29999);
    expect(onResubscribe).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(onResubscribe).toHaveBeenCalledTimes(4);

    // 5th error -> stays capped at 30s
    scheduler.onChannelStatus('CHANNEL_ERROR');
    await vi.advanceTimersByTimeAsync(29999);
    expect(onResubscribe).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(onResubscribe).toHaveBeenCalledTimes(5);

    // Channel connects -> SUBSCRIBED resets backoff and runs one pull
    scheduler.onChannelStatus('SUBSCRIBED');
    expect(runPull).toHaveBeenCalledTimes(1);

    // Next error begins at 2s again
    scheduler.onChannelStatus('CHANNEL_ERROR');
    await vi.advanceTimersByTimeAsync(1999);
    expect(onResubscribe).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(1);
    expect(onResubscribe).toHaveBeenCalledTimes(6);
  });

  it('resubscribes when the page becomes visible or connection returns', async () => {
    const runPull = vi.fn().mockResolvedValue(undefined);
    const onResubscribe = vi.fn();
    const scheduler = new LiveSyncScheduler({ runPull, onResubscribe });

    scheduler.onVisibilityChange(true);
    expect(onResubscribe).toHaveBeenCalledTimes(1);

    scheduler.onOnline(true);
    expect(onResubscribe).toHaveBeenCalledTimes(2);
  });

  it('the 60 s timer pauses when hidden', async () => {
    const runPull = vi.fn().mockResolvedValue(undefined);
    const scheduler = new LiveSyncScheduler({ runPull });
    scheduler.startSafetyNet();

    // After 60s visible & online -> 1 pull
    await vi.advanceTimersByTimeAsync(SAFETY_NET_INTERVAL_MS);
    expect(runPull).toHaveBeenCalledTimes(1);

    // Page hidden -> safety net paused
    scheduler.onVisibilityChange(false);
    await vi.advanceTimersByTimeAsync(SAFETY_NET_INTERVAL_MS * 3);
    expect(runPull).toHaveBeenCalledTimes(1);

    // Page visible again -> safety net resumes
    scheduler.onVisibilityChange(true);
    await vi.advanceTimersByTimeAsync(SAFETY_NET_INTERVAL_MS);
    expect(runPull).toHaveBeenCalledTimes(2);
  });

  it('pauses safety net when offline', async () => {
    const runPull = vi.fn().mockResolvedValue(undefined);
    const scheduler = new LiveSyncScheduler({ runPull });
    scheduler.startSafetyNet();

    scheduler.onOnline(false);
    await vi.advanceTimersByTimeAsync(SAFETY_NET_INTERVAL_MS * 2);
    expect(runPull).not.toHaveBeenCalled();

    scheduler.onOnline(true);
    await vi.advanceTimersByTimeAsync(SAFETY_NET_INTERVAL_MS);
    expect(runPull).toHaveBeenCalledTimes(1);
  });

  it('shows updating pill only when pull exceeds 600ms, gone when it ends', async () => {
    let resolvePull: () => void = () => {};
    const runPull = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePull = resolve;
      });
    });
    const onUpdatingChange = vi.fn();
    const scheduler = new LiveSyncScheduler({ runPull, onUpdatingChange });

    scheduler.onEvent();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS); // pull starts
    expect(runPull).toHaveBeenCalledTimes(1);
    expect(onUpdatingChange).not.toHaveBeenCalled();

    // Advance 550ms into the pull (<600ms)
    await vi.advanceTimersByTimeAsync(550);
    expect(onUpdatingChange).not.toHaveBeenCalled();

    // Advance past 600ms threshold
    await vi.advanceTimersByTimeAsync(60);
    expect(onUpdatingChange).toHaveBeenCalledWith(true);

    // Pull finishes
    resolvePull();
    await Promise.resolve();
    expect(onUpdatingChange).toHaveBeenCalledWith(false);
  });

  it('does not show updating pill if pull finishes before 600ms', async () => {
    let resolvePull: () => void = () => {};
    const runPull = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePull = resolve;
      });
    });
    const onUpdatingChange = vi.fn();
    const scheduler = new LiveSyncScheduler({ runPull, onUpdatingChange });

    scheduler.onEvent();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS); // pull starts
    await vi.advanceTimersByTimeAsync(300); // 300ms < 600ms
    resolvePull();
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(1000);
    expect(onUpdatingChange).not.toHaveBeenCalled();
  });

  it('stop cancels everything', async () => {
    const runPull = vi.fn().mockResolvedValue(undefined);
    const onResubscribe = vi.fn();
    const onUpdatingChange = vi.fn();
    const scheduler = new LiveSyncScheduler({ runPull, onResubscribe, onUpdatingChange });
    scheduler.startSafetyNet();

    scheduler.onEvent();
    scheduler.onChannelStatus('CHANNEL_ERROR');

    scheduler.stop();

    await vi.advanceTimersByTimeAsync(120_000);
    expect(runPull).not.toHaveBeenCalled();
    expect(onResubscribe).not.toHaveBeenCalled();
    expect(onUpdatingChange).not.toHaveBeenCalled();
  });
});

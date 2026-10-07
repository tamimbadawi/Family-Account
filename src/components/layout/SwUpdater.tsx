'use client';

import * as React from 'react';
import { whenIdle } from '@/lib/busy';

// Keeps installed copies current: checks for a new service worker whenever
// the app comes back to the screen, and reloads once when a new one takes
// over (sw.ts uses skipWaiting + clientsClaim), so the family never sits
// on an old version after a deploy.
export function SwUpdater() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    const sw = navigator.serviceWorker;
    // First install also fires controllerchange; only reload on a real update.
    const hadController = Boolean(sw.controller);
    let reloading = false;

    // Never mid-entry: an open entry (or the camera app on top of it) waits until it is saved or closed
    const reloadWhenIdle = () => {
      if (reloading) return;
      reloading = true;
      whenIdle(() => window.location.reload());
    };
    const onControllerChange = () => {
      if (hadController) reloadWhenIdle();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'new-version') reloadWhenIdle();
    };

    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') return;
      sw.getRegistration()
        .then((reg) => reg?.update())
        .catch(() => {});
    };

    sw.addEventListener('controllerchange', onControllerChange);
    sw.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', checkForUpdate);
    checkForUpdate();

    return () => {
      sw.removeEventListener('controllerchange', onControllerChange);
      sw.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', checkForUpdate);
    };
  }, []);

  return null;
}

'use client';

import * as React from 'react';

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

    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };

    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') return;
      sw.getRegistration()
        .then((reg) => reg?.update())
        .catch(() => {});
    };

    sw.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', checkForUpdate);
    checkForUpdate();

    return () => {
      sw.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', checkForUpdate);
    };
  }, []);

  return null;
}

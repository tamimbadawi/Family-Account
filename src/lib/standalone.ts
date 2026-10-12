'use client';

import * as React from 'react';

/** True when the app was opened from the Home Screen icon (installed), not inside Safari or Chrome. */
export function isRunningInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  } catch {
    return false;
  }
}

const subscribeNever = () => () => {};

/** For screens: true once we know the app is still open in the browser (so it can be installed). */
export function useCanInstall(): boolean {
  return React.useSyncExternalStore(subscribeNever, () => !isRunningInstalled(), () => false);
}

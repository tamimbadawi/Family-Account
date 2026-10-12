'use client';

import * as React from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** True when the app was opened from the Home Screen icon (installed), not inside Safari or Chrome. */
export function isRunningInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches
    );
  } catch {
    return false;
  }
}

// Android Chrome offers its own install popup once per page load, often before Settings is open,
// so it is kept here from the moment the app loads (this module is imported by the app layout).
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For screens: true while the app is still open in the browser (Safari or Chrome), so it can be installed. */
export function useCanInstall(): boolean {
  return React.useSyncExternalStore(subscribe, () => !installed && !isRunningInstalled(), () => false);
}

/**
 * Opens Android's own "Install app" popup when the browser offers one.
 * Returns false when there is none (iPhone, or the browser has not offered it), so the caller shows the steps instead.
 */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  deferredPrompt = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') {
      installed = true;
      notify();
    }
    return true;
  } catch {
    return false;
  }
}

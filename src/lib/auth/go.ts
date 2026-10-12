/**
 * Moves on after signing in, joining or signing out with a full page load.
 * A soft move by the router could leave the person on the same screen (seen on Android on
 * 2026-10-12: the server had signed them in, the screen stayed on sign-in), so these moves
 * always load the page afresh; the server then decides with the new session.
 */
export function goAfterAuth(locale: string, route: string): void {
  window.location.replace(`/${locale}${route === '/' ? '' : route}`);
}

/**
 * Right after signing in: forget whatever copy of a family is on this phone, so the whole
 * household is downloaded afresh for the person who just signed in. Never waits more than 3 s.
 */
export async function startFresh(): Promise<void> {
  const { db } = await import('@/lib/offline/db');
  const { clearLocalCopy } = await import('@/lib/offline/sync');
  await Promise.race([
    clearLocalCopy(db).catch((err) => console.warn('[sign-in] could not clear the copy', err)),
    new Promise((done) => setTimeout(done, 3000)),
  ]);
}
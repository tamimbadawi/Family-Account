/**
 * Moves on after signing in, joining or signing out with a full page load.
 * A soft move by the router could leave the person on the same screen (seen on Android on
 * 2026-10-12: the server had signed them in, the screen stayed on sign-in), so these moves
 * always load the page afresh; the server then decides with the new session.
 */
export function goAfterAuth(locale: string, route: string): void {
  window.location.replace(`/${locale}${route === '/' ? '' : route}`);
}
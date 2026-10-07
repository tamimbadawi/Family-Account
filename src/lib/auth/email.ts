// Everyone signs in with their own email (docs/MULTI-FAMILY.md). The email is only for signing in;
// the app shows the name the family admin typed when adding the person.

/** " Injy@Gmail.com " -> "injy@gmail.com". Emails are case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Loose check before calling the server (which checks again). */
export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

/** Logins made before email sign-in (2026-10-07) use a private address on this domain, e.g. injy@family.local. */
export const LEGACY_DOMAIN = 'family.local';

/**
 * What the Login screen sends to Supabase: an email as typed, or for the first family's older logins
 * a plain username ("Injy" -> "injy@family.local"), so they keep signing in exactly as before.
 */
export function toLoginEmail(input: string): string {
  const typed = normalizeEmail(input);
  return typed.includes('@') ? typed : `${typed}@${LEGACY_DOMAIN}`;
}

/** What to show for a login: the email, or just the username for an older family.local login. */
export function loginLabel(email: string | null | undefined): string {
  if (!email) return '';
  return email.endsWith(`@${LEGACY_DOMAIN}`) ? email.slice(0, -LEGACY_DOMAIN.length - 1) : email;
}

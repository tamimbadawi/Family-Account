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

// Family members sign in with a username, never an email. Supabase Auth needs an email,
// so each username maps to a private address on a domain nobody receives mail for.
export const USERNAME_DOMAIN = 'family.local';

/** "INJY " -> "injy@family.local". Usernames are case-insensitive. */
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
}

/** Lower-case, no spaces: what is stored and compared. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, '');
}

/** "injy@family.local" -> "injy" (for showing a member's username). */
export function emailToUsername(email: string | null | undefined): string {
  if (!email) return '';
  const at = email.lastIndexOf('@');
  return at === -1 ? email : email.slice(0, at);
}

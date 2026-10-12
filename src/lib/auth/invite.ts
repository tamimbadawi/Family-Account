// Sending someone the app: the iPhone share sheet (Messages, WhatsApp, Mail…) with a short message and the
// sign-in link. Where there is no share sheet, the message is copied so they can paste it themselves.

export type InviteResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** The sign-in page in the inviter's language, e.g. "https://app.example/en/login". */
export function inviteLink(origin: string, locale: string): string {
  return `${origin.replace(/\/+$/, '')}/${locale}/login`;
}

/** The family member invite link: the code rides after the # so it never reaches a server in link previews. */
export function joinLink(origin: string, locale: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/${locale}/join#code=${encodeURIComponent(code)}`;
}

/** The 24-hour new family invite link: the code rides after the # so it never reaches a server in link previews. */
export function familyInviteLink(origin: string, locale: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/${locale}/join#invite=${encodeURIComponent(code)}`;
}

/** The token/code from an invite link's "#invite=...", "#code=...", or legacy "#t=..." part, or null when there is none. */
export function joinToken(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('invite') || params.get('code') || params.get('t') || null;
}

export async function sendInvite(title: string, text: string, url: string): Promise<InviteResult> {
  if (typeof navigator === 'undefined') return 'failed';
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      // Closing the share sheet is not an error: leave it quietly
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

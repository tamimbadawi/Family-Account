// Sending someone the app: the iPhone share sheet (Messages, WhatsApp, Mail…) with a short message and the
// sign-in link. Where there is no share sheet, the message is copied so they can paste it themselves.

export type InviteResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** The sign-in page in the inviter's language, e.g. "https://app.example/en/login". */
export function inviteLink(origin: string, locale: string): string {
  return `${origin.replace(/\/+$/, '')}/${locale}/login`;
}

/** One person's own link: the one-time token rides after the #, so it never reaches a server or a link preview. */
export function joinLink(origin: string, locale: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/${locale}/join#t=${encodeURIComponent(token)}`;
}

/** The token from a personal link's "#t=..." part, or null when there is none. */
export function joinToken(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('t') || null;
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

// Contacting support: the iPhone share sheet (Mail, WhatsApp, Messages…) with the message and any photos.
// Where photos can't be shared that way, Mail opens with the message filled in (photos can't ride a mailto link).

export type SupportResult = 'shared' | 'mailed' | 'cancelled' | 'failed';

/** Support address from NEXT_PUBLIC_SUPPORT_EMAIL; empty when not set. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? '';

export const MAX_SUPPORT_PHOTOS = 3;

/** Parts of the app the problem can be about (labels in messages/<locale>/settings.json → supportSection). */
export const SUPPORT_SECTIONS = [
  'home',
  'addEntry',
  'history',
  'reports',
  'wallets',
  'categories',
  'budgets',
  'family',
  'signIn',
  'other',
] as const;

export type SupportSection = (typeof SUPPORT_SECTIONS)[number];

export function supportMailto(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function photoFiles(photos: Blob[]): File[] {
  return photos.map((blob, i) => {
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `photo-${i + 1}.${ext}`, { type: blob.type || 'image/jpeg' });
  });
}

export async function sendSupportMessage(subject: string, body: string, photos: Blob[]): Promise<SupportResult> {
  if (typeof navigator === 'undefined') return 'failed';
  const files = photoFiles(photos);
  const data: ShareData = { title: subject, text: body };
  if (files.length) data.files = files;

  const canShare =
    typeof navigator.share === 'function' && (!files.length || navigator.canShare?.({ files }) === true);
  if (canShare) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      // Closing the share sheet is not an error: leave it quietly
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  if (!SUPPORT_EMAIL) return 'failed';
  window.location.href = supportMailto(SUPPORT_EMAIL, subject, body);
  return 'mailed';
}

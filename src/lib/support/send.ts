// Contacting support: the message, the part of the app and up to 3 photos are saved in the database
// (0016_support_messages.sql); the person who runs the app reads them on /operator.
// Photos go to the private `support` bucket first, then the message points at them.
// In sample-data mode there is no server, so the message is only pretended to be sent.
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';
import { OfflineError } from '@/lib/data/errors';

export const MAX_SUPPORT_PHOTOS = 3;
export const SUPPORT_BUCKET = 'support';

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

export interface SupportMessage {
  section: SupportSection | '';
  message: string;
  photos: Blob[];
  locale: string;
}

/** Storage path of photo n (1-based) of a message: <user_id>/<message_id>/<n>.<ext>. */
export function supportPhotoPath(userId: string, messageId: string, n: number, blob: Blob): string {
  return `${userId}/${messageId}/${n}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
}

const NETWORK = /failed to fetch|network|load failed|fetch failed|timed? ?out|aborted/i;

/** Saves the message. Throws OfflineError with no connection, Error('too_many') or Error('failed'). */
export async function sendSupportMessage({ section, message, photos, locale }: SupportMessage): Promise<void> {
  if (!isAuthConfigured()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OfflineError();

  const client = getSupabaseBrowserClient();
  try {
    const { data } = await client.auth.getUser();
    const userId = data.user?.id;
    if (!userId) throw new Error('failed');

    const id = crypto.randomUUID();
    const paths: string[] = [];
    for (const [i, blob] of photos.slice(0, MAX_SUPPORT_PHOTOS).entries()) {
      const path = supportPhotoPath(userId, id, i + 1, blob);
      const { error } = await client.storage
        .from(SUPPORT_BUCKET)
        .upload(path, blob, { contentType: blob.type || 'image/jpeg' });
      if (error) throw error;
      paths.push(path);
    }

    const { error } = await client.rpc('send_support_message', {
      p_id: id,
      p_section: section,
      p_message: message.trim(),
      p_photo_paths: paths,
      p_locale: locale,
    });
    if (error) throw new Error(error.message === 'too_many' ? 'too_many' : 'failed');
  } catch (err) {
    const msg = String((err as { message?: unknown })?.message ?? '');
    if (NETWORK.test(msg)) throw new OfflineError();
    throw err instanceof Error && msg === 'too_many' ? err : new Error('failed');
  }
}

// Who added an entry: a stable colour slot and an initial per family member.
import type { Member } from '@/lib/data/types';

export const MEMBER_SLOTS = 4;

/**
 * Members in a stable order (joined first, then by id), so each person keeps the same
 * colour on every phone and the owner (who creates the household) is always slot 0.
 */
export function orderMembers(members: readonly Member[]): Member[] {
  return [...members].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.userId.localeCompare(b.userId)
  );
}

/** Colour slot 0..MEMBER_SLOTS-1 for a user, or null when the user is unknown. */
export function memberSlot(userId: string | null | undefined, members: readonly Member[]): number | null {
  if (!userId) return null;
  const index = orderMembers(members).findIndex((m) => m.userId === userId);
  return index < 0 ? null : index % MEMBER_SLOTS;
}

/** Family member names are written in English letters (decided 2026-10-06), e.g. "Mama", "Injy". */
export const ENGLISH_NAME = /^[A-Za-z][A-Za-z .'-]{0,29}$/;

export function isEnglishName(name: string): boolean {
  return ENGLISH_NAME.test(name.trim());
}

/** First visible letter of a name ("ماما" → "م", "injy" → "I"); "?" when empty. */
export function memberInitial(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const first = Array.from(trimmed)[0];
  return first.toLocaleUpperCase();
}

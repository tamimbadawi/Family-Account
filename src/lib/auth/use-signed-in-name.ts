'use client';

import { useCurrentUserId, useHouseholdMembers } from '@/lib/data/provider';
import { isAuthConfigured } from '@/lib/supabase/client';

/**
 * The signed-in person's own name from the household (e.g. "Injy").
 * undefined while members are still empty, null when sign-in isn't configured (local sample-data mode),
 * otherwise the name.
 */
export function useSignedInName(): string | null | undefined {
  const live = isAuthConfigured();
  const members = useHouseholdMembers();
  const currentUserId = useCurrentUserId();

  if (!live) return null;
  if (members.length === 0) return undefined;
  const member = members.find((m) => m.userId === currentUserId);
  return member?.displayName ?? '';
}

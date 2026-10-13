'use client';

import * as React from 'react';
import { useCurrentUserId, useHouseholdMembers } from '@/lib/data/provider';
import type { Member } from '@/lib/data/types';
import { isAuthConfigured } from '@/lib/supabase/client';

export interface FamilyMemberName {
  userId: string;
  displayName: string;
}

// ---- Public hooks -------------------------------------------------------------------------

/**
 * Returns the signed-in user's ID on this phone (or null in sample-data mode / if not signed in).
 */
export function useMyUserId(): string | null {
  return useCurrentUserId();
}

/**
 * The people in the household. Sorted by createdAt.
 * In live mode these come from the phone's Dexie copy; in sample-data mode they are the sample members.
 */
export function useFamily(): Member[] {
  const members = useHouseholdMembers();
  return React.useMemo(() => {
    return [...members].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }, [members]);
}

export function useFamilyMembers(): FamilyMemberName[] {
  return useFamily().map((m) => ({ userId: m.userId, displayName: m.displayName }));
}

/**
 * Who added an entry. Entries still kept on the phone (sample data, before online saving) carry the
 * sample family's ids; with real sign-in those count as the signed-in person's, so the app says
 * "Added by Injy" instead of naming sample people.
 */
export function useEntryAuthor(): (createdBy: string | null | undefined) => Member | null {
  const family = useFamily();
  const myUserId = useCurrentUserId();
  const live = isAuthConfigured();

  return React.useCallback(
    (createdBy) => {
      if (!live) return family.find((m) => m.userId === createdBy) ?? null;
      if (family.length === 0) return null;
      return (
        family.find((m) => m.userId === createdBy) ??
        family.find((m) => m.userId === myUserId) ??
        null
      );
    },
    [live, family, myUserId]
  );
}

/**
 * Whether the signed-in person is the family admin (owner). In local sample-data mode, with no
 * sign-in, the phone's user counts as the admin. Undefined while the household is loading.
 */
export function useIsFamilyAdmin(): boolean | undefined {
  const live = isAuthConfigured();
  const family = useFamily();
  const myUserId = useCurrentUserId();

  if (!live) return true;
  if (family.length === 0) return undefined;
  return family.some((m) => m.userId === myUserId && m.role === 'owner');
}

'use client';

import * as React from 'react';
import { useHouseholdMembers } from '@/lib/data/provider';
import type { Member } from '@/lib/data/types';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';

export interface FamilyMemberName {
  userId: string;
  displayName: string;
}

// ---- The real household, loaded once per page and shared by every component -------------

interface RealFamily {
  members: Member[];
  me: string | null;
}

let family: RealFamily | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadFamily() {
  if (loading) return;
  loading = (async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    // Row-level security returns only the signed-in person's own household
    const { data } = await supabase
      .from('household_members')
      .select('household_id, user_id, display_name, role, locale, created_at')
      .order('created_at');
    family = {
      me: auth.user?.id ?? null,
      members: (data ?? []).map((r) => ({
        householdId: r.household_id,
        userId: r.user_id,
        displayName: r.display_name,
        role: r.role as Member['role'],
        locale: r.locale as Member['locale'],
        createdAt: r.created_at,
      })),
    };
    listeners.forEach((notify) => notify());
  })().catch(() => {
    loading = null; // try again next time a component asks
  });
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  loadFamily();
  return () => {
    listeners.delete(notify);
  };
}

/** The real household (null until loaded); always null in local sample-data mode. */
function useRealFamily(): RealFamily | null {
  const live = isAuthConfigured();
  return React.useSyncExternalStore(
    live ? subscribe : () => () => {},
    () => (live ? family : null),
    () => null
  );
}

// ---- Public hooks -------------------------------------------------------------------------

/**
 * The people in the household. With real sign-in these are the real accounts (Injy and whoever she
 * adds); only in local sample-data mode do they fall back to the sample family (Mama, Baba).
 */
export function useFamily(): Member[] {
  const sample = useHouseholdMembers();
  const real = useRealFamily();
  return isAuthConfigured() ? (real?.members ?? []) : sample;
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
  const sample = useHouseholdMembers();
  const real = useRealFamily();
  const live = isAuthConfigured();
  return React.useCallback(
    (createdBy) => {
      if (!live) return sample.find((m) => m.userId === createdBy) ?? null;
      if (!real) return null;
      return (
        real.members.find((m) => m.userId === createdBy) ??
        real.members.find((m) => m.userId === real.me) ??
        null
      );
    },
    [live, sample, real]
  );
}

/**
 * Whether the signed-in person is the family admin (owner). In local sample-data mode, with no
 * sign-in, the phone's user counts as the admin. Undefined while the household is loading.
 */
export function useIsFamilyAdmin(): boolean | undefined {
  const real = useRealFamily();
  if (!isAuthConfigured()) return true;
  if (!real) return undefined;
  return real.members.some((m) => m.userId === real.me && m.role === 'owner');
}

'use client';

import * as React from 'react';
import { useHouseholdMembers } from '@/lib/data/provider';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';

export interface FamilyMemberName {
  userId: string;
  displayName: string;
}

/**
 * The people in the household. With real sign-in these are the real accounts (Injy and whoever she
 * adds); only in local sample-data mode do they fall back to the sample family (Mama, Baba).
 */
export function useFamilyMembers(): FamilyMemberName[] {
  const live = isAuthConfigured();
  const sample = useHouseholdMembers();
  const [real, setReal] = React.useState<FamilyMemberName[]>([]);

  React.useEffect(() => {
    if (!live) return;
    let cancelled = false;
    // Row-level security returns only the signed-in person's own household
    getSupabaseBrowserClient()
      .from('household_members')
      .select('user_id, display_name')
      .order('created_at')
      .then(({ data }) => {
        if (!cancelled && data) setReal(data.map((r) => ({ userId: r.user_id, displayName: r.display_name })));
      });
    return () => {
      cancelled = true;
    };
  }, [live]);

  return live ? real : sample.map((m) => ({ userId: m.userId, displayName: m.displayName }));
}

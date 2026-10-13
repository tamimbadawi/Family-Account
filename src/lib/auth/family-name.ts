'use client';

import * as React from 'react';
import { useHousehold } from '@/lib/data/provider';
import { db } from '@/lib/offline/db';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';

export const FAMILY_NAME_MAX = 60;

/**
 * The family's name and a way for its admin to change it (Settings → Family).
 * Reads from useHousehold() in both modes.
 */
export function useFamilyName(): { name: string | null; rename: (next: string) => Promise<void> } {
  const live = isAuthConfigured();
  const household = useHousehold();

  const rename = React.useCallback(
    async (next: string) => {
      const name = next.trim().slice(0, FAMILY_NAME_MAX);
      if (!name) throw new Error('no_family_name');
      if (!household) throw new Error('failed');
      if (live) {
        const { error } = await getSupabaseBrowserClient().from('households').update({ name }).eq('id', household.id);
        if (error) throw new Error('failed');
      }
      await db.households.update(household.id, { name });
    },
    [live, household]
  );

  return { name: household?.name ?? null, rename };
}

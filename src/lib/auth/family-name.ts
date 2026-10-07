'use client';

import * as React from 'react';
import { useHousehold } from '@/lib/data/provider';
import { db } from '@/lib/offline/db';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';

export const FAMILY_NAME_MAX = 60;

/**
 * The family's name and a way for its admin to change it (Settings → Family).
 * With real sign-in it is the household row the signed-in person belongs to (RLS returns only
 * theirs); in sample-data mode it is the household kept on the phone.
 */
export function useFamilyName(): { name: string | null; rename: (next: string) => Promise<void> } {
  const live = isAuthConfigured();
  const sample = useHousehold();
  const [real, setReal] = React.useState<{ id: string; name: string } | null>(null);

  React.useEffect(() => {
    if (!live) return;
    let cancelled = false;
    getSupabaseBrowserClient()
      .from('households')
      .select('id, name')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setReal(data);
      });
    return () => {
      cancelled = true;
    };
  }, [live]);

  const rename = React.useCallback(
    async (next: string) => {
      const name = next.trim().slice(0, FAMILY_NAME_MAX);
      if (!name) throw new Error('no_family_name');
      if (!live) {
        if (sample) await db.households.update(sample.id, { name });
        return;
      }
      if (!real) throw new Error('failed');
      const { error } = await getSupabaseBrowserClient().from('households').update({ name }).eq('id', real.id);
      if (error) throw new Error('failed');
      setReal({ ...real, name });
    },
    [live, real, sample]
  );

  return { name: live ? (real?.name ?? null) : (sample?.name ?? null), rename };
}

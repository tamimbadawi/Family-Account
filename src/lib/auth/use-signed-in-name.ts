'use client';

import * as React from 'react';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';

/**
 * The signed-in person's own name from the household (e.g. "Injy").
 * undefined while loading, null when sign-in isn't configured (local sample-data mode).
 */
export function useSignedInName(): string | null | undefined {
  const [name, setName] = React.useState<string | null | undefined>(isAuthConfigured() ? undefined : null);

  React.useEffect(() => {
    if (!isAuthConfigured()) return;
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase
        .from('household_members')
        .select('display_name')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (!cancelled) setName(row?.display_name ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return name;
}

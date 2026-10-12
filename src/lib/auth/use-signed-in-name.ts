'use client';

import * as React from 'react';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';
import { getLocalSession } from './local-auth';

/**
 * The signed-in person's own name from the household (e.g. "Injy").
 * undefined while loading, null when not signed in.
 */
export function useSignedInName(): string | null | undefined {
  const [name, setName] = React.useState<string | null | undefined>(() => {
    if (isAuthConfigured()) return undefined;
    return getLocalSession()?.displayName ?? null;
  });

  React.useEffect(() => {
    if (!isAuthConfigured()) {
      const update = () => {
        setName(getLocalSession()?.displayName ?? null);
      };
      update();
      window.addEventListener('storage', update);
      window.addEventListener('local-session-change', update);
      return () => {
        window.removeEventListener('storage', update);
        window.removeEventListener('local-session-change', update);
      };
    }

    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        if (!cancelled) setName(null);
        return;
      }
      const { data: row } = await supabase
        .from('household_members')
        .select('display_name')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (!cancelled) setName(row?.display_name ?? '');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setName(null);
        return;
      }
      const { data: row } = await supabase
        .from('household_members')
        .select('display_name')
        .eq('user_id', session.user.id)
        .maybeSingle();
      setName(row?.display_name ?? '');
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return name;
}

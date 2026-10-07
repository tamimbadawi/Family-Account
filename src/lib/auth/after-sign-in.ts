import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Where a person goes right after signing in:
 * a temporary password must be replaced first, then a new owner names the household, else Home.
 */
export async function routeAfterSignIn(user: User): Promise<'/choose-password' | '/welcome' | '/'> {
  if (user.user_metadata?.must_change_password) return '/choose-password';
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1);
  return data && data.length > 0 ? '/' : '/welcome';
}

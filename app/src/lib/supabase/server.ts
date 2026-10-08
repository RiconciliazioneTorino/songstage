import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  /**
   * `@supabase/ssr` 0.5.2 predates the current postgrest-js generics, so its
   * `createServerClient<Database>` loses the schema and every query infers
   * `never`. The runtime object is a normal SupabaseClient, so we restate that.
   * Drop the assertion once @supabase/ssr is upgraded (it needs supabase-js
   * >= 2.114, so it's a deliberate bump, not a drive-by).
   */
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component — ignore; middleware refreshes the session
          }
        },
      },
    }
  ) as unknown as SupabaseClient<Database>;
}

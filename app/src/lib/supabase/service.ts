import { createClient as createRawClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Service-role client. Bypasses RLS — use only in server-side flows that
 * verify authorization another way (e.g. a HMAC-signed unsubscribe token).
 */
export function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) non configurato'
    );
  }
  return createRawClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

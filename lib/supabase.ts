import { createClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client using the PUBLIC anon key.
 *
 * SECURITY: this client is subject to Row Level Security. The schema enables RLS
 * with NO permissive policies, so the public anon key cannot read or write any
 * data. All privileged reads/writes go through server Route Handlers (lib/db.ts)
 * which use the service-role key and bypass RLS.
 *
 * Kept for completeness / future realtime subscriptions; not used for data today.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

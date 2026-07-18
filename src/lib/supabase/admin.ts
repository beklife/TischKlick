import {createClient} from '@supabase/supabase-js';

// Service-role client: bypasses RLS. Guest-side writes and storage only.
// Never expose to the client and never use for owner-facing reads.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {auth: {persistSession: false, autoRefreshToken: false}}
  );
}

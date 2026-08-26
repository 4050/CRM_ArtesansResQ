import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

// Service-role client for privileged Auth Admin calls (inviting users) that
// the anon-key/RLS-scoped client in server.ts can't make. The service role
// key bypasses RLS entirely - only import this from trusted server actions
// that have already checked the caller's role themselves, never from
// anything reachable with unchecked input.
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

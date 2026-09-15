'use server'

import { createClient } from '@/lib/supabase/server'

// Called every 60s by components/layout/Heartbeat.tsx while an
// authenticated page is mounted. Errors are swallowed - a missed ping
// just means the caller looks "offline" a little sooner (lib/utils.ts's
// isOnline), not something worth surfacing to the user.
export async function touchLastSeenAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('touch_last_seen')
}

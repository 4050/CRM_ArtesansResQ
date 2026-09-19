'use client'

import { useEffect } from 'react'
import { touchLastSeenAction } from '@/lib/actions/heartbeat'

const HEARTBEAT_INTERVAL_MS = 60_000

// Renders nothing - just pings touch_last_seen() on mount and every
// minute after, so /{lang}/users can tell which users are currently
// online (lib/utils.ts's isOnline). touchLastSeenAction() is fire-and-
// forget by design - it already swallows its own errors (see its own
// comment) - `void` just makes that explicit here too, instead of
// leaving an unhandled-promise pattern for a lint rule to eventually
// flag without the surrounding comment explaining why it's fine.
export default function Heartbeat() {
  useEffect(() => {
    void touchLastSeenAction()
    const id = setInterval(() => void touchLastSeenAction(), HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return null
}

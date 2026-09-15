'use client'

import { useEffect } from 'react'
import { touchLastSeenAction } from '@/lib/actions/heartbeat'

const HEARTBEAT_INTERVAL_MS = 60_000

// Renders nothing - just pings touch_last_seen() on mount and every
// minute after, so /{lang}/users can tell which users are currently
// online (lib/utils.ts's isOnline).
export default function Heartbeat() {
  useEffect(() => {
    touchLastSeenAction()
    const id = setInterval(touchLastSeenAction, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return null
}

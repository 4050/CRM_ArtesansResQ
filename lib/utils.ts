import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isLowStock(qty: number, min: number): boolean {
  return qty <= min
}

// Heartbeat pings (components/layout/Heartbeat.tsx) hit touch_last_seen()
// every 60s while an authenticated page is mounted, so two missed pings
// is a reasonable "actually gone" threshold - long enough to survive one
// dropped/delayed request, short enough that "online" still means
// something.
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

export function isOnline(lastSeenAt: string | null, now: number = Date.now()): boolean {
  if (!lastSeenAt) return false
  return now - new Date(lastSeenAt).getTime() <= ONLINE_THRESHOLD_MS
}

export function computeTotalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize))
}

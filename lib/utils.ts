import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Locale } from '@/app/[lang]/dictionaries'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Single place mapping our app locale codes to BCP 47 tags for Intl/toLocale* calls.
const BCP47: Record<Locale, string> = { en: 'en-US', uk: 'uk-UA' }

export function toBCP47(lang: Locale): string {
  return BCP47[lang]
}

export function formatDateTime(dateStr: string, lang: Locale): string {
  const d = new Date(dateStr)
  return d.toLocaleString(BCP47[lang], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isLowStock(qty: number, min: number): boolean {
  return qty <= min
}

export function computeTotalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize))
}

// The start of "today" in a given IANA timezone, as an ISO instant - not
// the server's local timezone, which on a typical UTC-deployed server
// would put the day boundary hours off from where the org's team actually
// is. Works by reading `now`'s wall-clock date/time in `timeZone` via
// Intl, using that to derive the zone's current UTC offset, then applying
// that offset to the zone's own midnight.
export function startOfDayIso(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value)

  // formatToParts can render midnight as hour "24" instead of "00"
  const hour = get('hour') === 24 ? 0 : get('hour')
  const wallClockAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
  const offsetMs = wallClockAsUtc - now.getTime()

  const midnightWallClockAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), 0, 0, 0)
  return new Date(midnightWallClockAsUtc - offsetMs).toISOString()
}

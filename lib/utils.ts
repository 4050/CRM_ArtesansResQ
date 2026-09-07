import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Locale } from '@/app/[lang]/dictionaries'
import { ORG_TIMEZONE } from '@/lib/timezone'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Single place mapping our app locale codes to BCP 47 tags for Intl/toLocale* calls.
const BCP47: Record<Locale, string> = { en: 'en-US', uk: 'uk-UA' }

export function toBCP47(lang: Locale): string {
  return BCP47[lang]
}

// timeZone is explicit (ORG_TIMEZONE) rather than left to Intl's default:
// this can render on the server (Server Components) as well as in the
// browser, and the server process's own timezone - typically UTC in
// production - has nothing to do with where the org's team actually is.
export function formatDateTime(dateStr: string, lang: Locale): string {
  const d = new Date(dateStr)
  return d.toLocaleString(BCP47[lang], {
    timeZone: ORG_TIMEZONE,
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

// The UTC offset (in ms) actually in effect at `instant` in `timeZone` -
// read via Intl rather than assumed constant, since it changes across a
// DST transition.
function offsetMsAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value)
  // formatToParts can render midnight as hour "24" instead of "00"
  const hour = get('hour') === 24 ? 0 : get('hour')
  const wallClockAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
  return wallClockAsUtc - instant
}

// The UTC instant for a given calendar date's local midnight in `timeZone`.
// One correction is enough: the offset is read at the date's *naive* UTC
// midnight (year/month/day at 00:00 UTC) as a first guess - which lands
// within a few hours of true local midnight for any realistic zone, same
// calendar date - rather than at some unrelated instant (e.g. "now"),
// whose own offset can differ from midnight's on the day of a DST
// transition and silently shift the result by an hour. (The one instant
// this can still land wrong for is a date whose local midnight itself
// falls inside that day's own DST gap/overlap - narrow enough to accept.)
function zonedMidnightIso(year: number, month: number, day: number, timeZone: string): string {
  const naiveUtc = Date.UTC(year, month - 1, day, 0, 0, 0)
  const offsetMs = offsetMsAt(naiveUtc, timeZone)
  return new Date(naiveUtc - offsetMs).toISOString()
}

// year/month/day of the calendar date after the given one - plain calendar
// arithmetic (month/year rollovers included), independent of any timezone.
function nextCalendarDay(year: number, month: number, day: number): [number, number, number] {
  const d = new Date(Date.UTC(year, month - 1, day + 1))
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
}

// The start of "today" in a given IANA timezone, as an ISO instant - not
// the server's local timezone, which on a typical UTC-deployed server
// would put the day boundary hours off from where the org's team actually
// is.
export function startOfDayIso(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value)
  return zonedMidnightIso(get('year'), get('month'), get('day'), timeZone)
}

// Parses a "YYYY-MM-DD" <input type="date"> value as a calendar date in
// `timeZone` - not the server's timezone, which `new Date(\`${d}T00:00:00\`)`
// would silently use instead - and returns the UTC instant for that date's
// local midnight.
export function dateInputStartOfDayIso(dateInput: string, timeZone: string): string {
  const [year, month, day] = dateInput.split('-').map(Number)
  return zonedMidnightIso(year, month, day, timeZone)
}

// Same as dateInputStartOfDayIso, but for the last millisecond of that
// calendar date - one ms before the *next* date's local midnight, so it's
// correct even on a 23- or 25-hour DST-transition day.
export function dateInputEndOfDayIso(dateInput: string, timeZone: string): string {
  const [year, month, day] = dateInput.split('-').map(Number)
  const [nextYear, nextMonth, nextDay] = nextCalendarDay(year, month, day)
  const nextMidnight = new Date(zonedMidnightIso(nextYear, nextMonth, nextDay, timeZone))
  return new Date(nextMidnight.getTime() - 1).toISOString()
}

// Clamps a `<input type="number" min="1">` onChange value to a valid
// integer quantity. A partially-typed value (empty, "-", scientific
// notation mid-entry) makes Number(raw) NaN, and Math.max(1, NaN) is NaN -
// which then silently defeats any `quantity > qty_in_stock` over-stock
// check downstream, since every comparison against NaN is false. A
// fractional value (e.g. "1.5") isn't NaN but still isn't valid, since
// every quantity column in this app is an integer - Postgres would reject
// it as a raw, untranslated type-cast error. Falls back to 1 for anything
// that doesn't parse, rather than the previous value, so a cleared field
// doesn't leave a stale number in place.
export function clampQuantityInput(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1
}

// Same guarding as clampQuantityInput, but floors at 0 rather than 1 - for
// `<input type="number" min="0">` fields where empty/zero is a legitimate
// value (e.g. a new item's opening stock, or its reorder minimum).
export function clampNonNegativeInt(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

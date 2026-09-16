import type { Locale } from '@/app/[lang]/dictionaries'

// No per-org timezone setting exists yet - every organization using this
// app today is Ukraine-based. Single source of truth for that assumption:
// everywhere a "today"/date-range boundary or a rendered date/time needs a
// zone, it should read this constant rather than hardcode 'Europe/Kyiv' (or
// rely on the server's or browser's own timezone, which differ from this by
// deployment/environment and from each other). Revisit if this app ever
// serves organizations across more than one timezone.
export const ORG_TIMEZONE = 'Europe/Kyiv'

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

// "YYYY-MM-DD" from `d`'s *local* date components (getFullYear/getMonth/
// getDate), for a <input type="date"> value - not `d.toISOString().
// slice(0, 10)`, which reads the UTC date instead and can be a day behind
// local for several hours after local midnight in any zone ahead of UTC
// (this runs client-side, in whichever timezone the medic's own browser is
// set to). Pair with toLocalTimeInputValue below - never one of these with
// the other's ISO/UTC equivalent, or the date and time end up read from
// two different calendar days.
export function toLocalDateInputValue(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// "HH:MM" from `d`'s local time components, for a <input type="time">
// value - see toLocalDateInputValue above.
export function toLocalTimeInputValue(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

import { describe, expect, it } from 'vitest'
import { cn, toBCP47, formatDateTime, isLowStock, startOfDayIso, dateInputStartOfDayIso, dateInputEndOfDayIso, clampQuantityInput, clampNonNegativeInt } from './utils'
import { ORG_TIMEZONE } from './timezone'

describe('cn', () => {
  it('merges classes and resolves Tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })
})

describe('toBCP47', () => {
  it('maps app locales to BCP 47 tags', () => {
    expect(toBCP47('en')).toBe('en-US')
    expect(toBCP47('uk')).toBe('uk-UA')
  })
})

describe('formatDateTime', () => {
  // Regression test: formatDateTime was hardcoded to 'ru-RU' at one point,
  // so dates rendered in Russian regardless of the chosen UI language.
  // Locking in that 'en' never produces Cyrillic month/day names and 'uk'
  // does not silently fall back to a Russian-formatted string.
  const sample = '2026-03-05T14:30:00Z'

  it('formats en dates without Cyrillic characters', () => {
    expect(formatDateTime(sample, 'en')).not.toMatch(/[Ѐ-ӿ]/)
  })

  it('formats uk dates using the uk-UA locale, not a Russian one', () => {
    // uk-UA and ru-RU both use Cyrillic digits/punctuation for this
    // numeric day/month/year/time format, so the meaningful assertion is
    // that formatting with 'uk' actually differs from formatting the same
    // instant with a hardcoded ru-RU locale would - i.e. the lang param is
    // truly wired through rather than ignored. Reference computation needs
    // the same explicit timeZone formatDateTime itself now uses - without
    // it, this only coincidentally matched on a machine whose own local
    // timezone happened to be ORG_TIMEZONE, and failed in CI (which runs
    // in UTC).
    expect(() => formatDateTime(sample, 'uk')).not.toThrow()
    expect(formatDateTime(sample, 'uk')).toBe(new Date(sample).toLocaleString('uk-UA', {
      timeZone: ORG_TIMEZONE,
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }))
  })
})

describe('startOfDayIso', () => {
  // Regression test: the dashboard used to compute "today" via the
  // server's local Date/setHours, which is wrong whenever the server's
  // timezone (typically UTC in production) differs from the org's - this
  // locks in that the boundary is actually computed in the given zone.

  it('returns the zone-local midnight for a UTC instant already past local midnight (EEST, UTC+3)', () => {
    // 2026-08-19T22:00:00Z is 2026-08-20T01:00 in Kyiv (summer, UTC+3) -
    // already the next calendar day locally, though still Aug 19 in UTC.
    const now = new Date('2026-08-19T22:00:00Z')
    expect(startOfDayIso('Europe/Kyiv', now)).toBe('2026-08-19T21:00:00.000Z')
  })

  it('returns the zone-local midnight for a UTC instant during standard time (EET, UTC+2)', () => {
    // 2026-01-15T22:30:00Z is 2026-01-16T00:30 in Kyiv (winter, UTC+2).
    const now = new Date('2026-01-15T22:30:00Z')
    expect(startOfDayIso('Europe/Kyiv', now)).toBe('2026-01-15T22:00:00.000Z')
  })

  it('returns the same local day\'s midnight for a mid-day instant', () => {
    // 2026-06-15T10:00:00Z is 2026-06-15T13:00 in Kyiv (summer, UTC+3) -
    // same calendar date in both, just a different hour.
    const now = new Date('2026-06-15T10:00:00Z')
    expect(startOfDayIso('Europe/Kyiv', now)).toBe('2026-06-14T21:00:00.000Z')
  })

  // Regression test: startOfDayIso used to derive the offset to apply to
  // midnight from `now`'s own offset - wrong on the day of a DST
  // transition, since `now` (typically queried well after local midnight)
  // can have a different offset than midnight itself did. Kyiv's 2026
  // spring-forward is 2026-03-29 (EET UTC+2 -> EEST UTC+3, at 01:00 UTC /
  // 03:00 local) - local midnight that day is still EET (+2). Querying
  // from before vs. after the transition must give the identical result;
  // the old code gave 2026-03-28T21:00:00.000Z for the "after" case (using
  // +3 instead of the +2 actually in effect at midnight) - an hour off.
  it('returns a DST-transition day\'s own midnight regardless of whether "now" is before or after that day\'s transition (spring forward)', () => {
    const beforeTransition = new Date('2026-03-29T00:30:00Z') // 02:30 local, EET (+2)
    const afterTransition = new Date('2026-03-29T15:00:00Z') // 18:00 local, EEST (+3)
    expect(startOfDayIso('Europe/Kyiv', beforeTransition)).toBe('2026-03-28T22:00:00.000Z')
    expect(startOfDayIso('Europe/Kyiv', afterTransition)).toBe('2026-03-28T22:00:00.000Z')
  })

  // Same regression, the "fall back" transition: Kyiv's 2026-10-25 (EEST
  // UTC+3 -> EET UTC+2, at 01:00 UTC / 04:00->03:00 local) - local
  // midnight that day is still EEST (+3).
  it('returns a DST-transition day\'s own midnight regardless of whether "now" is before or after that day\'s transition (fall back)', () => {
    const beforeTransition = new Date('2026-10-25T00:30:00Z') // 03:30 local, EEST (+3)
    const afterTransition = new Date('2026-10-25T15:00:00Z') // 17:00 local, EET (+2)
    expect(startOfDayIso('Europe/Kyiv', beforeTransition)).toBe('2026-10-24T21:00:00.000Z')
    expect(startOfDayIso('Europe/Kyiv', afterTransition)).toBe('2026-10-24T21:00:00.000Z')
  })
})

describe('dateInputStartOfDayIso / dateInputEndOfDayIso', () => {
  // Regression test: the reports page used to build these boundaries via
  // `new Date(\`${d}T00:00:00\`)` / `...T23:59:59.999\`)`, parsed in the
  // server's own timezone rather than the org's.

  it('returns the org-timezone start and end of an ordinary day', () => {
    expect(dateInputStartOfDayIso('2026-06-15', 'Europe/Kyiv')).toBe('2026-06-14T21:00:00.000Z')
    expect(dateInputEndOfDayIso('2026-06-15', 'Europe/Kyiv')).toBe('2026-06-15T20:59:59.999Z')
  })

  it('returns the correct end of a 23-hour DST spring-forward day', () => {
    expect(dateInputEndOfDayIso('2026-03-29', 'Europe/Kyiv')).toBe('2026-03-29T20:59:59.999Z')
  })

  it('returns the correct end of a 25-hour DST fall-back day', () => {
    expect(dateInputEndOfDayIso('2026-10-25', 'Europe/Kyiv')).toBe('2026-10-25T21:59:59.999Z')
  })
})

describe('clampQuantityInput', () => {
  // Regression test: a plain `Math.max(1, Number(raw))` in NewCallForm/
  // EditCallForm/ConsumablePicker/TeamStockClient let a partially-typed
  // number input reach NaN (silently defeating the over-stock check
  // downstream, since every comparison against NaN is false) or a
  // fractional value (rejected by Postgres as a raw type-cast error, since
  // every quantity column in this app is an integer).
  it('parses a normal integer string', () => {
    expect(clampQuantityInput('5')).toBe(5)
  })

  it('rounds a fractional value to the nearest integer', () => {
    expect(clampQuantityInput('2.4')).toBe(2)
    expect(clampQuantityInput('2.6')).toBe(3)
  })

  it('clamps below-minimum values up to 1', () => {
    expect(clampQuantityInput('0')).toBe(1)
    expect(clampQuantityInput('-3')).toBe(1)
  })

  it('falls back to 1 for values that parse to NaN', () => {
    expect(clampQuantityInput('')).toBe(1)
    expect(clampQuantityInput('-')).toBe(1)
    expect(clampQuantityInput('abc')).toBe(1)
  })
})

describe('clampNonNegativeInt', () => {
  // Regression test: InventoryClient's opening-stock/minimum-stock inputs
  // used a bare Number(e.target.value) with no guard, so clearing the
  // field mid-edit sent NaN to createConsumableAction/updateConsumableAction
  // and surfaced as a raw Postgres not-null/type-cast error instead of
  // being handled client-side.
  it('parses a normal integer string', () => {
    expect(clampNonNegativeInt('5')).toBe(5)
  })

  it('rounds a fractional value to the nearest integer', () => {
    expect(clampNonNegativeInt('2.4')).toBe(2)
    expect(clampNonNegativeInt('2.6')).toBe(3)
  })

  it('clamps negative values up to 0', () => {
    expect(clampNonNegativeInt('-3')).toBe(0)
  })

  it('allows 0 as a valid value, unlike clampQuantityInput', () => {
    expect(clampNonNegativeInt('0')).toBe(0)
  })

  it('falls back to 0 for values that parse to NaN', () => {
    expect(clampNonNegativeInt('')).toBe(0)
    expect(clampNonNegativeInt('-')).toBe(0)
    expect(clampNonNegativeInt('abc')).toBe(0)
  })
})

describe('isLowStock', () => {
  it('is low when quantity is at or below the minimum', () => {
    expect(isLowStock(5, 5)).toBe(true)
    expect(isLowStock(4, 5)).toBe(true)
  })

  it('is not low when quantity is above the minimum', () => {
    expect(isLowStock(6, 5)).toBe(false)
  })

  it('treats a zero minimum as "never low" unless stock is also zero', () => {
    expect(isLowStock(0, 0)).toBe(true)
    expect(isLowStock(1, 0)).toBe(false)
  })
})

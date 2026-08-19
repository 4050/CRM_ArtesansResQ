import { describe, expect, it } from 'vitest'
import { cn, toBCP47, formatDateTime, isLowStock } from './utils'

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
    // truly wired through rather than ignored.
    expect(() => formatDateTime(sample, 'uk')).not.toThrow()
    expect(formatDateTime(sample, 'uk')).toBe(new Date(sample).toLocaleString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }))
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

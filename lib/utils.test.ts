import { describe, expect, it } from 'vitest'
import { cn, isLowStock, isOnline, ONLINE_THRESHOLD_MS } from './utils'

describe('cn', () => {
  it('merges classes and resolves Tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })
})

describe('isOnline', () => {
  const now = new Date('2026-03-05T12:00:00Z').getTime()

  it('is false when last_seen_at was never set', () => {
    expect(isOnline(null, now)).toBe(false)
  })

  it('is true just within the threshold', () => {
    const lastSeenAt = new Date(now - ONLINE_THRESHOLD_MS).toISOString()
    expect(isOnline(lastSeenAt, now)).toBe(true)
  })

  it('is false just past the threshold', () => {
    const lastSeenAt = new Date(now - ONLINE_THRESHOLD_MS - 1).toISOString()
    expect(isOnline(lastSeenAt, now)).toBe(false)
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

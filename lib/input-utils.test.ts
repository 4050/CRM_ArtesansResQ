import { describe, expect, it } from 'vitest'
import { clampQuantityInput, clampNonNegativeInt } from './input-utils'

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

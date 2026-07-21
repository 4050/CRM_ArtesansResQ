import { describe, expect, it } from 'vitest'
import { normalizeHeader, remapRow, parseRawRow } from './inventory-import'

describe('normalizeHeader', () => {
  it('lowercases and strips spaces/underscores/dots/dashes', () => {
    expect(normalizeHeader('Min Quantity')).toBe('minquantity')
    expect(normalizeHeader('min_qty')).toBe('minqty')
    expect(normalizeHeader('Item.Name')).toBe('itemname')
    expect(normalizeHeader('SKU')).toBe('sku')
  })
})

describe('remapRow', () => {
  it('maps aliased headers onto canonical field names', () => {
    const raw = { 'Item Name': 'Bandage', SKU: 'TST-1', Qty: 10, 'Min Stock': 2 }
    expect(remapRow(raw)).toEqual({ name: 'Bandage', code: 'TST-1', quantity: 10, qty_minimum: 2 })
  })

  it('drops columns that match no known alias', () => {
    const raw = { name: 'Bandage', 'Some Random Column': 'ignored' }
    expect(remapRow(raw)).toEqual({ name: 'Bandage' })
  })

  // Regression: XLSX.utils.sheet_to_json unions every header used anywhere
  // in the sheet onto every row, so a row missing one of two aliases for
  // the same field (e.g. "Item Name" and "Name" both appear somewhere in
  // the file) sees the absent one as null - caught via an end-to-end test
  // that generated a real xlsx buffer and read it back with mixed headers.
  it('does not let a null from a duplicate-alias column clobber a real value found via another alias', () => {
    const raw = { 'Item Name': 'Bandage roll', Name: null }
    expect(remapRow(raw)).toEqual({ name: 'Bandage roll' })
  })

  it('still records a legitimate null when no alias for the field has a value', () => {
    const raw = { Name: null, Quantity: 5 }
    expect(remapRow(raw)).toEqual({ name: null, quantity: 5 })
  })
})

describe('parseRawRow', () => {
  it('parses a fully-populated row', () => {
    const result = parseRawRow({
      Code: 'TST-1', Name: '  Bandage  ', Category: ' Dressings ', Unit: ' PCS ',
      Quantity: 10, 'Min Stock': 2, Notes: ' fragile ',
    })
    expect(result).toEqual({
      row: {
        code: 'TST-1',
        name: 'Bandage',
        category: 'dressings',
        unit: 'pcs',
        quantity: 10,
        qty_minimum: 2,
        description: 'fragile',
      },
    })
  })

  it('defaults category to "other" and qty_minimum to 0 when absent', () => {
    const result = parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 5 })
    expect(result).toEqual({
      row: { code: 'TST-1', name: 'Bandage', category: 'other', unit: '', quantity: 5, qty_minimum: 0, description: null },
    })
  })

  it('accepts a numeric code and stringifies it', () => {
    const result = parseRawRow({ name: 'Bandage', quantity: 1, code: 12345 })
    expect('row' in result && result.row.code).toBe('12345')
  })

  it('rejects a row with no name', () => {
    expect(parseRawRow({ code: 'TST-1', quantity: 5 })).toEqual({ error: 'Missing name' })
  })

  it('rejects a row with no code', () => {
    expect(parseRawRow({ name: 'Bandage', quantity: 5 })).toEqual({ error: 'Missing code' })
  })

  it('rejects a zero or negative quantity', () => {
    expect(parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 0 })).toEqual({ error: 'Quantity must be a positive number' })
    expect(parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: -3 })).toEqual({ error: 'Quantity must be a positive number' })
  })

  it('rejects a non-numeric quantity', () => {
    expect(parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 'lots' })).toEqual({ error: 'Quantity must be a positive number' })
  })

  it('rejects a negative minimum stock', () => {
    expect(parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 5, min: -1 })).toEqual({
      error: 'Minimum stock must be zero or a positive number',
    })
  })
})

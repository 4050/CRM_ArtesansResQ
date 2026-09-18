import { describe, expect, it } from 'vitest'
import { normalizeHeader, remapRow, parseRawRow, dedupeCode } from './inventory-import'

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

  // Regression: a real donated-supply sheet paired an English and
  // Ukrainian label for the same column in one cell ("Opening Stock/
  // Початковий запас") rather than using a separate column per language -
  // normalizeHeader alone left the whole string (with its slash) unmapped,
  // so every row's quantity read as NaN and failed to import at all.
  it('maps a bilingual "English/Ukrainian" header by its English half', () => {
    const raw = { 'Opening Stock/      Початковий запас': 10 }
    expect(remapRow(raw)).toEqual({ quantity: 10 })
  })

  // Same real sheet's unit column had no English header at all.
  it('maps a Ukrainian-only header with no English column present', () => {
    const raw = { 'Одиниця виміру': 'шт.' }
    expect(remapRow(raw)).toEqual({ unit: 'шт.' })
  })
})

describe('dedupeCode', () => {
  it('returns the base code unchanged when it is free', () => {
    expect(dedupeCode('TST-1', () => false)).toBe('TST-1')
  })

  // Regression: a real donated-supply sheet had two distinct batches of
  // "Water for injections" both labeled with the same code - dropping the
  // second one as a "duplicate code" error lost real inventory data.
  it('appends a letter suffix when the base code is taken', () => {
    const taken = new Set(['tst-1'])
    expect(dedupeCode('TST-1', c => taken.has(c.toLowerCase()))).toBe('TST-1A')
  })

  it('tries the next letter when the first suffix is also taken', () => {
    const taken = new Set(['tst-1', 'tst-1a'])
    expect(dedupeCode('TST-1', c => taken.has(c.toLowerCase()))).toBe('TST-1B')
  })

  it('falls back to a numeric suffix once all 26 letters are taken', () => {
    const taken = new Set(['tst-1', ...Array.from({ length: 26 }, (_, i) => `tst-1${String.fromCharCode(97 + i)}`)])
    expect(dedupeCode('TST-1', c => taken.has(c.toLowerCase()))).toBe('TST-1-2')
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

  // Regression: a blank code used to reject the whole row - now it's left
  // blank here too, and importActions.ts's parseInventoryExcelAction fills
  // in a generated placeholder (see its own tests/comments) rather than
  // losing the row over one empty cell.
  it('leaves a missing code blank instead of rejecting the row', () => {
    const result = parseRawRow({ name: 'Bandage', quantity: 5 })
    expect('row' in result && result.row.code).toBe('')
  })

  // Regression: a real donated-supply sheet tracked some items at zero
  // current stock - zero is a legitimate quantity (see
  // confirm_inventory_import's own check), not an error.
  it('accepts a zero quantity', () => {
    const result = parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 0 })
    expect('row' in result && result.row.quantity).toBe(0)
  })

  it('rejects a negative quantity', () => {
    expect(parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: -3 })).toEqual({ error: 'Quantity must be a whole number, zero or greater' })
  })

  it('rejects a non-numeric quantity', () => {
    expect(parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 'lots' })).toEqual({ error: 'Quantity must be a whole number, zero or greater' })
  })

  // Regression: every quantity column in this app is an integer - a
  // fractional value used to sail past this check (finite and
  // non-negative) and only fail later as a raw, untranslated Postgres
  // type-cast error.
  it('rejects a fractional quantity', () => {
    expect(parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 1.5 })).toEqual({ error: 'Quantity must be a whole number, zero or greater' })
  })

  it('rejects a negative minimum stock', () => {
    expect(parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 5, min: -1 })).toEqual({
      error: 'Minimum stock must be a whole number, zero or greater',
    })
  })

  it('rejects a fractional minimum stock', () => {
    expect(parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 5, min: 2.5 })).toEqual({
      error: 'Minimum stock must be a whole number, zero or greater',
    })
  })

  // Regression: the same real donated-supply sheet that motivated the
  // bilingual-header fix above labeled units in Ukrainian ("шт.", "амп",
  // "флак.", "упак.", "таб.") rather than this app's canonical unit codes.
  it('translates a unit spelling variant to its canonical code', () => {
    const cases: [string, string][] = [
      ['шт.', 'pcs'], ['амп', 'amp'], ['флак.', 'vial'], ['упак.', 'pack'], ['Tab.', 'tab'],
    ]
    for (const [unit, expected] of cases) {
      const result = parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 5, unit })
      expect('row' in result && result.row.unit).toBe(expected)
    }
  })

  it('leaves an unrecognized unit as lowercased free text, same as category', () => {
    const result = parseRawRow({ name: 'Bandage', code: 'TST-1', quantity: 5, unit: 'Boxful' })
    expect('row' in result && result.row.unit).toBe('boxful')
  })
})

// Pure parsing/validation logic for the inventory Excel import, split out
// of app/[lang]/(app)/(admin)/inventory/importActions.ts (a 'use server'
// file, which can only export async actions) so it's directly unit-testable.

export interface ParsedRow {
  code: string
  name: string
  category: string
  // Normalized (lowercase/trimmed) but not yet checked against the known
  // CONSUMABLE_UNITS list — that check only applies when the row turns out
  // to be a new item, which the caller decides after a DB lookup.
  unit: string
  quantity: number
  qty_minimum: number
  description: string | null
}

export type ParseRowResult = { row: ParsedRow } | { error: string }

// Column headers are matched loosely (case/spacing-insensitive) against
// these aliases rather than requiring an exact template, since real-world
// spreadsheets rarely use one canonical header set.
const FIELD_ALIASES: Record<string, string[]> = {
  code: ['code', 'sku'],
  name: ['name', 'item', 'title', 'itemname'],
  category: ['category', 'cat'],
  unit: ['unit', 'units', 'uom'],
  quantity: ['quantity', 'qty', 'amount', 'count'],
  qty_minimum: ['min', 'minimum', 'minqty', 'minquantity', 'minstock', 'minimumstock'],
  description: ['description', 'notes', 'desc'],
}

export function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[\s_.-]+/g, '')
}

function buildFieldLookup(): Record<string, string> {
  const lookup: Record<string, string> = {}
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) lookup[alias] = field
  }
  return lookup
}

const FIELD_LOOKUP = buildFieldLookup()

export function remapRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    const field = FIELD_LOOKUP[normalizeHeader(key)]
    if (!field) continue
    // sheet_to_json unions every header used anywhere in the sheet onto
    // every row, so a row missing one of two same-field aliases (e.g. both
    // "Code" and "SKU" present somewhere in the file) sees the absent one
    // as null. Don't let that null clobber a real value already found via
    // another alias for the same field.
    if (value != null || !(field in out)) out[field] = value
  }
  return out
}

export function parseRawRow(raw: Record<string, unknown>): ParseRowResult {
  const mapped = remapRow(raw)

  const name = typeof mapped.name === 'string' ? mapped.name.trim() : ''
  if (!name) return { error: 'Missing name' }

  const codeRaw = mapped.code
  const code = typeof codeRaw === 'string' && codeRaw.trim()
    ? codeRaw.trim()
    : (typeof codeRaw === 'number' ? String(codeRaw) : '')
  if (!code) return { error: 'Missing code' }

  const quantity = Number(mapped.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'Quantity must be a positive number' }

  const qtyMinRaw = mapped.qty_minimum
  const qty_minimum = qtyMinRaw != null && qtyMinRaw !== '' ? Number(qtyMinRaw) : 0
  if (!Number.isFinite(qty_minimum) || qty_minimum < 0) return { error: 'Minimum stock must be zero or a positive number' }

  const category = typeof mapped.category === 'string' && mapped.category.trim()
    ? mapped.category.trim().toLowerCase()
    : 'other'

  const unit = typeof mapped.unit === 'string' ? mapped.unit.trim().toLowerCase() : ''

  const description = typeof mapped.description === 'string' && mapped.description.trim()
    ? mapped.description.trim()
    : null

  return { row: { code, name, category, unit, quantity, qty_minimum, description } }
}

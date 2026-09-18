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
// spreadsheets rarely use one canonical header set. 'openingstock' and the
// Ukrainian 'одиницявиміру' are here because a real donated-supply sheet
// used them (a bilingual "Opening Stock/ Початковий запас" header for
// quantity, and a Ukrainian-only "Одиниця виміру" header for unit, with no
// English column at all) - not a speculative addition.
const FIELD_ALIASES: Record<string, string[]> = {
  code: ['code', 'sku'],
  name: ['name', 'item', 'title', 'itemname'],
  category: ['category', 'cat'],
  unit: ['unit', 'units', 'uom', 'одиницявиміру'],
  quantity: ['quantity', 'qty', 'amount', 'count', 'openingstock'],
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

// A header like "Opening Stock/      Початковий запас" pairs an English
// and a Ukrainian label for the same column in one cell, rather than using
// two separate columns the way "Name"/"Найменування Ukrainian" do
// elsewhere in the same real-world sheet this was found from. Splitting on
// "/" and matching each side separately lets the English half resolve
// normally without needing a Ukrainian alias for every field, just the
// (rarer) fields that only ever show up Ukrainian-only with no English
// column at all.
function fieldForHeader(header: string): string | undefined {
  for (const part of header.split('/')) {
    const field = FIELD_LOOKUP[normalizeHeader(part)]
    if (field) return field
  }
  return undefined
}

export function remapRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    const field = fieldForHeader(key)
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

// Real donated-supply sheets label the unit column with abbreviations -
// often Ukrainian, sometimes just an English one with a trailing dot this
// app's own codes don't have - rather than this app's canonical
// CONSUMABLE_UNITS codes (lib/consumable-labels.ts). Map the spelling
// variants sheets actually used to their canonical code. Both the bare
// and dot-suffixed spelling of each are listed since real sheets use
// either inconsistently (compare "амп" in one row of the sheet this was
// found from against "амп." in the next). Anything not listed here is
// left as-is (lowercased) rather than guessed at - same as category's
// free-text fallback - so it still fails the "unknown unit" check for a
// genuinely new item later instead of being silently misfiled as
// something it isn't.
const UNIT_SPELLING_ALIASES: Record<string, string> = {
  'шт': 'pcs', 'шт.': 'pcs',
  'пар': 'pair', 'пар.': 'pair', 'пара': 'pair',
  'мл': 'ml', 'мл.': 'ml',
  'л': 'l', 'л.': 'l',
  'г': 'g', 'г.': 'g',
  'кг': 'kg', 'кг.': 'kg',
  'уп': 'pack', 'уп.': 'pack', 'упак': 'pack', 'упак.': 'pack',
  'фл': 'vial', 'фл.': 'vial', 'флак': 'vial', 'флак.': 'vial',
  'амп': 'amp', 'амп.': 'amp',
  'таб': 'tab', 'таб.': 'tab', 'tab.': 'tab',
  'блістер': 'blister', 'блiстер': 'blister',
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

  // Every quantity column in this app is an integer (see lib/utils.ts's
  // clampQuantityInput) - a fractional value like "1.5" is finite and
  // positive, so it would otherwise sail past this check and only fail
  // later as a raw, untranslated Postgres type-cast error.
  const quantity = Number(mapped.quantity)
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    return { error: 'Quantity must be a positive whole number' }
  }

  const qtyMinRaw = mapped.qty_minimum
  const qty_minimum = qtyMinRaw != null && qtyMinRaw !== '' ? Number(qtyMinRaw) : 0
  if (!Number.isFinite(qty_minimum) || !Number.isInteger(qty_minimum) || qty_minimum < 0) {
    return { error: 'Minimum stock must be a whole number, zero or greater' }
  }

  const category = typeof mapped.category === 'string' && mapped.category.trim()
    ? mapped.category.trim().toLowerCase()
    : 'other'

  const unitRaw = typeof mapped.unit === 'string' ? mapped.unit.trim().toLowerCase() : ''
  const unit = UNIT_SPELLING_ALIASES[unitRaw] ?? unitRaw

  const description = typeof mapped.description === 'string' && mapped.description.trim()
    ? mapped.description.trim()
    : null

  return { row: { code, name, category, unit, quantity, qty_minimum, description } }
}

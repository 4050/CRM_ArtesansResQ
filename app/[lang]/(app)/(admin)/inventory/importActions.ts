'use server'

import * as XLSX from 'xlsx'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDictionary, type Locale } from '@/app/[lang]/dictionaries'
import { friendlyDbError } from '@/lib/action-errors'
import type { Consumable, ConsumableUnit } from '@/types'
import { CONSUMABLE_UNITS } from '@/lib/consumable-labels'
import { parseRawRow } from '@/lib/inventory-import'

export interface ImportRow {
  rowNumber: number
  code: string
  name: string
  category: string
  unit: ConsumableUnit
  quantity: number
  qty_minimum: number
  description: string | null
}

export interface ImportRowError {
  rowNumber: number
  message: string
}

export interface RestockPreviewRow {
  row: ImportRow
  consumableId: string
  existingName: string
  currentQty: number
}

export interface ImportPreview {
  toCreate: ImportRow[]
  toRestock: RestockPreviewRow[]
  errors: ImportRowError[]
}

export async function parseInventoryExcelAction(formData: FormData): Promise<{ data?: ImportPreview; error?: string }> {
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'No file uploaded' }

  let workbook: XLSX.WorkBook
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return { error: 'Could not read the file — is it a valid Excel file?' }
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return { error: 'The file has no sheets' }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
  if (rawRows.length === 0) return { error: 'The sheet has no data rows' }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('consumables')
    .select('id, code, name, qty_in_stock')
    .eq('is_active', true)
  const byCode = new Map(
    (existing ?? [])
      .filter((c): c is typeof c & { code: string } => !!c.code)
      .map(c => [c.code.trim().toLowerCase(), c])
  )

  const toCreate: ImportRow[] = []
  const toRestock: RestockPreviewRow[] = []
  const errors: ImportRowError[] = []
  const seenNewCodes = new Set<string>()

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2 // +1 for 1-indexing, +1 for the header row
    const result = parseRawRow(raw)
    if ('error' in result) {
      errors.push({ rowNumber, message: result.error })
      return
    }
    const { code, name, category, unit, quantity, qty_minimum, description } = result.row

    const existingMatch = byCode.get(code.toLowerCase())

    if (existingMatch) {
      // Matched by code: this row restocks the existing item. Its
      // category/unit/description are only ever used for a brand-new item,
      // so a mismatch against the existing item's values is intentionally
      // ignored here rather than silently overwriting curated data.
      toRestock.push({
        row: { rowNumber, code, name, category, unit: (unit as ConsumableUnit) || 'pcs', quantity, qty_minimum, description },
        consumableId: existingMatch.id,
        existingName: existingMatch.name,
        currentQty: existingMatch.qty_in_stock,
      })
      return
    }

    if (!CONSUMABLE_UNITS.includes(unit as ConsumableUnit)) {
      errors.push({ rowNumber, message: `Unknown unit "${unit}" — expected one of ${CONSUMABLE_UNITS.join(', ')}` })
      return
    }

    const codeKey = code.toLowerCase()
    if (seenNewCodes.has(codeKey)) {
      errors.push({ rowNumber, message: `Duplicate code "${code}" also appears in another new row in this file` })
      return
    }
    seenNewCodes.add(codeKey)

    toCreate.push({ rowNumber, code, name, category, unit: unit as ConsumableUnit, quantity, qty_minimum, description })
  })

  return { data: { toCreate, toRestock, errors } }
}

export interface ImportConfirmPayload {
  toCreate: ImportRow[]
  toRestock: { consumableId: string; quantity: number }[]
}

export interface ImportConfirmResult {
  error?: string
  created: Consumable[]
  restocked: Consumable[]
}

export async function confirmInventoryImportAction(
  lang: Locale,
  payload: ImportConfirmPayload
): Promise<ImportConfirmResult> {
  const supabase = await createClient()

  let created: Consumable[] = []
  if (payload.toCreate.length > 0) {
    const rows = payload.toCreate.map(r => ({
      code: r.code,
      name: r.name,
      category: r.category,
      unit: r.unit,
      qty_in_stock: r.quantity,
      qty_minimum: r.qty_minimum,
      description: r.description,
    }))
    const { data, error } = await supabase.from('consumables').insert(rows).select()
    if (error) {
      const dict = await getDictionary(lang)
      return { error: friendlyDbError(error, dict.inventory.duplicateCode), created: [], restocked: [] }
    }
    created = data ?? []
  }

  const restocked: Consumable[] = []
  for (const { consumableId, quantity } of payload.toRestock) {
    const { data, error } = await supabase
      .rpc('restock_consumable', { p_consumable_id: consumableId, p_quantity: quantity })
      .single()
    if (error) {
      revalidatePath(`/${lang}/inventory`)
      return {
        error: `Restocked ${restocked.length} of ${payload.toRestock.length} matched items before this error: ${error.message}`,
        created,
        restocked,
      }
    }
    restocked.push(data as Consumable)
  }

  revalidatePath(`/${lang}/inventory`)
  return { created, restocked }
}

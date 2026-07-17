import { createClient } from '@/lib/supabase/server'
import type { ConsumableOption } from './consumables'

export interface TeamStockRow {
  id: string
  consumable_id: string
  qty_in_stock: number
  consumable: {
    code: string | null
    name: string
    category: string
    unit: string
    qty_minimum: number
    is_active: boolean
  } | null
}

// Querying from team_stock (not consumables) is what makes "only what's been
// issued" work — a row here only exists once transfer_to_team_stock created
// it, so an un-issued consumable simply never appears.
export async function getTeamStock({ includeInactive = false } = {}): Promise<TeamStockRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_stock')
    .select('id, consumable_id, qty_in_stock, consumable:consumables(code, name, category, unit, qty_minimum, is_active)')

  const rows = (data ?? []) as unknown as TeamStockRow[]
  return rows
    .filter(r => includeInactive || r.consumable?.is_active)
    .sort((a, b) =>
      (a.consumable?.category ?? '').localeCompare(b.consumable?.category ?? '') ||
      (a.consumable?.name ?? '').localeCompare(b.consumable?.name ?? '')
    )
}

// Same underlying data, shaped like ConsumableOption so it drops straight
// into the existing call write-off picker (NewCallForm/EditCallForm).
// includeInactive matters for the edit form: a call may have written off an
// item since deactivated, and still needs to show it for that existing row.
export async function getTeamStockOptions({ includeInactive = false } = {}): Promise<ConsumableOption[]> {
  const rows = await getTeamStock({ includeInactive })
  return rows.map(r => ({
    id: r.consumable_id,
    code: r.consumable?.code ?? null,
    name: r.consumable?.name ?? '',
    unit: (r.consumable?.unit ?? 'pcs') as ConsumableOption['unit'],
    category: r.consumable?.category ?? 'other',
    is_active: r.consumable?.is_active ?? false,
    qty_in_stock: r.qty_in_stock,
  }))
}

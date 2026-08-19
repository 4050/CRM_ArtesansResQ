import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ConsumableOption } from './consumables'

// Runtime boundary check - see the comment in lib/data/movements.ts for why
// this is more than a type annotation (no generated Supabase types here).
const teamStockRowSchema = z.object({
  id: z.string(),
  consumable_id: z.string(),
  qty_in_stock: z.number(),
  consumable: z.object({
    code: z.string().nullable(),
    name: z.string(),
    category: z.string(),
    unit: z.string(),
    qty_minimum: z.number(),
    is_active: z.boolean(),
  }).nullable(),
})

export type TeamStockRow = z.infer<typeof teamStockRowSchema>

// Querying from team_stock (not consumables) is what makes "only what's been
// issued" work — a row here only exists once transfer_to_team_stock created
// it, so an un-issued consumable simply never appears.
export async function getTeamStock({ includeInactive = false } = {}): Promise<TeamStockRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('team_stock')
    .select('id, consumable_id, qty_in_stock, consumable:consumables(code, name, category, unit, qty_minimum, is_active)')
  if (error) throw new Error(error.message)

  const rows = z.array(teamStockRowSchema).parse(data ?? [])
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

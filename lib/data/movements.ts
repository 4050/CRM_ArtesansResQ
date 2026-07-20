import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { StockMovementType } from '@/types'

export type Warehouse = 'main' | 'team'

export interface MovementListFilters {
  consumableId?: string
  userId?: string
  type?: StockMovementType
  warehouse?: Warehouse
  fromIso?: string
  toIso?: string
}

// Supabase's nested-relation `select()` results aren't typed against a
// generated schema in this project (no `supabase gen types` step), so the
// query below returns effectively untyped data - this schema is the actual
// boundary check, not just a type annotation. A shape mismatch throws a
// clear ZodError instead of silently trusting an `as unknown as` cast.
const movementRowSchema = z.object({
  id: z.string(),
  consumable_id: z.string(),
  movement_type: z.enum(['opening_balance', 'increase', 'decrease']),
  quantity_delta: z.number(),
  quantity_before: z.number(),
  quantity_after: z.number(),
  user_id: z.string().nullable(),
  created_at: z.string(),
  warehouse: z.enum(['main', 'team']),
  consumable: z.object({ name: z.string(), unit: z.string(), category: z.string() }).nullable(),
  user: z.object({ name: z.string() }).nullable(),
})

export type MovementRow = z.infer<typeof movementRowSchema>

export async function getStockMovements(filters: MovementListFilters = {}): Promise<MovementRow[]> {
  const supabase = await createClient()
  let query = supabase
    .from('stock_movements')
    .select(`
      id, consumable_id, movement_type, quantity_delta,
      quantity_before, quantity_after, user_id, created_at, warehouse,
      consumable:consumables(name, unit, category),
      user:users(name)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  if (filters.consumableId) query = query.eq('consumable_id', filters.consumableId)
  if (filters.userId) query = query.eq('user_id', filters.userId)
  if (filters.type) query = query.eq('movement_type', filters.type)
  if (filters.warehouse) query = query.eq('warehouse', filters.warehouse)
  if (filters.fromIso) query = query.gte('created_at', filters.fromIso)
  if (filters.toIso) query = query.lte('created_at', filters.toIso)

  const { data } = await query
  return z.array(movementRowSchema).parse(data ?? [])
}

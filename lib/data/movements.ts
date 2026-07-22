import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { StockMovementType } from '@/types'

export type Warehouse = 'main' | 'team'

const DEFAULT_PAGE_SIZE = 500

export interface MovementListFilters {
  consumableId?: string
  userId?: string
  type?: StockMovementType
  warehouse?: Warehouse
  fromIso?: string
  toIso?: string
  page?: number
  pageSize?: number
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
  consumable: z.object({ name: z.string(), unit: z.string(), category: z.string(), source: z.string() }).nullable(),
  user: z.object({ name: z.string() }).nullable(),
})

export type MovementRow = z.infer<typeof movementRowSchema>

export interface MovementPage {
  rows: MovementRow[]
  count: number
  page: number
  pageSize: number
}

export async function getStockMovements(filters: MovementListFilters = {}): Promise<MovementPage> {
  const supabase = await createClient()
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('stock_movements')
    .select(`
      id, consumable_id, movement_type, quantity_delta,
      quantity_before, quantity_after, user_id, created_at, warehouse,
      consumable:consumables(name, unit, category, source),
      user:users(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.consumableId) query = query.eq('consumable_id', filters.consumableId)
  if (filters.userId) query = query.eq('user_id', filters.userId)
  if (filters.type) query = query.eq('movement_type', filters.type)
  if (filters.warehouse) query = query.eq('warehouse', filters.warehouse)
  if (filters.fromIso) query = query.gte('created_at', filters.fromIso)
  if (filters.toIso) query = query.lte('created_at', filters.toIso)

  const { data, count } = await query
  return {
    rows: z.array(movementRowSchema).parse(data ?? []),
    count: count ?? 0,
    page,
    pageSize,
  }
}

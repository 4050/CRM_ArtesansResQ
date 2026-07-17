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

export interface MovementRow {
  id: string
  consumable_id: string
  movement_type: StockMovementType
  quantity_delta: number
  quantity_before: number
  quantity_after: number
  user_id: string | null
  created_at: string
  warehouse: Warehouse
  consumable: { name: string; unit: string; category: string } | null
  user: { name: string } | null
}

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
  return (data ?? []) as unknown as MovementRow[]
}

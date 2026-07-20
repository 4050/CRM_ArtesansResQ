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
      consumable:consumables(name, unit, category),
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
    rows: (data ?? []) as unknown as MovementRow[],
    count: count ?? 0,
    page,
    pageSize,
  }
}

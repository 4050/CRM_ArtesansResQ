import { createClient } from '@/lib/supabase/server'

const DEFAULT_PAGE_SIZE = 50

export interface CallListFilters {
  vehicleId?: string
  bagId?: string
  userId?: string
  page?: number
  pageSize?: number
}

export interface CallListRow {
  id: string
  call_number: string | null
  date: string
  description: string | null
  vehicle: { number: string } | null
  bag: { number: string } | null
  user: { name: string } | null
}

export interface CallListPage {
  rows: CallListRow[]
  count: number
  page: number
  pageSize: number
}

export async function getCalls(filters: CallListFilters = {}): Promise<CallListPage> {
  const supabase = await createClient()
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('calls')
    .select('*, vehicle:vehicles(number), bag:bags(number), user:users(name)', { count: 'exact' })
    .order('date', { ascending: false })
    .range(from, to)

  if (filters.vehicleId) query = query.eq('vehicle_id', filters.vehicleId)
  if (filters.bagId) query = query.eq('bag_id', filters.bagId)
  if (filters.userId) query = query.eq('user_id', filters.userId)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)
  return { rows: data ?? [], count: count ?? 0, page, pageSize }
}

export type RecentCallRow = Omit<CallListRow, 'description'>

export async function getRecentCalls(limit: number): Promise<RecentCallRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('calls')
    .select('id, call_number, date, vehicle:vehicles(number), bag:bags(number), user:users(name)')
    .order('date', { ascending: false })
    .limit(limit)
    .returns<RecentCallRow[]>()
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCallsCountSince(isoDate: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .gte('date', isoDate)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function getCallDetail(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('calls')
    .select(`
      *,
      vehicle:vehicles(number, name),
      bag:bags(number, description),
      user:users(name),
      writeoffs(
        id,
        quantity,
        consumable_id,
        consumable:consumables(name, unit, category)
      )
    `)
    .eq('id', id)
    .single()
  // PGRST116 ("no rows") means "call not found" - callers 404 on that
  // themselves. Only a real DB error should throw here.
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data
}

export async function getCallForEdit(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('calls')
    .select('*, writeoffs(id, quantity, consumable_id, consumable:consumables(name, unit, qty_in_stock, category))')
    .eq('id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data
}

import { createClient } from '@/lib/supabase/server'

export interface WriteoffListFilters {
  consumableId?: string
  userId?: string
}

export interface WriteoffRow {
  id: string
  call_id: string | null
  consumable_id: string
  quantity: number
  created_at: string
  consumable: { name: string; unit: string; category: string } | null
  user: { name: string } | null
  call: {
    call_number: string | null
    date: string
    vehicle: { number: string } | null
    bag: { number: string } | null
  } | null
}

export interface WriteoffSummaryRow {
  quantity: number
  consumable: { name: string; unit: string; category: string } | null
  user: { name: string } | null
}

export async function getWriteoffs(filters: WriteoffListFilters = {}): Promise<WriteoffRow[]> {
  const supabase = await createClient()
  let query = supabase
    .from('writeoffs')
    .select(`
      *,
      consumable:consumables(name, unit, category),
      user:users(name),
      call:calls(call_number, date, vehicle:vehicles(number), bag:bags(number))
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters.consumableId) query = query.eq('consumable_id', filters.consumableId)
  if (filters.userId) query = query.eq('user_id', filters.userId)

  const { data } = await query
  return (data ?? []) as unknown as WriteoffRow[]
}

export async function getWriteoffsSince(isoDate: string): Promise<{ quantity: number }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('writeoffs')
    .select('quantity')
    .gte('created_at', isoDate)
  return data ?? []
}

export async function getWriteoffsInRange(fromIso: string, toIso: string): Promise<WriteoffSummaryRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('writeoffs')
    .select('quantity, consumable:consumables(name, unit, category), user:users(name)')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(5000)
  return (data ?? []) as unknown as WriteoffSummaryRow[]
}

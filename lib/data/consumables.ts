import { createClient } from '@/lib/supabase/server'
import type { Consumable } from '@/types'

export type ConsumableOption = Pick<
  Consumable,
  'id' | 'code' | 'name' | 'unit' | 'qty_in_stock' | 'category' | 'is_active'
>

export async function getActiveConsumables(): Promise<Consumable[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('consumables')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')
  return data ?? []
}

export async function getStockLevels() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('consumables')
    .select('id, name, unit, qty_in_stock, qty_minimum')
    .eq('is_active', true)
    .order('qty_in_stock')
  return data ?? []
}

export async function getConsumableOptions({ includeInactive = false } = {}): Promise<ConsumableOption[]> {
  const supabase = await createClient()
  let query = supabase
    .from('consumables')
    .select('id, code, name, unit, qty_in_stock, category, is_active')
    .order('category')
    .order('name')

  if (!includeInactive) query = query.eq('is_active', true)

  const { data } = await query
  return data ?? []
}

export async function getConsumableNameOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('consumables').select('id, name').order('name')
  return data ?? []
}

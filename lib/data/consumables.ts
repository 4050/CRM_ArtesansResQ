import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Consumable } from '@/types'

export type ConsumableOption = Pick<
  Consumable,
  'id' | 'code' | 'name' | 'unit' | 'qty_in_stock' | 'category' | 'is_active'
>

// Runtime boundary check - see the comment in lib/data/movements.ts for why
// this is more than a type annotation (no generated Supabase types here).
// `unit` is validated as a plain string, not the ConsumableUnit enum: like
// category/source, the column itself is unconstrained free text (see
// schema.sql), so the interface's stricter type is an app-level assumption
// that a runtime check would be too strict to actually enforce.
const consumableSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  category: z.string(),
  unit: z.string(),
  source: z.string(),
  qty_in_stock: z.number(),
  qty_minimum: z.number(),
  description: z.string().nullable(),
  is_active: z.boolean(),
})

function parseConsumables(data: unknown): Consumable[] {
  return z.array(consumableSchema).parse(data) as Consumable[]
}

const consumableOptionSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  unit: z.string(),
  qty_in_stock: z.number(),
  category: z.string(),
  is_active: z.boolean(),
})

export async function getActiveConsumables(): Promise<Consumable[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consumables')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')
  if (error) throw new Error(error.message)
  return parseConsumables(data ?? [])
}

export async function getAllConsumables(): Promise<Consumable[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consumables')
    .select('*')
    .order('category')
    .order('name')
  if (error) throw new Error(error.message)
  return parseConsumables(data ?? [])
}

const stockLevelSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  qty_in_stock: z.number(),
  qty_minimum: z.number(),
})

export async function getStockLevels() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consumables')
    .select('id, name, unit, qty_in_stock, qty_minimum')
    .eq('is_active', true)
    .order('qty_in_stock')
  if (error) throw new Error(error.message)
  return z.array(stockLevelSchema).parse(data ?? [])
}

export async function getConsumableOptions({ includeInactive = false } = {}): Promise<ConsumableOption[]> {
  const supabase = await createClient()
  let query = supabase
    .from('consumables')
    .select('id, code, name, unit, qty_in_stock, category, is_active')
    .order('category')
    .order('name')

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return z.array(consumableOptionSchema).parse(data ?? []) as ConsumableOption[]
}

const consumableNameOptionSchema = z.object({ id: z.string(), name: z.string() })

export async function getConsumableNameOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('consumables').select('id, name').order('name')
  if (error) throw new Error(error.message)
  return z.array(consumableNameOptionSchema).parse(data ?? [])
}

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export interface WriteoffListFilters {
  consumableId?: string
  userId?: string
}

// Runtime boundary check - see the comment in lib/data/movements.ts for why
// this is more than a type annotation (no generated Supabase types here).
const consumableSummarySchema = z.object({ name: z.string(), unit: z.string(), category: z.string(), source: z.string() }).nullable()
const userSummarySchema = z.object({ name: z.string() }).nullable()

const writeoffRowSchema = z.object({
  id: z.string(),
  call_id: z.string().nullable(),
  consumable_id: z.string(),
  quantity: z.number(),
  created_at: z.string(),
  consumable: consumableSummarySchema,
  user: userSummarySchema,
  call: z.object({
    call_number: z.string().nullable(),
    date: z.string(),
    vehicle: z.object({ number: z.string() }).nullable(),
    bag: z.object({ number: z.string() }).nullable(),
  }).nullable(),
})

export type WriteoffRow = z.infer<typeof writeoffRowSchema>

const writeoffSummaryRowSchema = z.object({
  quantity: z.number(),
  consumable: consumableSummarySchema,
  user: userSummarySchema,
})

export type WriteoffSummaryRow = z.infer<typeof writeoffSummaryRowSchema>

export async function getWriteoffs(filters: WriteoffListFilters = {}): Promise<WriteoffRow[]> {
  const supabase = await createClient()
  let query = supabase
    .from('writeoffs')
    .select(`
      *,
      consumable:consumables(name, unit, category, source),
      user:users(name),
      call:calls(call_number, date, vehicle:vehicles(number), bag:bags(number))
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters.consumableId) query = query.eq('consumable_id', filters.consumableId)
  if (filters.userId) query = query.eq('user_id', filters.userId)

  const { data } = await query
  return z.array(writeoffRowSchema).parse(data ?? [])
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
    .select('quantity, consumable:consumables(name, unit, category, source), user:users(name)')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(5000)
  return z.array(writeoffSummaryRowSchema).parse(data ?? [])
}

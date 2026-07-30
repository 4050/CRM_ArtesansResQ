import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export interface WriteoffListFilters {
  consumableId?: string
  userId?: string
  // Filters by the consumable's procurement source. writeoffs has no source
  // column of its own (it's a property of the consumable, not the
  // write-off), so this is resolved to a set of consumable ids up front -
  // see the same tradeoff explained in lib/data/movements.ts.
  source?: string
}

// Runtime boundary check - see the comment in lib/data/movements.ts for why
// this is more than a type annotation (no generated Supabase types here).
const consumableSummarySchema = z.object({ name: z.string(), unit: z.string(), category: z.string(), source: z.string() }).nullable()
const userSummarySchema = z.object({ name: z.string() }).nullable()

const writeoffRowSchema = z.object({
  id: z.string(),
  call_id: z.string().nullable(),
  // Nullable since 202607230001: delete_consumable no longer refuses when
  // write-offs still reference the item, it just nulls this out instead.
  consumable_id: z.string().nullable(),
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

  if (filters.source) {
    const { data: matches } = await supabase.from('consumables').select('id').eq('source', filters.source)
    const ids = (matches ?? []).map(c => c.id)
    if (ids.length === 0) return []
    query = query.in('consumable_id', ids)
  }

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

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_PAGE_SIZE = 50

export interface WriteoffListFilters {
  consumableId?: string
  userId?: string
  // Filters by the consumable's procurement source. writeoffs has no source
  // column of its own (it's a property of the consumable, not the
  // write-off), so this is resolved to a set of consumable ids up front -
  // see the same tradeoff explained in lib/data/movements.ts.
  source?: string
  page?: number
  pageSize?: number
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

const writeoffsReportSchema = z.object({
  operations: z.number(),
  totalQuantity: z.number(),
  employees: z.number(),
  byConsumable: z.array(z.object({
    // null means every write-off in this bucket belonged to a since-deleted
    // consumable (its category/source/unit are null for the same reason —
    // see writeoffs_report's `left join`).
    name: z.string().nullable(),
    unit: z.string().nullable(),
    category: z.string().nullable(),
    source: z.string().nullable(),
    quantity: z.number(),
  })),
})

export type WriteoffsReport = z.infer<typeof writeoffsReportSchema>

export interface WriteoffListPage {
  rows: WriteoffRow[]
  count: number
  page: number
  pageSize: number
}

export async function getWriteoffs(filters: WriteoffListFilters = {}): Promise<WriteoffListPage> {
  const supabase = await createClient()
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('writeoffs')
    .select(`
      *,
      consumable:consumables(name, unit, category, source),
      user:users(name),
      call:calls(call_number, date, vehicle:vehicles(number), bag:bags(number))
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.consumableId) query = query.eq('consumable_id', filters.consumableId)
  if (filters.userId) query = query.eq('user_id', filters.userId)

  if (filters.source) {
    const { data: matches } = await supabase.from('consumables').select('id').eq('source', filters.source)
    const ids = (matches ?? []).map(c => c.id)
    if (ids.length === 0) return { rows: [], count: 0, page, pageSize }
    query = query.in('consumable_id', ids)
  }

  const { data, count } = await query
  return { rows: z.array(writeoffRowSchema).parse(data ?? []), count: count ?? 0, page, pageSize }
}

export async function getWriteoffsSince(isoDate: string): Promise<{ quantity: number }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('writeoffs')
    .select('quantity')
    .gte('created_at', isoDate)
  return data ?? []
}

// Aggregated in SQL (writeoffs_report) rather than fetched as raw rows and
// summed in JS - a date range wide enough to include more rows than a raw
// fetch could reasonably cap at would otherwise silently under-count.
export async function getWriteoffsInRange(fromIso: string, toIso: string): Promise<WriteoffsReport> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('writeoffs_report', { p_from: fromIso, p_to: toIso })
  if (error) throw new Error(error.message)
  return writeoffsReportSchema.parse(data)
}

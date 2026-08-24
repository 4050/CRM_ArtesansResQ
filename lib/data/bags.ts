import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Bag } from '@/types'

// Runtime boundary check - see the comment in lib/data/movements.ts for why
// this is more than a type annotation (no generated Supabase types here).
const bagSchema = z.object({
  id: z.string(),
  number: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
})

export async function getBags(): Promise<Bag[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('bags').select('*').order('number')
  if (error) throw new Error(error.message)
  return z.array(bagSchema).parse(data ?? [])
}

export async function getActiveBags(): Promise<Bag[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('bags').select('*').eq('is_active', true).order('number')
  if (error) throw new Error(error.message)
  return z.array(bagSchema).parse(data ?? [])
}

import { createClient } from '@/lib/supabase/server'
import type { Bag } from '@/types'

export async function getBags(): Promise<Bag[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('bags').select('*').order('number')
  return data ?? []
}

export async function getActiveBags(): Promise<Bag[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('bags').select('*').eq('is_active', true).order('number')
  return data ?? []
}

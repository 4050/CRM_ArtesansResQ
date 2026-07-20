import { createClient } from '@/lib/supabase/server'
import type { Bag } from '@/types'

export async function getBags(): Promise<Bag[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('bags').select('*').order('number')
  return data ?? []
}

export async function getBagsWithVehicle(): Promise<(Bag & { vehicle?: { number: string } })[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bags')
    .select('*, vehicle:vehicles(number)')
    .order('number')
  return data ?? []
}

export async function getActiveBags(): Promise<Bag[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('bags').select('*').eq('is_active', true).order('number')
  return data ?? []
}

export async function getActiveBagsWithVehicle(): Promise<(Bag & { vehicle?: { number: string } })[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bags')
    .select('*, vehicle:vehicles(number)')
    .eq('is_active', true)
    .order('number')
  return data ?? []
}

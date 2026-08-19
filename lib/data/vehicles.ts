import { createClient } from '@/lib/supabase/server'
import type { Vehicle } from '@/types'

export async function getActiveVehicles(): Promise<Vehicle[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('is_active', true)
    .order('number')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAllVehicles(): Promise<Vehicle[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('vehicles').select('*').order('number')
  if (error) throw new Error(error.message)
  return data ?? []
}

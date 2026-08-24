import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Vehicle } from '@/types'

// Runtime boundary check - see the comment in lib/data/movements.ts for why
// this is more than a type annotation (no generated Supabase types here).
const vehicleSchema = z.object({
  id: z.string(),
  number: z.string(),
  name: z.string().nullable(),
  is_active: z.boolean(),
})

export async function getActiveVehicles(): Promise<Vehicle[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('is_active', true)
    .order('number')
  if (error) throw new Error(error.message)
  return z.array(vehicleSchema).parse(data ?? [])
}

export async function getAllVehicles(): Promise<Vehicle[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('vehicles').select('*').order('number')
  if (error) throw new Error(error.message)
  return z.array(vehicleSchema).parse(data ?? [])
}

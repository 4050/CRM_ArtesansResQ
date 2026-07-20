'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/app/[lang]/dictionaries'
import type { Vehicle, Bag } from '@/types'

export interface NewVehicleInput {
  number: string
  name: string | null
}

export interface NewBagInput {
  number: string
  vehicle_id: string
  description: string | null
}

export interface VehicleFormInput {
  number: string
  name: string | null
  is_active: boolean
}

export interface BagFormInput {
  number: string
  vehicle_id: string
  description: string | null
  is_active: boolean
}

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string }

export async function createVehicleAction(lang: Locale, input: NewVehicleInput): Promise<ActionResult<Vehicle>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('vehicles').insert([input]).select().single()
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/vehicles`)
  return { data }
}

export async function updateVehicleAction(lang: Locale, id: string, input: VehicleFormInput): Promise<ActionResult<Vehicle>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('vehicles').update(input).eq('id', id).select().single()
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/vehicles`)
  return { data }
}

export async function archiveVehicleAction(lang: Locale, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_vehicle', { p_vehicle_id: id })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/vehicles`)
  return {}
}

export async function deleteVehicleAction(lang: Locale, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_vehicle', { p_vehicle_id: id })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/vehicles`)
  return {}
}

export async function createBagAction(lang: Locale, input: NewBagInput): Promise<ActionResult<Bag>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('bags').insert([input]).select().single()
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/vehicles`)
  return { data }
}

export async function updateBagAction(lang: Locale, id: string, input: BagFormInput): Promise<ActionResult<Bag>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('bags').update(input).eq('id', id).select().single()
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/vehicles`)
  return { data }
}

export async function archiveBagAction(lang: Locale, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_bag', { p_bag_id: id })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/vehicles`)
  return {}
}

export async function deleteBagAction(lang: Locale, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_bag', { p_bag_id: id })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/vehicles`)
  return {}
}

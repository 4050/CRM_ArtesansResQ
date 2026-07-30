'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/app/[lang]/dictionaries'
import type { Consumable, ConsumableUnit } from '@/types'

export interface ConsumableFormInput {
  code: string | null
  name: string
  category: string
  unit: ConsumableUnit
  source: string
  qty_minimum: number
  description: string
  is_active: boolean
}

export interface NewConsumableInput extends ConsumableFormInput {
  qty_in_stock: number
}

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string }

export async function createConsumableAction(lang: Locale, input: NewConsumableInput): Promise<ActionResult<Consumable>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('consumables').insert([input]).select().single()
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/inventory`)
  return { data }
}

export async function updateConsumableAction(lang: Locale, id: string, input: ConsumableFormInput): Promise<ActionResult<Consumable>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('consumables').update(input).eq('id', id).select().single()
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/inventory`)
  return { data }
}

export async function restockConsumableAction(lang: Locale, id: string, quantity: number): Promise<ActionResult<Consumable>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('restock_consumable', { p_consumable_id: id, p_quantity: quantity })
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/inventory`)
  return { data: data as Consumable }
}

export async function archiveConsumableAction(lang: Locale, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_consumable', { p_consumable_id: id })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/inventory`)
  return {}
}

export async function deleteConsumableAction(lang: Locale, id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_consumable', { p_consumable_id: id })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/inventory`)
  return {}
}

export async function transferToTeamStockAction(lang: Locale, id: string, quantity: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('transfer_to_team_stock', { p_consumable_id: id, p_quantity: quantity })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/inventory`)
  revalidatePath(`/${lang}/team-stock`)
  return {}
}

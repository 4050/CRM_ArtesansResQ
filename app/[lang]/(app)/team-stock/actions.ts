'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/app/[lang]/dictionaries'

export async function returnFromTeamStockAction(lang: Locale, consumableId: string, quantity: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('return_from_team_stock', { p_consumable_id: consumableId, p_quantity: quantity })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/team-stock`)
  revalidatePath(`/${lang}/inventory`)
  return {}
}

export async function discardFromTeamStockAction(lang: Locale, consumableId: string, quantity: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('discard_from_team_stock', { p_consumable_id: consumableId, p_quantity: quantity })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/team-stock`)
  return {}
}

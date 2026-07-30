'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDictionary, type Locale, type Dictionary } from '@/app/[lang]/dictionaries'
import type { WriteoffInput } from '@/types'

export interface CallInput {
  date: string
  description: string
  vehicleId: string
  bagId: string
  writeoffs: WriteoffInput[]
}

function migrationAwareMessage(dict: Dictionary, prefix: string, error: { code?: string; message: string }) {
  return error.code === 'PGRST202'
    ? dict.calls.errors.migrationsNeeded
    : `${prefix}: ${error.message}`
}

export async function createCallAction(lang: Locale, input: CallInput): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_call_with_writeoffs', {
    p_date: input.date,
    p_description: input.description,
    p_vehicle_id: input.vehicleId,
    p_bag_id: input.bagId,
    p_writeoffs: input.writeoffs,
  })

  if (error) {
    const dict = await getDictionary(lang)
    return { error: migrationAwareMessage(dict, dict.calls.errors.saving, error) }
  }

  revalidatePath(`/${lang}/writeoffs`)
  revalidatePath(`/${lang}/dashboard`)
  redirect(`/${lang}/writeoffs`)
}

export async function updateCallAction(lang: Locale, callId: string, input: CallInput): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_call_with_writeoffs', {
    p_call_id: callId,
    p_date: input.date,
    p_description: input.description,
    p_vehicle_id: input.vehicleId,
    p_bag_id: input.bagId,
    p_writeoffs: input.writeoffs,
  })

  if (error) {
    const dict = await getDictionary(lang)
    return { error: migrationAwareMessage(dict, dict.calls.errors.updating, error) }
  }

  revalidatePath(`/${lang}/calls/${callId}`)
  revalidatePath(`/${lang}/writeoffs`)
  redirect(`/${lang}/calls/${callId}`)
}

export async function deleteCallAction(lang: Locale, callId: string): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_call_with_writeoffs', { p_call_id: callId })

  if (error) {
    const dict = await getDictionary(lang)
    return { error: migrationAwareMessage(dict, dict.calls.errors.deleting, error) }
  }

  revalidatePath(`/${lang}/writeoffs`)
  redirect(`/${lang}/writeoffs`)
}

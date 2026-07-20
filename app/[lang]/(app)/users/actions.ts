'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/app/[lang]/dictionaries'

export async function setUserRoleAction(lang: Locale, userId: string, role: 'admin' | 'medic'): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/users`)
  return {}
}

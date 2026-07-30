'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary, type Locale } from '@/app/[lang]/dictionaries'

export async function loginAction(lang: Locale, email: string, password: string): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const dict = await getDictionary(lang)
    return { error: dict.login.invalidCredentials }
  }

  redirect(`/${lang}/dashboard`)
}

export async function logoutAction(lang: Locale): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(`/${lang}/login`)
}

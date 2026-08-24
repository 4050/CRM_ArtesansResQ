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

// Completes an invite: the session here comes from auth/confirm's
// verifyOtp(type: 'invite') call, not a password login, so this is the one
// path allowed to set a password without already knowing one.
export async function setPasswordAction(lang: Locale, password: string): Promise<{ error: string } | void> {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims.sub) {
    const dict = await getDictionary(lang)
    return { error: dict.setPassword.expiredLink }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    const dict = await getDictionary(lang)
    return { error: dict.setPassword.weakPassword }
  }

  redirect(`/${lang}/dashboard`)
}

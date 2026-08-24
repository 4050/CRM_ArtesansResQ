'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/data/users'
import { isAdminRole } from '@/lib/roles'
import { getDictionary, type Locale } from '@/app/[lang]/dictionaries'

async function siteOrigin(): Promise<string> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = h.get('x-forwarded-host') ?? h.get('host')
  return `${proto}://${host}`
}

// Registration is invite-only: handle_new_user() (see supabase/schema.sql)
// requires organization_id in raw_user_meta_data and rolls back the auth.users
// insert without it, so the only way to get an account is through this
// action - it's what makes "approved" mean anything. Client-side signUp is
// never wired up anywhere in the app for that reason.
export async function inviteUserAction(lang: Locale, email: string): Promise<{ error?: string }> {
  const dict = await getDictionary(lang)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub
  const profile = userId ? await getProfile(userId) : null

  if (!profile || !isAdminRole(profile.role)) {
    return { error: dict.invite.forbidden }
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return { error: dict.invite.emailRequired }
  }

  const origin = await siteOrigin()
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: { organization_id: profile.organization_id },
    redirectTo: `${origin}/${lang}/auth/confirm`,
  })

  if (error) {
    return { error: error.message }
  }

  return {}
}

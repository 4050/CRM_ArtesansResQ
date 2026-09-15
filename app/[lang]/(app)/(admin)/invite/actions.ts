'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth-guards'
import { isAdminRole } from '@/lib/roles'
import { getDictionary, type Locale } from '@/app/[lang]/dictionaries'

async function siteOrigin(): Promise<string> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = h.get('x-forwarded-host') ?? h.get('host')
  return `${proto}://${host}`
}

// Shared by both actions below - each is a distinct way of onboarding a
// user (email invite vs. admin-set password), but both need the same
// "caller is admin-or-above, in this organization" check first.
async function requireAdminOrgId(lang: Locale): Promise<{ organizationId: string } | { error: string }> {
  const dict = await getDictionary(lang)
  const caller = await requireRole(isAdminRole, dict.invite.forbidden)
  if ('error' in caller) return caller

  return { organizationId: caller.organization_id }
}

// Registration is invite-only: handle_new_user() (see supabase/schema.sql)
// requires organization_id in raw_user_meta_data and rolls back the auth.users
// insert without it, so the only way to get an account is through one of the
// two actions in this file - that's what makes "approved" mean anything.
// Client-side signUp is never wired up anywhere in the app for that reason.
export async function inviteUserAction(lang: Locale, email: string): Promise<{ error?: string }> {
  const guard = await requireAdminOrgId(lang)
  if ('error' in guard) return guard

  const dict = await getDictionary(lang)
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return { error: dict.invite.emailRequired }
  }

  const origin = await siteOrigin()
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: { organization_id: guard.organizationId },
    redirectTo: `${origin}/${lang}/auth/confirm`,
  })

  if (error) {
    return { error: error.message }
  }

  return {}
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
}

// Alternative to inviteUserAction for when email delivery isn't set up yet
// (or an admin just prefers to hand the credentials over directly): creates
// an already-active account with the password the admin chose, no email
// involved. email_confirm: true skips Supabase's own confirmation step -
// the admin picking the password already is the approval.
export async function createUserAction(lang: Locale, input: CreateUserInput): Promise<{ error?: string }> {
  const guard = await requireAdminOrgId(lang)
  if ('error' in guard) return guard

  const dict = await getDictionary(lang)
  const normalizedEmail = input.email.trim().toLowerCase()
  const name = input.name.trim()

  if (!normalizedEmail) {
    return { error: dict.invite.emailRequired }
  }
  if (!name) {
    return { error: dict.invite.nameRequired }
  }
  if (input.password.length < 8) {
    return { error: dict.invite.passwordTooShort }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: { organization_id: guard.organizationId, name },
  })

  if (error) {
    return { error: error.message }
  }

  return {}
}

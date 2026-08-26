'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/data/users'
import { isMasterAdmin } from '@/lib/roles'
import { getDictionary, type Locale } from '@/app/[lang]/dictionaries'

export async function setUserRoleAction(lang: Locale, userId: string, role: 'admin' | 'medic'): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role })
  if (error) return { error: error.message }
  revalidatePath(`/${lang}/users`)
  return {}
}

// Shared by setUserActiveAction/deleteUserAction below: both act on
// another user's auth.users record through the Auth Admin API rather than
// a SQL RPC, so they can't lean on set_user_role's RLS-adjacent guardrails
// (202607170016_role_tiers.sql) - the same three checks are reproduced
// here instead: caller must be master_admin, target must be a non-self,
// non-master_admin member of the caller's own organization. The org/
// existence check reads through the caller's own RLS-scoped client (not
// the admin client) - "Authenticated users can read users" already scopes
// that select to the caller's organization, so a row from another org (or
// a nonexistent id) simply comes back empty.
async function requireMasterAdminTarget(lang: Locale, userId: string): Promise<{ userId: string } | { error: string }> {
  const dict = await getDictionary(lang)
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const callerId = claimsData?.claims.sub

  const profile = callerId ? await getProfile(callerId) : null
  if (!profile || !isMasterAdmin(profile.role)) {
    return { error: dict.users.forbidden }
  }
  if (userId === callerId) {
    return { error: dict.users.cannotTargetSelf }
  }

  const { data: target } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single()

  if (!target) {
    return { error: dict.users.notFound }
  }
  if (target.role === 'master_admin') {
    return { error: dict.users.cannotTargetMasterAdmin }
  }

  return { userId: target.id }
}

// Restricting access bans the account at the Auth level (blocks new
// logins and refresh-token renewal) and mirrors the flag onto
// public.users.is_active, which current_org_id() now also checks -
// cutting the account off from every RLS-scoped table immediately,
// without waiting for their current access token to expire. See
// 202608260001_master_admin_restrict_delete_users.sql.
export async function setUserActiveAction(lang: Locale, userId: string, active: boolean): Promise<{ error?: string }> {
  const guard = await requireMasterAdminTarget(lang, userId)
  if ('error' in guard) return guard

  const admin = createAdminClient()

  const { error: authError } = await admin.auth.admin.updateUserById(guard.userId, {
    ban_duration: active ? 'none' : '876000h',
  })
  if (authError) return { error: authError.message }

  const { error: dbError } = await admin.from('users').update({ is_active: active }).eq('id', guard.userId)
  if (dbError) return { error: dbError.message }

  revalidatePath(`/${lang}/users`)
  return {}
}

// Deletes the auth.users row via the Admin API, which cascades to
// public.users (on delete cascade) and, from there, sets user_id to null
// on their past calls/writeoffs/stock_movements (on delete set null) -
// their history stays, just unattributed. See the same migration as above.
export async function deleteUserAction(lang: Locale, userId: string): Promise<{ error?: string }> {
  const guard = await requireMasterAdminTarget(lang, userId)
  if ('error' in guard) return guard

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(guard.userId)
  if (error) return { error: error.message }

  revalidatePath(`/${lang}/users`)
  return {}
}

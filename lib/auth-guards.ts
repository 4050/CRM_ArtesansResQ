import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile, type Profile } from '@/lib/data/users'
import type { UserRole } from '@/types'

export interface CallerProfile extends Profile {
  id: string
}

// The "who is calling, and what's their profile" half of every admin-only
// server action's guard. Returns null when there's no authenticated
// session or no matching public.users row yet - callers turn that into
// their own forbidden-message shape.
export async function getCallerProfile(): Promise<CallerProfile | null> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub
  if (!userId) return null
  const profile = await getProfile(userId)
  return profile ? { ...profile, id: userId } : null
}

// Requires the caller to satisfy `check` (isAdminRole/isMasterAdmin from
// lib/roles.ts), returning their profile on success or forbiddenMessage
// otherwise - the shared half of what used to be three near-identical
// getClaims -> getProfile -> role-check blocks (importActions.ts's
// requireAdmin, invite/actions.ts's requireAdminOrgId, users/actions.ts's
// requireMasterAdminTarget). Each of those still layers its own extra
// checks (org id, self/target validation) on top of this.
export async function requireRole(
  check: (role: UserRole | null | undefined) => boolean,
  forbiddenMessage: string,
): Promise<CallerProfile | { error: string }> {
  const profile = await getCallerProfile()
  if (!profile || !check(profile.role)) {
    return { error: forbiddenMessage }
  }
  return profile
}

// Page/layout-level analog of requireRole() above: called directly from a
// Server Component (not a server action), so instead of returning
// {error} for the client to display, it short-circuits rendering with
// redirect() (typed `never` - Next.js throws internally to abort) when the
// check fails. Replaces what used to be the same getClaims -> getProfile
// -> role-check -> redirect(...) sequence written out by hand in
// (admin)/layout.tsx and users/page.tsx.
export async function requireCallerRole(
  check: (role: UserRole | null | undefined) => boolean,
  redirectTo: string,
): Promise<CallerProfile> {
  const profile = await getCallerProfile()
  if (!profile || !check(profile.role)) {
    redirect(redirectTo)
  }
  return profile
}

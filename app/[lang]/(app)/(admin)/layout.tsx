import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/users'
import { isAdminRole } from '@/lib/roles'
import { hasLocale } from '../../dictionaries'

// Single admin-only guard for every page nested under this route group
// (inventory, vehicles, movements, reports) - redirecting here means the
// page itself never renders, so those pages no longer need to repeat this
// check. users/page.tsx (master_admin-only) is intentionally not part of
// this group: it's the only master-admin-exclusive page, so a second
// nested route group for one file would be premature.
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub

  const profile = await getProfile(userId!)
  if (!isAdminRole(profile?.role)) redirect(`/${lang}/dashboard`)

  return <>{children}</>
}

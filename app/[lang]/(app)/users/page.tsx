import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getOrgMembers, getProfile } from '@/lib/data/users'
import { isMasterAdmin } from '@/lib/roles'
import { getDictionary, hasLocale } from '../../dictionaries'
import UsersClient from './UsersClient'

export default async function UsersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub

  const profile = await getProfile(userId!)
  if (!isMasterAdmin(profile?.role)) redirect(`/${lang}/dashboard`)

  const members = await getOrgMembers()

  return <UsersClient lang={lang} dict={dict} members={members} currentUserId={userId!} />
}

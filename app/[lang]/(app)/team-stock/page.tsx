import { createClient } from '@/lib/supabase/server'
import { getTeamStock } from '@/lib/data/team-stock'
import { getProfile } from '@/lib/data/users'
import { isAdminRole } from '@/lib/roles'
import { getDictionary, hasLocale } from '../../dictionaries'
import { notFound } from 'next/navigation'
import TeamStockClient from './TeamStockClient'

export default async function TeamStockPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub

  const profile = await getProfile(userId!)
  const items = await getTeamStock()

  return <TeamStockClient lang={lang} dict={dict} items={items} isAdmin={isAdminRole(profile?.role)} />
}

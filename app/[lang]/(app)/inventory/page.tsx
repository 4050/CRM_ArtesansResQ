import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveConsumables } from '@/lib/data/consumables'
import { getProfile } from '@/lib/data/users'
import { isAdminRole } from '@/lib/roles'
import { getDictionary, hasLocale } from '../../dictionaries'
import { notFound } from 'next/navigation'
import InventoryClient from './InventoryClient'

export default async function InventoryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub

  const profile = await getProfile(userId!)
  if (!isAdminRole(profile?.role)) redirect(`/${lang}/dashboard`)

  const consumables = await getActiveConsumables()

  return <InventoryClient lang={lang} dict={dict} consumables={consumables} isAdmin={isAdminRole(profile?.role)} />
}

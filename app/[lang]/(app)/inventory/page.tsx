import { createClient } from '@/lib/supabase/server'
import { getActiveConsumables } from '@/lib/data/consumables'
import { getProfile } from '@/lib/data/users'
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

  const [consumables, profile] = await Promise.all([
    getActiveConsumables(),
    getProfile(userId!),
  ])

  return <InventoryClient lang={lang} dict={dict} consumables={consumables} isAdmin={profile?.role === 'admin'} />
}

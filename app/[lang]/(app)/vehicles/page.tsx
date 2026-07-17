import { createClient } from '@/lib/supabase/server'
import { getAllVehicles } from '@/lib/data/vehicles'
import { getBagsWithVehicle } from '@/lib/data/bags'
import { getProfile } from '@/lib/data/users'
import { getDictionary, hasLocale } from '../../dictionaries'
import { notFound } from 'next/navigation'
import VehiclesClient from './VehiclesClient'

export default async function VehiclesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub

  const [vehicles, bags, profile] = await Promise.all([
    getAllVehicles(),
    getBagsWithVehicle(),
    getProfile(userId!),
  ])

  return <VehiclesClient lang={lang} dict={dict} vehicles={vehicles} bags={bags} isAdmin={profile?.role === 'admin'} />
}

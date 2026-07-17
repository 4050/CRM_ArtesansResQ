import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getActiveVehicles } from '@/lib/data/vehicles'
import { getActiveBagsWithVehicle } from '@/lib/data/bags'
import { getTeamStockOptions } from '@/lib/data/team-stock'
import { getDictionary, hasLocale } from '../../../dictionaries'
import NewCallForm from './NewCallForm'

export default async function NewCallPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub
  if (!userId) redirect(`/${lang}/login`)

  const [vehicles, bags, consumables, { data: currentUser }] = await Promise.all([
    getActiveVehicles(),
    getActiveBagsWithVehicle(),
    getTeamStockOptions(),
    supabase.from('users').select('id, name').eq('id', userId).single(),
  ])

  return (
    <NewCallForm
      lang={lang}
      dict={dict}
      vehicles={vehicles}
      bags={bags}
      consumables={consumables}
      currentUserName={currentUser?.name ?? (typeof claimsData.claims.email === 'string' ? claimsData.claims.email : '')}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getCallForEdit } from '@/lib/data/calls'
import { getActiveVehicles } from '@/lib/data/vehicles'
import { getActiveBags } from '@/lib/data/bags'
import { getConsumableOptions } from '@/lib/data/consumables'
import { getProfile } from '@/lib/data/users'
import { getDictionary, hasLocale } from '../../../../dictionaries'
import EditCallForm from './EditCallForm'

export default async function EditCallPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub
  if (!userId) redirect(`/${lang}/login`)

  const [call, vehicles, bags, consumables, profile] = await Promise.all([
    getCallForEdit(id),
    getActiveVehicles(),
    getActiveBags(),
    getConsumableOptions({ includeInactive: true }),
    getProfile(userId),
  ])

  if (!call) notFound()
  if (call.user_id !== userId && profile?.role !== 'admin') notFound()

  return (
    <EditCallForm
      lang={lang}
      dict={dict}
      call={call}
      vehicles={vehicles ?? []}
      bags={bags ?? []}
      consumables={consumables ?? []}
    />
  )
}

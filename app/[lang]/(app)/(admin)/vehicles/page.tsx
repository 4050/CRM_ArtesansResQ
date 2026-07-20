import { getAllVehicles } from '@/lib/data/vehicles'
import { getBagsWithVehicle } from '@/lib/data/bags'
import { getDictionary, hasLocale } from '../../../dictionaries'
import { notFound } from 'next/navigation'
import VehiclesClient from './VehiclesClient'

export default async function VehiclesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const [vehicles, bags] = await Promise.all([
    getAllVehicles(),
    getBagsWithVehicle(),
  ])

  // (admin)/layout.tsx already redirected any non-admin away, so anyone
  // reaching this page is guaranteed admin-or-above.
  return <VehiclesClient lang={lang} dict={dict} vehicles={vehicles} bags={bags} isAdmin={true} />
}

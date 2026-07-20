import { getAllConsumables } from '@/lib/data/consumables'
import { getDictionary, hasLocale } from '../../../dictionaries'
import { notFound } from 'next/navigation'
import InventoryClient from './InventoryClient'

export default async function InventoryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const consumables = await getAllConsumables()

  // (admin)/layout.tsx already redirected any non-admin away, so anyone
  // reaching this page is guaranteed admin-or-above.
  return <InventoryClient lang={lang} dict={dict} consumables={consumables} isAdmin={true} />
}

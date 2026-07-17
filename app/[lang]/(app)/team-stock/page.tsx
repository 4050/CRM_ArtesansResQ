import { getTeamStock } from '@/lib/data/team-stock'
import { getDictionary, hasLocale } from '../../dictionaries'
import { notFound } from 'next/navigation'
import TeamStockClient from './TeamStockClient'

export default async function TeamStockPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const items = await getTeamStock()

  return <TeamStockClient dict={dict} items={items} />
}

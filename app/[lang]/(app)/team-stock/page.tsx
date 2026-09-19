import { getTeamStock } from '@/lib/data/team-stock'
import { getCallerProfile } from '@/lib/auth-guards'
import { isAdminRole } from '@/lib/roles'
import { getDictionary, hasLocale } from '../../dictionaries'
import { notFound } from 'next/navigation'
import TeamStockClient from './TeamStockClient'

export default async function TeamStockPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const profile = await getCallerProfile()
  const isAdmin = isAdminRole(profile?.role)
  const items = await getTeamStock({ includeInactive: isAdmin })

  return <TeamStockClient lang={lang} dict={dict} items={items} isAdmin={isAdmin} />
}

import { notFound } from 'next/navigation'
import { getOrgMembers } from '@/lib/data/users'
import { requireCallerRole } from '@/lib/auth-guards'
import { isMasterAdmin } from '@/lib/roles'
import { getDictionary, hasLocale } from '../../dictionaries'
import UsersClient from './UsersClient'

export default async function UsersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const profile = await requireCallerRole(isMasterAdmin, `/${lang}/dashboard`)
  const members = await getOrgMembers()

  return <UsersClient lang={lang} dict={dict} members={members} currentUserId={profile.id} />
}

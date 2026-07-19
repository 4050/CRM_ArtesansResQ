import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/users'
import { getDictionary, hasLocale } from '../dictionaries'
import Sidebar from '@/components/layout/Sidebar'

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub

  if (!userId) redirect(`/${lang}/login`)

  const dict = await getDictionary(lang)
  const profile = await getProfile(userId)

  const email = typeof claimsData.claims.email === 'string' ? claimsData.claims.email : null
  const userName = profile?.name || email || dict.common.defaultUserName

  return (
    <div className="flex h-full">
      <Sidebar
        lang={lang}
        userName={userName}
        role={profile?.role ?? 'medic'}
        nav={dict.nav}
        appName={dict.common.appName}
        appTagline={dict.common.appTagline}
      />
      <main className="flex-1 md:ml-64 overflow-auto pt-14 md:pt-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}

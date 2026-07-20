import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasLocale } from './dictionaries'
import { notFound } from 'next/navigation'

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  redirect(claimsData?.claims.sub ? `/${lang}/dashboard` : `/${lang}/login`)
}

import { getDictionary, hasLocale } from '../../../dictionaries'
import { notFound } from 'next/navigation'
import InviteClient from './InviteClient'

export default async function InvitePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  // (admin)/layout.tsx already redirected any non-admin away, so anyone
  // reaching this page is guaranteed admin-or-above.
  return <InviteClient lang={lang} dict={dict} />
}

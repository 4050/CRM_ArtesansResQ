import type { Metadata, Viewport } from 'next'
import '../globals.css'
import { getDictionary, hasLocale, locales } from './dictionaries'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

// Colors the mobile browser's own chrome (address bar / status bar) to
// match the app instead of leaving it default gray, and pins colorScheme to
// light so mobile OSes don't auto-invert form controls into a mismatched
// dark theme this app doesn't otherwise support.
export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  if (!hasLocale(lang)) return {}
  const dict = await getDictionary(lang)

  return {
    title: dict.common.appTitle,
    description: dict.common.appDescription,
  }
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  return (
    <html lang={lang} className="h-full">
      <body className="h-full bg-slate-50">{children}</body>
    </html>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Locale } from '@/app/[lang]/dictionaries'
import { cn } from '@/lib/utils'

const LABELS: Record<Locale, string> = { en: 'EN', uk: 'UK' }
const ORDER: Locale[] = ['en', 'uk']

export default function LanguageSwitcher({ lang }: { lang: Locale }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null)

  useEffect(() => {
    if (!pendingLocale) return
    document.cookie = `locale=${pendingLocale}; path=/; max-age=31536000`
  }, [pendingLocale])

  function switchTo(locale: Locale) {
    if (locale === lang) return
    setPendingLocale(locale)
    const rest = pathname.slice(`/${lang}`.length) || '/'
    router.push(`/${locale}${rest}`)
  }

  return (
    <div className="flex items-center gap-1 text-xs font-medium">
      {ORDER.map((locale) => (
        <button
          key={locale}
          onClick={() => switchTo(locale)}
          aria-current={locale === lang ? 'true' : undefined}
          className={cn(
            'px-2 py-1 rounded-md transition-colors',
            locale === lang
              ? 'bg-slate-200 text-slate-900'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          )}
        >
          {LABELS[locale]}
        </button>
      ))}
    </div>
  )
}

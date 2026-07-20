'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

// error.tsx is a client-only Next.js boundary (no params prop), and the
// dictionary loader (app/[lang]/dictionaries.ts) is server-only, so it
// can't be imported here — this tiny inline map is the trade-off for
// that constraint rather than pulling locale text through some other path.
const TEXT = {
  en: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred while loading this page.',
    retry: 'Try again',
    dashboard: 'Go to dashboard',
  },
  uk: {
    title: 'Щось пішло не так',
    message: 'Під час завантаження сторінки сталася неочікувана помилка.',
    retry: 'Спробувати ще раз',
    dashboard: 'На дашборд',
  },
}

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname()
  const lang = pathname.startsWith('/uk') ? 'uk' : 'en'
  const t = TEXT[lang]

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-red-600" />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{t.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.message}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {t.retry}
        </button>
        <a
          href={`/${lang}/dashboard`}
          className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors"
        >
          {t.dashboard}
        </a>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Package, BarChart3, LogOut, Ambulance, Menu, X, Plus, ArrowLeftRight, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/lib/actions/auth'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import LanguageSwitcher from './LanguageSwitcher'

interface Props {
  lang: Locale
  userName: string
  nav: Dictionary['nav']
  appName: string
  appTagline: string
}

function useNavItems(lang: Locale, nav: Dictionary['nav']) {
  return [
    { href: `/${lang}/dashboard`, label: nav.dashboard, icon: LayoutDashboard },
    { href: `/${lang}/writeoffs`, label: nav.writeoffs, icon: ClipboardList },
    { href: `/${lang}/inventory`, label: nav.inventory, icon: Package },
    { href: `/${lang}/vehicles`, label: nav.vehicles, icon: Truck },
    { href: `/${lang}/movements`, label: nav.movements, icon: ArrowLeftRight },
    { href: `/${lang}/reports`, label: nav.reports, icon: BarChart3 },
  ]
}

function NavContent({ lang, userName, nav, appName, appTagline, onClose, onLogout }: Props & {
  onClose?: () => void
  onLogout: () => void
}) {
  const pathname = usePathname()
  const items = useNavItems(lang, nav)

  return (
    <>
      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <Ambulance className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm">{appName}</div>
            <div className="text-xs text-slate-500">{appTagline}</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 md:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <Link
          href={`/${lang}/calls/new`}
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {nav.newCall}
        </Link>

        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{userName}</div>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-left text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {nav.logout}
        </button>
      </div>
    </>
  )
}

export default function Sidebar({ lang, userName, nav, appName, appTagline }: Props) {
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await logoutAction(lang)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col h-screen fixed left-0 top-0">
        <NavContent lang={lang} userName={userName} nav={nav} appName={appName} appTagline={appTagline} onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 flex items-center justify-between px-4 h-14">
        <button onClick={() => setOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center">
            <Ambulance className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm">{appName}</span>
        </div>
        <Link href={`/${lang}/calls/new`} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
          <Plus className="w-5 h-5" />
        </Link>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-72 bg-white flex flex-col h-full shadow-xl">
            <NavContent
              lang={lang}
              userName={userName}
              nav={nav}
              appName={appName}
              appTagline={appTagline}
              onClose={() => setOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}
    </>
  )
}

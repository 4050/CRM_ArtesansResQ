import Link from 'next/link'
import { AlertTriangle, Phone, Package, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, isLowStock, startOfDayIso } from '@/lib/utils'
import { unitLabel } from '@/lib/consumable-labels'
import { getCallsCountSince, getRecentCalls } from '@/lib/data/calls'
import { getStockLevels } from '@/lib/data/consumables'
import { getTeamStock } from '@/lib/data/team-stock'
import { getWriteoffsSince } from '@/lib/data/writeoffs'
import { getProfile } from '@/lib/data/users'
import { isAdminRole } from '@/lib/roles'
import { getDictionary, hasLocale } from '../../dictionaries'
import { notFound } from 'next/navigation'

export default async function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub

  // No per-org timezone setting exists yet - every organization using this
  // app today is Ukraine-based, so the "today" boundary for the stat cards
  // below is computed in that zone rather than the server's (which
  // defaults to UTC on most hosts, putting midnight hours off from where
  // the team actually is).
  const todayIso = startOfDayIso('Europe/Kyiv')

  const [callsToday, recentCalls, teamStock, writeoffsToday, profile] = await Promise.all([
    getCallsCountSince(todayIso),
    getRecentCalls(5),
    getTeamStock(),
    getWriteoffsSince(todayIso),
    getProfile(userId!),
  ])

  const isAdmin = isAdminRole(profile?.role)
  const mainStockLevels = isAdmin ? await getStockLevels() : []

  const totalWrittenOff = writeoffsToday.reduce((s, w) => s + w.quantity, 0)
  const lowStockItems = teamStock.filter(item => isLowStock(item.qty_in_stock, item.consumable?.qty_minimum ?? 0))
  const mainLowStockCount = mainStockLevels.filter(c => isLowStock(c.qty_in_stock, c.qty_minimum)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{dict.dashboard.title}</h1>
        <Link
          href={`/${lang}/calls/new`}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {dict.nav.newCall}
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-5">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            </div>
            <span className="text-xs md:text-sm text-slate-500">{dict.dashboard.callsToday}</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-900">{callsToday ?? 0}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-5">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            </div>
            <span className="text-xs md:text-sm text-slate-500">{dict.dashboard.writtenOffToday}</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-900">{totalWrittenOff} <span className="text-sm md:text-base font-normal text-slate-400">{dict.dashboard.units}</span></div>
        </div>

        <div className={`rounded-xl border p-3 md:p-5 ${lowStockItems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
            <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center ${lowStockItems.length > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
              <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 ${lowStockItems.length > 0 ? 'text-red-600' : 'text-slate-400'}`} />
            </div>
            <span className="text-xs md:text-sm text-slate-500">{dict.dashboard.runningLow}</span>
          </div>
          <div className={`text-2xl md:text-3xl font-bold ${lowStockItems.length > 0 ? 'text-red-700' : 'text-slate-900'}`}>
            {lowStockItems.length} <span className="text-sm md:text-base font-normal text-slate-400">{dict.dashboard.items}</span>
          </div>
        </div>
      </div>

      {/* Main warehouse low-stock banner — admin only, procurement concern, separate from team stock's operational one */}
      {isAdmin && mainLowStockCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {dict.dashboard.mainLowStockBanner.replace('{count}', String(mainLowStockCount))}
          </div>
          <Link href={`/${lang}/inventory`} className="text-sm text-amber-800 hover:text-amber-900 font-medium whitespace-nowrap">
            {dict.dashboard.goToInventory}
          </Link>
        </div>
      )}

      {/* Low stock alert (team stock — this is what actually blocks a call) */}
      {lowStockItems.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">{dict.dashboard.runningLowOnStock}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {lowStockItems.map(item => (
              <div key={item.id} className="px-5 py-3 flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
                <span className="text-sm text-slate-800 truncate">{item.consumable?.name}</span>
                <div className="flex items-center gap-4 text-sm shrink-0">
                  <span className="text-red-600 font-medium whitespace-nowrap">{dict.dashboard.inStockShort}: {item.qty_in_stock} {item.consumable ? unitLabel(dict, item.consumable.unit) : ''}</span>
                  <span className="text-slate-400 whitespace-nowrap">{dict.dashboard.minShort}: {item.consumable?.qty_minimum ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-slate-100">
            <Link href={`/${lang}/team-stock`} className="text-sm text-red-600 hover:text-red-700 font-medium">
              {dict.dashboard.goToTeamStock}
            </Link>
          </div>
        </div>
      )}

      {/* Recent calls */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{dict.dashboard.recentCalls}</h2>
          <Link href={`/${lang}/calls`} className="text-sm text-slate-500 hover:text-slate-700">
            {dict.dashboard.allCalls}
          </Link>
        </div>
        {recentCalls && recentCalls.length > 0 ? (<>
          {/* Desktop table */}
          <table className="hidden md:table w-full">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="text-left px-5 py-3">{dict.dashboard.dateTime}</th>
                <th className="text-left px-5 py-3">{dict.dashboard.vehicle}</th>
                <th className="text-left px-5 py-3">{dict.dashboard.bag}</th>
                <th className="text-left px-5 py-3">{dict.dashboard.employee}</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentCalls.map((call) => (
                <tr key={call.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-slate-600">{formatDateTime(call.date, lang)}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      {call.vehicle?.number ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                      {call.bag?.number ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">{call.user?.name ?? '—'}</td>
                  <td className="px-5 py-3">
                    <Link href={`/${lang}/calls/${call.id}`} className="text-xs text-red-600 hover:text-red-700 font-medium">{dict.dashboard.open}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {recentCalls.map((call) => (
              <Link key={call.id} href={`/${lang}/calls/${call.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div>
                  <div className="text-sm font-medium text-slate-800">{formatDateTime(call.date, lang)}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{call.vehicle?.number ?? '—'}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">{call.bag?.number ?? '—'}</span>
                    <span className="text-xs text-slate-400">{call.user?.name}</span>
                  </div>
                </div>
                <span className="text-red-500 text-lg">›</span>
              </Link>
            ))}
          </div>
        </>) : (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">
            {dict.dashboard.noCallsYet}{' '}
            <Link href={`/${lang}/calls/new`} className="text-red-600 hover:text-red-700 font-medium">{dict.dashboard.createFirst}</Link>
          </div>
        )}
      </div>
    </div>
  )
}

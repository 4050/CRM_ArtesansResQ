import Link from 'next/link'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateTime, computeTotalPages } from '@/lib/utils'
import { getCalls } from '@/lib/data/calls'
import { getActiveVehicles } from '@/lib/data/vehicles'
import { getBags } from '@/lib/data/bags'
import { getUserOptions } from '@/lib/data/users'
import { getDictionary, hasLocale } from '../../dictionaries'
import { notFound } from 'next/navigation'

type CallsSearchParams = { vehicle?: string; bag?: string; user?: string; page?: string }

// Preserves every active filter while only changing the page number.
function pageHref(lang: string, sp: CallsSearchParams, page: number) {
  const params = new URLSearchParams()
  if (sp.vehicle) params.set('vehicle', sp.vehicle)
  if (sp.bag) params.set('bag', sp.bag)
  if (sp.user) params.set('user', sp.user)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return `/${lang}/calls${qs ? `?${qs}` : ''}`
}

export default async function CallsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<CallsSearchParams>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)

  const [{ rows: calls, count, pageSize }, vehicles, bags, users] = await Promise.all([
    getCalls({ vehicleId: sp.vehicle, bagId: sp.bag, userId: sp.user, page }),
    getActiveVehicles(),
    getBags(),
    getUserOptions(),
  ])

  const totalPages = computeTotalPages(count, pageSize)
  const rangeFrom = count === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeTo = Math.min(count, page * pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{dict.calls.list.title}</h1>
        <Link
          href={`/${lang}/calls/new`}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {dict.nav.newCall}
        </Link>
      </div>

      {/* Filters */}
      <form className="flex flex-col sm:flex-row gap-3 sm:flex-wrap">
        <select
          name="vehicle"
          defaultValue={sp.vehicle ?? ''}
          className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        >
          <option value="">{dict.calls.list.allVehicles}</option>
          {vehicles?.map(v => <option key={v.id} value={v.id}>{v.number}</option>)}
        </select>

        <select
          name="bag"
          defaultValue={sp.bag ?? ''}
          className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        >
          <option value="">{dict.calls.list.allBags}</option>
          {bags?.map(b => <option key={b.id} value={b.id}>{b.number}</option>)}
        </select>

        <select
          name="user"
          defaultValue={sp.user ?? ''}
          className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        >
          <option value="">{dict.calls.list.allEmployees}</option>
          {users?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            {dict.calls.list.apply}
          </button>

          {(sp.vehicle || sp.bag || sp.user) && (
            <Link
              href={`/${lang}/calls`}
              className="flex-1 sm:flex-none text-center px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {dict.calls.list.reset}
            </Link>
          )}
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {calls && calls.length > 0 ? (<>
          {/* Desktop table */}
          <table className="hidden md:table w-full">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="text-left px-5 py-3">{dict.calls.list.callNumber}</th>
                <th className="text-left px-5 py-3">{dict.calls.list.dateTime}</th>
                <th className="text-left px-5 py-3">{dict.calls.list.vehicle}</th>
                <th className="text-left px-5 py-3">{dict.calls.list.bag}</th>
                <th className="text-left px-5 py-3">{dict.calls.list.employee}</th>
                <th className="text-left px-5 py-3">{dict.calls.list.description}</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">{call.call_number}</td>
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
                  <td className="px-5 py-3 text-sm text-slate-400 max-w-xs truncate">
                    {call.description ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/${lang}/calls/${call.id}`} className="text-xs text-red-600 hover:text-red-700 font-medium whitespace-nowrap">
                      {dict.calls.list.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {calls.map((call) => (
              <Link key={call.id} href={`/${lang}/calls/${call.id}`} className="block px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{call.call_number}</span>
                  <span className="text-xs text-slate-400 shrink-0">{formatDateTime(call.date, lang)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{call.vehicle?.number ?? '—'}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">{call.bag?.number ?? '—'}</span>
                  <span className="text-xs text-slate-400">{call.user?.name ?? '—'}</span>
                </div>
                {call.description && (
                  <div className="text-xs text-slate-400 mt-1 truncate">{call.description}</div>
                )}
              </Link>
            ))}
          </div>
        </>) : (
          <div className="px-5 py-16 text-center text-slate-400 text-sm">
            {dict.calls.list.noneFound}{' '}
            <Link href={`/${lang}/calls/new`} className="text-red-600 hover:text-red-700 font-medium">
              {dict.calls.list.createFirst}
            </Link>
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {dict.calls.list.shownRange
              .replace('{from}', String(rangeFrom))
              .replace('{to}', String(rangeTo))
              .replace('{total}', String(count))}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={pageHref(lang, sp, page - 1)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {dict.calls.list.prevPage}
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {dict.calls.list.prevPage}
                </span>
              )}
              {page < totalPages ? (
                <Link href={pageHref(lang, sp, page + 1)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  {dict.calls.list.nextPage}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300">
                  {dict.calls.list.nextPage}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

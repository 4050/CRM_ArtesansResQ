import Link from 'next/link'
import { Plus } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { unitLabel, categoryLabel } from '@/lib/consumable-labels'
import { getWriteoffs } from '@/lib/data/writeoffs'
import { getConsumableNameOptions } from '@/lib/data/consumables'
import { getUserOptions } from '@/lib/data/users'
import { getDictionary, hasLocale } from '../../dictionaries'
import { notFound } from 'next/navigation'

export default async function WriteoffsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ consumable?: string; user?: string }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const sp = await searchParams

  const [writeoffs, consumables, users] = await Promise.all([
    getWriteoffs({ consumableId: sp.consumable, userId: sp.user }),
    getConsumableNameOptions(),
    getUserOptions(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{dict.writeoffs.title}</h1>
        <Link
          href={`/${lang}/calls/new`}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {dict.nav.newCall}
        </Link>
      </div>

      {/* Filters */}
      <form className="flex gap-3 flex-wrap">
        <select
          name="consumable"
          defaultValue={sp.consumable ?? ''}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        >
          <option value="">{dict.writeoffs.allConsumables}</option>
          {consumables?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          name="user"
          defaultValue={sp.user ?? ''}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        >
          <option value="">{dict.writeoffs.allEmployees}</option>
          {users?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          {dict.writeoffs.apply}
        </button>

        {(sp.consumable || sp.user) && (
          <Link
            href={`/${lang}/writeoffs`}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {dict.writeoffs.reset}
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {writeoffs && writeoffs.length > 0 ? (<>
          {/* Desktop table */}
          <table className="hidden md:table w-full">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="text-left px-5 py-3">{dict.writeoffs.dateTime}</th>
                <th className="text-left px-5 py-3">{dict.writeoffs.consumable}</th>
                <th className="text-left px-5 py-3">{dict.writeoffs.category}</th>
                <th className="text-right px-5 py-3">{dict.writeoffs.quantity}</th>
                <th className="text-left px-5 py-3">{dict.writeoffs.employee}</th>
                <th className="text-left px-5 py-3">{dict.writeoffs.vehicleBag}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {writeoffs.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {formatDateTime(w.created_at, lang)}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">
                    {w.consumable?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                      {w.consumable ? categoryLabel(dict, w.consumable.category) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                    {w.quantity} <span className="font-normal text-slate-400">{w.consumable ? unitLabel(dict, w.consumable.unit) : ''}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {w.user?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    {w.call ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {w.call.vehicle?.number ?? '?'}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          {w.call.bag?.number ?? '?'}
                        </span>
                        {w.call_id && (
                          <Link href={`/${lang}/calls/${w.call_id}`} className="text-xs text-red-600 hover:text-red-700 font-medium ml-1">
                            →
                          </Link>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {writeoffs.map((w) => (
              <div key={w.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{w.consumable?.name ?? '—'}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{formatDateTime(w.created_at, lang)}</div>
                  </div>
                  <div className="text-sm font-bold text-slate-900 shrink-0">
                    {w.quantity} <span className="font-normal text-slate-400">{w.consumable ? unitLabel(dict, w.consumable.unit) : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {w.call?.vehicle?.number && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{w.call.vehicle.number}</span>
                  )}
                  {w.call?.bag?.number && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">{w.call.bag.number}</span>
                  )}
                  {w.user?.name && <span className="text-xs text-slate-400">{w.user.name}</span>}
                  {w.call_id && (
                    <Link href={`/${lang}/calls/${w.call_id}`} className="text-xs text-red-500 ml-auto">{dict.writeoffs.call}</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>) : (
          <div className="px-5 py-16 text-center text-slate-400 text-sm">
            {dict.writeoffs.noneFound}{' '}
            <Link href={`/${lang}/calls/new`} className="text-red-600 hover:text-red-700 font-medium">
              {dict.writeoffs.createCall}
            </Link>
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
          {dict.writeoffs.found}: {writeoffs?.length ?? 0}
        </div>
      </div>
    </div>
  )
}

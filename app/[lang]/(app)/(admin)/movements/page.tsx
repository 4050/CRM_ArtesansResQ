import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, History } from 'lucide-react'
import { formatDateTime, computeTotalPages } from '@/lib/utils'
import { unitLabel, categoryLabel, sourceLabel, CONSUMABLE_SOURCES } from '@/lib/consumable-labels'
import { getStockMovements, type Warehouse } from '@/lib/data/movements'
import { getConsumableNameOptions } from '@/lib/data/consumables'
import { getUserOptions } from '@/lib/data/users'
import { getDictionary, hasLocale } from '../../../dictionaries'
import { notFound } from 'next/navigation'
import type { StockMovementType } from '@/types'

function validDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

type MovementSearchParams = {
  consumable?: string
  user?: string
  type?: StockMovementType
  warehouse?: Warehouse
  source?: string
  from?: string
  to?: string
  page?: string
}

// Preserves every active filter while only changing the page number -
// used by the prev/next links below.
function pageHref(lang: string, sp: MovementSearchParams, page: number) {
  const params = new URLSearchParams()
  if (sp.consumable) params.set('consumable', sp.consumable)
  if (sp.user) params.set('user', sp.user)
  if (sp.type) params.set('type', sp.type)
  if (sp.warehouse) params.set('warehouse', sp.warehouse)
  if (sp.source) params.set('source', sp.source)
  if (sp.from) params.set('from', sp.from)
  if (sp.to) params.set('to', sp.to)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return `/${lang}/movements${qs ? `?${qs}` : ''}`
}

export default async function MovementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<MovementSearchParams>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const movementLabels: Record<StockMovementType, string> = {
    opening_balance: dict.movements.typeOpeningBalance,
    increase: dict.movements.typeIncrease,
    decrease: dict.movements.typeDecrease,
  }
  const warehouseLabels: Record<Warehouse, string> = {
    main: dict.movements.warehouseMain,
    team: dict.movements.warehouseTeam,
  }

  const sp = await searchParams
  const from = validDate(sp.from)
  const to = validDate(sp.to)
  const page = Math.max(1, Number(sp.page) || 1)

  const [{ rows: movements, count, pageSize }, consumables, users] = await Promise.all([
    getStockMovements({
      consumableId: sp.consumable,
      userId: sp.user,
      type: sp.type && sp.type in movementLabels ? sp.type : undefined,
      warehouse: sp.warehouse === 'main' || sp.warehouse === 'team' ? sp.warehouse : undefined,
      source: sp.source && (CONSUMABLE_SOURCES as string[]).includes(sp.source) ? sp.source : undefined,
      fromIso: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      toIso: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      page,
    }),
    getConsumableNameOptions(),
    getUserOptions(),
  ])

  const totalPages = computeTotalPages(count, pageSize)
  const rangeFrom = count === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeTo = Math.min(count, page * pageSize)

  const totalIncrease = movements.reduce((sum, item) => sum + Math.max(0, item.quantity_delta), 0)
  const totalDecrease = movements.reduce((sum, item) => sum + Math.abs(Math.min(0, item.quantity_delta)), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.movements.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.movements.subtitle}</p>
      </div>

      <form className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <label className="text-sm text-slate-600">
          <span className="block mb-1.5 font-medium">{dict.movements.item}</span>
          <select name="consumable" defaultValue={sp.consumable ?? ''} className="px-3 py-2 border border-slate-300 rounded-lg bg-white max-w-56">
            <option value="">{dict.movements.allItems}</option>
            {consumables?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="block mb-1.5 font-medium">{dict.movements.operation}</span>
          <select name="type" defaultValue={sp.type ?? ''} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
            <option value="">{dict.movements.allOperations}</option>
            {Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="block mb-1.5 font-medium">{dict.movements.warehouse}</span>
          <select name="warehouse" defaultValue={sp.warehouse ?? ''} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
            <option value="">{dict.movements.allWarehouses}</option>
            {Object.entries(warehouseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="block mb-1.5 font-medium">{dict.movements.source}</span>
          <select name="source" defaultValue={sp.source ?? ''} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
            <option value="">{dict.movements.allSources}</option>
            {CONSUMABLE_SOURCES.map(src => <option key={src} value={src}>{sourceLabel(dict, src)}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="block mb-1.5 font-medium">{dict.movements.employee}</span>
          <select name="user" defaultValue={sp.user ?? ''} className="px-3 py-2 border border-slate-300 rounded-lg bg-white max-w-48">
            <option value="">{dict.movements.allEmployees}</option>
            {users?.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="block mb-1.5 font-medium">{dict.movements.fromDate}</span>
          <input name="from" type="date" defaultValue={from} className="px-3 py-2 border border-slate-300 rounded-lg" />
        </label>
        <label className="text-sm text-slate-600">
          <span className="block mb-1.5 font-medium">{dict.movements.toDate}</span>
          <input name="to" type="date" defaultValue={to} className="px-3 py-2 border border-slate-300 rounded-lg" />
        </label>
        <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg">{dict.movements.apply}</button>
        {(sp.consumable || sp.user || sp.type || sp.warehouse || sp.source || from || to) && (
          <a href={`/${lang}/movements`} className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm rounded-lg">{dict.movements.reset}</a>
        )}
      </form>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center"><ArrowUp className="w-5 h-5 text-green-600" /></div>
          <div><div className="text-2xl font-bold text-green-700">+{totalIncrease}</div><div className="text-xs text-green-700/70">{dict.movements.increaseInSelection}</div></div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center"><ArrowDown className="w-5 h-5 text-red-600" /></div>
          <div><div className="text-2xl font-bold text-red-700">−{totalDecrease}</div><div className="text-xs text-red-700/70">{dict.movements.decreaseInSelection}</div></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {movements.length === 0 ? (
          <div className="py-14 text-center text-slate-400">
            <History className="w-8 h-8 mx-auto mb-2" />
            <div className="text-sm">{dict.movements.noneFound}</div>
          </div>
        ) : (
          <>
            <table className="hidden md:table w-full">
              <thead><tr className="text-xs text-slate-400 uppercase border-b border-slate-100">
                <th className="text-left px-5 py-3">{dict.movements.date}</th><th className="text-left px-5 py-3">{dict.movements.item}</th>
                <th className="text-left px-5 py-3">{dict.movements.warehouse}</th>
                <th className="text-left px-5 py-3">{dict.movements.operation}</th><th className="text-right px-5 py-3">{dict.movements.change}</th>
                <th className="text-right px-5 py-3">{dict.movements.stock}</th><th className="text-left px-5 py-3">{dict.movements.employee}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{movements.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDateTime(item.created_at, lang)}</td>
                  <td className="px-5 py-3"><div className="text-sm font-medium text-slate-900">{item.consumable?.name ?? '—'}</div><div className="text-xs text-slate-400">{item.consumable ? `${categoryLabel(dict, item.consumable.category)} · ${sourceLabel(dict, item.consumable.source)}` : ''}</div></td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.warehouse === 'team' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {warehouseLabels[item.warehouse]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">{movementLabels[item.movement_type]}</td>
                  <td className={`px-5 py-3 text-right text-sm font-bold ${item.quantity_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta} {item.consumable ? unitLabel(dict, item.consumable.unit) : ''}</td>
                  <td className="px-5 py-3 text-right text-sm text-slate-600">{item.quantity_before} → <span className="font-semibold text-slate-900">{item.quantity_after}</span></td>
                  <td className="px-5 py-3 text-sm text-slate-500">{item.user?.name ?? dict.movements.system}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="md:hidden divide-y divide-slate-100">{movements.map(item => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900">{item.consumable?.name ?? '—'}</div>
                  <div className={`text-sm font-bold ${item.quantity_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta} {item.consumable ? unitLabel(dict, item.consumable.unit) : ''}</div>
                </div>
                <div className="flex justify-between gap-3 mt-1 text-xs text-slate-400">
                  <span>{warehouseLabels[item.warehouse]} · {movementLabels[item.movement_type]} · {item.user?.name ?? dict.movements.system}</span>
                  <span>{item.quantity_before} → {item.quantity_after}</span>
                </div>
                {item.consumable && (
                  <div className="text-xs text-slate-400 mt-0.5">{categoryLabel(dict, item.consumable.category)} · {sourceLabel(dict, item.consumable.source)}</div>
                )}
                <div className="text-xs text-slate-400 mt-1">{formatDateTime(item.created_at, lang)}</div>
              </div>
            ))}</div>
          </>
        )}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {dict.movements.shownRange
              .replace('{from}', String(rangeFrom))
              .replace('{to}', String(rangeTo))
              .replace('{total}', String(count))}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <a href={pageHref(lang, sp, page - 1)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {dict.movements.prevPage}
                </a>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {dict.movements.prevPage}
                </span>
              )}
              {page < totalPages ? (
                <a href={pageHref(lang, sp, page + 1)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  {dict.movements.nextPage}
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300">
                  {dict.movements.nextPage}
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

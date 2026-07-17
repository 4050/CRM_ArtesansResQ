import { ArrowDown, ArrowUp, History } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { unitLabel, categoryLabel } from '@/lib/consumable-labels'
import { getStockMovements } from '@/lib/data/movements'
import { getConsumableNameOptions } from '@/lib/data/consumables'
import { getUserOptions } from '@/lib/data/users'
import { getDictionary, hasLocale } from '../../dictionaries'
import { notFound } from 'next/navigation'
import type { StockMovementType } from '@/types'

function validDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

export default async function MovementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{
    consumable?: string
    user?: string
    type?: StockMovementType
    from?: string
    to?: string
  }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const movementLabels: Record<StockMovementType, string> = {
    opening_balance: dict.movements.typeOpeningBalance,
    increase: dict.movements.typeIncrease,
    decrease: dict.movements.typeDecrease,
  }

  const sp = await searchParams
  const from = validDate(sp.from)
  const to = validDate(sp.to)

  const [movements, consumables, users] = await Promise.all([
    getStockMovements({
      consumableId: sp.consumable,
      userId: sp.user,
      type: sp.type && sp.type in movementLabels ? sp.type : undefined,
      fromIso: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      toIso: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    }),
    getConsumableNameOptions(),
    getUserOptions(),
  ])

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
        {(sp.consumable || sp.user || sp.type || from || to) && (
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
                <th className="text-left px-5 py-3">{dict.movements.operation}</th><th className="text-right px-5 py-3">{dict.movements.change}</th>
                <th className="text-right px-5 py-3">{dict.movements.stock}</th><th className="text-left px-5 py-3">{dict.movements.employee}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{movements.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDateTime(item.created_at, lang)}</td>
                  <td className="px-5 py-3"><div className="text-sm font-medium text-slate-900">{item.consumable?.name ?? '—'}</div><div className="text-xs text-slate-400">{item.consumable ? categoryLabel(dict, item.consumable.category) : ''}</div></td>
                  <td className="px-5 py-3 text-sm text-slate-600">{movementLabels[item.movement_type]}</td>
                  <td className={`px-5 py-3 text-right text-sm font-bold ${item.quantity_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta} {item.consumable ? unitLabel(dict, item.consumable.unit) : ''}</td>
                  <td className="px-5 py-3 text-right text-sm text-slate-600">{item.quantity_before} → <span className="font-semibold text-slate-900">{item.quantity_after}</span></td>
                  <td className="px-5 py-3 text-sm text-slate-500">{item.user?.name ?? dict.movements.system}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="md:hidden divide-y divide-slate-100">{movements.map(item => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex justify-between gap-3"><div className="text-sm font-medium text-slate-900">{item.consumable?.name ?? '—'}</div><div className={`text-sm font-bold ${item.quantity_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta} {item.consumable ? unitLabel(dict, item.consumable.unit) : ''}</div></div>
                <div className="flex justify-between gap-3 mt-1 text-xs text-slate-400"><span>{movementLabels[item.movement_type]} · {item.user?.name ?? dict.movements.system}</span><span>{item.quantity_before} → {item.quantity_after}</span></div>
                <div className="text-xs text-slate-400 mt-1">{formatDateTime(item.created_at, lang)}</div>
              </div>
            ))}</div>
          </>
        )}
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">{dict.movements.shownPrefix} {movements.length} {dict.movements.shownSuffix}</div>
      </div>
    </div>
  )
}

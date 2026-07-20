'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Search } from 'lucide-react'
import type { Dictionary } from '@/app/[lang]/dictionaries'
import { unitLabel, categoryLabel, CONSUMABLE_CATEGORIES } from '@/lib/consumable-labels'
import { cn, isLowStock } from '@/lib/utils'

const ALL_CATEGORIES = 'all'

export interface StockItem {
  id: string
  code: string | null
  name: string
  category: string
  unit: string
  qty_in_stock: number
  qty_minimum: number
  // Omit entirely for item kinds with no concept of archiving (e.g. team
  // stock) — rows only dim when the field is explicitly present and false.
  is_active?: boolean
}

export interface StockTableLabels {
  searchPlaceholder: string
  allCategories: string
  code: string
  name: string
  category: string
  unit: string
  stock: string
  minimum: string
  noneFound: string
  // Template with {shown}/{total} tokens. Omit to hide the footer count
  // (team stock has no need for it, inventory does).
  shownOf?: string
}

interface Props<T extends StockItem> {
  dict: Dictionary
  items: T[]
  labels: StockTableLabels
  // Pass undefined (e.g. non-admin viewer) to drop the actions column
  // entirely rather than render it empty.
  renderRowActions?: (item: T) => ReactNode
  renderCardActions?: (item: T) => ReactNode
}

export default function StockTable<T extends StockItem>({
  dict,
  items,
  labels,
  renderRowActions,
  renderCardActions,
}: Props<T>) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORIES)

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === ALL_CATEGORIES || item.category === category
    return matchSearch && matchCat
  })

  const columnCount = 6 + (renderRowActions ? 1 : 0)

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        >
          <option value={ALL_CATEGORIES}>{labels.allCategories}</option>
          {CONSUMABLE_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(dict, c)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Desktop table */}
        <table className="hidden md:table w-full">
          <thead>
            <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
              <th className="text-left px-5 py-3">{labels.code}</th>
              <th className="text-left px-5 py-3">{labels.name}</th>
              <th className="text-left px-5 py-3">{labels.category}</th>
              <th className="text-left px-5 py-3">{labels.unit}</th>
              <th className="text-right px-5 py-3">{labels.stock}</th>
              <th className="text-right px-5 py-3">{labels.minimum}</th>
              {renderRowActions && <th className="px-5 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-5 py-10 text-center text-slate-400 text-sm">{labels.noneFound}</td>
              </tr>
            ) : filtered.map(item => {
              const low = isLowStock(item.qty_in_stock, item.qty_minimum)
              return (
                <tr key={item.id} className={cn('hover:bg-slate-50 transition-colors', low && 'bg-red-50/50', item.is_active === false && 'opacity-50')}>
                  <td className="px-5 py-3">
                    {item.code
                      ? <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{item.code}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{item.name}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">{categoryLabel(dict, item.category)}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{unitLabel(dict, item.unit)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={cn('text-sm font-semibold', low ? 'text-red-600' : 'text-slate-900')}>{item.qty_in_stock}</span>
                    {low && <AlertTriangle className="inline-block w-3.5 h-3.5 text-red-500 ml-1" />}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-slate-400">{item.qty_minimum}</td>
                  {renderRowActions && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">{renderRowActions(item)}</div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">{labels.noneFound}</div>
          ) : filtered.map(item => {
            const low = isLowStock(item.qty_in_stock, item.qty_minimum)
            return (
              <div key={item.id} className={cn('flex items-center gap-3 px-4 py-3', low && 'bg-red-50/50', item.is_active === false && 'opacity-50')}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{item.name}</span>
                    {item.code && (
                      <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">{item.code}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{categoryLabel(dict, item.category)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-sm font-bold', low ? 'text-red-600' : 'text-slate-900')}>
                    {item.qty_in_stock} {unitLabel(dict, item.unit)}
                    {low && <AlertTriangle className="inline-block w-3 h-3 text-red-500 ml-1" />}
                  </div>
                  <div className="text-xs text-slate-400">{dict.dashboard.minShort}: {item.qty_minimum}</div>
                </div>
                {renderCardActions && <div className="flex flex-col gap-1 shrink-0">{renderCardActions(item)}</div>}
              </div>
            )
          })}
        </div>

        {labels.shownOf && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            {labels.shownOf.replace('{shown}', String(filtered.length)).replace('{total}', String(items.length))}
          </div>
        )}
      </div>
    </div>
  )
}

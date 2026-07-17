'use client'

import { useState } from 'react'
import { AlertTriangle, Search } from 'lucide-react'
import type { Dictionary } from '@/app/[lang]/dictionaries'
import type { TeamStockRow } from '@/lib/data/team-stock'
import { unitLabel, categoryLabel, CONSUMABLE_CATEGORIES } from '@/lib/consumable-labels'
import { cn, isLowStock } from '@/lib/utils'

const ALL_CATEGORIES = 'all'

interface Props {
  dict: Dictionary
  items: TeamStockRow[]
}

export default function TeamStockClient({ dict, items }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORIES)

  const filtered = items.filter(item => {
    const matchSearch = (item.consumable?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = category === ALL_CATEGORIES || item.consumable?.category === category
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.teamStock.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.teamStock.subtitle}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={dict.teamStock.searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        >
          <option value={ALL_CATEGORIES}>{dict.teamStock.allCategories}</option>
          {CONSUMABLE_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(dict, c)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Desktop table */}
        <table className="hidden md:table w-full">
          <thead>
            <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
              <th className="text-left px-5 py-3">{dict.teamStock.code}</th>
              <th className="text-left px-5 py-3">{dict.teamStock.name}</th>
              <th className="text-left px-5 py-3">{dict.teamStock.category}</th>
              <th className="text-left px-5 py-3">{dict.teamStock.unit}</th>
              <th className="text-right px-5 py-3">{dict.teamStock.stock}</th>
              <th className="text-right px-5 py-3">{dict.teamStock.minimum}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">{dict.teamStock.noneFound}</td>
              </tr>
            ) : filtered.map(item => {
              const low = isLowStock(item.qty_in_stock, item.consumable?.qty_minimum ?? 0)
              return (
                <tr key={item.id} className={cn('hover:bg-slate-50 transition-colors', low && 'bg-red-50/50')}>
                  <td className="px-5 py-3">
                    {item.consumable?.code
                      ? <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{item.consumable.code}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{item.consumable?.name}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                      {item.consumable ? categoryLabel(dict, item.consumable.category) : ''}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{item.consumable ? unitLabel(dict, item.consumable.unit) : ''}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={cn('text-sm font-semibold', low ? 'text-red-600' : 'text-slate-900')}>{item.qty_in_stock}</span>
                    {low && <AlertTriangle className="inline-block w-3.5 h-3.5 text-red-500 ml-1" />}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-slate-400">{item.consumable?.qty_minimum ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">{dict.teamStock.noneFound}</div>
          ) : filtered.map(item => {
            const low = isLowStock(item.qty_in_stock, item.consumable?.qty_minimum ?? 0)
            return (
              <div key={item.id} className={cn('flex items-center gap-3 px-4 py-3', low && 'bg-red-50/50')}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{item.consumable?.name}</span>
                    {item.consumable?.code && (
                      <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">{item.consumable.code}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{item.consumable ? categoryLabel(dict, item.consumable.category) : ''}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-sm font-bold', low ? 'text-red-600' : 'text-slate-900')}>
                    {item.qty_in_stock} {item.consumable ? unitLabel(dict, item.consumable.unit) : ''}
                    {low && <AlertTriangle className="inline-block w-3 h-3 text-red-500 ml-1" />}
                  </div>
                  <div className="text-xs text-slate-400">{dict.dashboard.minShort}: {item.consumable?.qty_minimum ?? 0}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

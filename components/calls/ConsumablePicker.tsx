'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, AlertTriangle } from 'lucide-react'
import type { Dictionary } from '@/app/[lang]/dictionaries'
import type { ConsumableOption } from '@/lib/data/consumables'
import { unitLabel, categoryLabel } from '@/lib/consumable-labels'
import { cn, clampQuantityInput } from '@/lib/utils'

function groupByCategory(items: ConsumableOption[]) {
  return items.reduce<Record<string, ConsumableOption[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})
}

interface Props {
  dict: Dictionary
  consumables: ConsumableOption[]
  usedIds: string[]
  onAdd: (consumable_id: string, quantity: number) => void
  onClose: () => void
}

export default function ConsumablePicker({ dict, consumables, usedIds, onAdd, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ConsumableOption | null>(null)
  const [quantity, setQuantity] = useState(1)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  const filtered = consumables.filter(c => {
    const q = search.toLowerCase()
    return (
      c.is_active &&
      !usedIds.includes(c.id) &&
      (c.name.toLowerCase().includes(q) ||
        categoryLabel(dict, c.category).toLowerCase().includes(q) ||
        (c.code ?? '').toLowerCase().includes(q))
    )
  })

  const grouped = groupByCategory(filtered)

  function handleSelect(c: ConsumableOption) {
    setSelected(c)
    setQuantity(1)
  }

  function handleConfirm() {
    if (!selected) return
    onAdd(selected.id, quantity)
  }

  const overStock = selected && quantity > selected.qty_in_stock

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{dict.calls.form.pickerTitle}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null) }}
              placeholder={dict.calls.form.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {Object.keys(grouped).length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">{dict.calls.form.noneFoundPicker}</div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 py-2">
                  {categoryLabel(dict, category)}
                </div>
                <div className="space-y-1">
                  {items.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors',
                        selected?.id === c.id
                          ? 'bg-red-50 border border-red-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {c.code && (
                          <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">{c.code}</span>
                        )}
                        <span className="text-sm font-medium text-slate-800 truncate">{c.name}</span>
                      </div>
                      <span className={cn(
                        'text-xs ml-3 shrink-0',
                        c.qty_in_stock === 0 ? 'text-red-500' : 'text-slate-400'
                      )}>
                        {c.qty_in_stock === 0 ? dict.calls.form.outOfStock : `${dict.calls.form.inStockPrefix} ${c.qty_in_stock} ${unitLabel(dict, c.unit)}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quantity + confirm */}
        {selected && (
          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 rounded-b-2xl">
            <div className="text-sm font-medium text-slate-700 mb-3 truncate">{selected.name}</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg font-medium"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(clampQuantityInput(e.target.value))}
                  className={cn(
                    'w-16 text-center text-sm font-semibold border rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500',
                    overStock ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300 bg-white'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg font-medium"
                >
                  +
                </button>
                <span className="text-sm text-slate-400">{unitLabel(dict, selected.unit)}</span>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!!overStock}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {dict.calls.form.add}
              </button>
            </div>
            {overStock && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                {dict.calls.form.onlyInStock.replace('{qty}', String(selected.qty_in_stock)).replace('{unit}', unitLabel(dict, selected.unit))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useRef, useEffect, useId } from 'react'
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

// Same selector/pattern as components/ui/Modal.tsx - this picker is a
// separate custom dialog (its search+list+quantity-footer layout doesn't
// map onto Modal's title/children/footer slots), so it needs its own copy
// of the same keyboard/focus treatment rather than reusing that component.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function ConsumablePicker({ dict, consumables, usedIds, onAdd, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ConsumableOption | null>(null)
  const [quantity, setQuantity] = useState(1)
  const searchRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => { searchRef.current?.focus() }, [])

  // onClose read through a ref (updated in its own effect, not directly
  // during render - see Modal.tsx for why) so the keydown effect below can
  // run once per mount/unmount instead of re-running, and stealing focus
  // away from the search input, on every keystroke typed into it.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Escape closes, Tab can't leave the dialog, and focus returns to
  // whatever opened this on close - same reasoning as Modal.tsx.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialog) return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

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
    // Bottom sheet below `sm` (same reasoning as components/ui/Modal.tsx -
    // this is the busiest dialog in the app, opened every time a medic adds
    // a consumable to a call), centered dialog at `sm` and up.
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg flex flex-col max-h-[92vh] sm:max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 id={titleId} className="font-semibold text-slate-900">{dict.calls.form.pickerTitle}</h3>
          <button onClick={onClose} className="p-2.5 -m-1.5 text-slate-400 hover:text-slate-600">
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
          <div className="border-t border-slate-100 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 bg-slate-50 sm:rounded-b-2xl shrink-0">
            <div className="text-sm font-medium text-slate-700 mb-3 truncate">{selected.name}</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg font-medium"
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
                  className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg font-medium"
                >
                  +
                </button>
                <span className="text-sm text-slate-400">{unitLabel(dict, selected.unit)}</span>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!!overStock}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
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

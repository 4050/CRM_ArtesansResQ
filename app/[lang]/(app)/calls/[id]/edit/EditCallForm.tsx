'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, AlertTriangle, Search, X, ArrowLeft } from 'lucide-react'
import { updateCallAction } from '../../actions'
import type { Vehicle, Bag, WriteoffInput } from '@/types'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import { unitLabel, categoryLabel } from '@/lib/consumable-labels'
import { cn } from '@/lib/utils'

type ConsumableOption = {
  id: string
  code: string | null
  name: string
  unit: string
  qty_in_stock: number
  category: string
  is_active: boolean
}

type ExistingWriteoff = {
  id: string
  quantity: number
  consumable_id: string
  consumable: ConsumableOption | null
}

interface Props {
  lang: Locale
  dict: Dictionary
  call: {
    id: string
    date: string
    description: string | null
    vehicle_id: string
    bag_id: string
    writeoffs: ExistingWriteoff[]
  }
  vehicles: Vehicle[]
  bags: Bag[]
  consumables: ConsumableOption[]
}

function groupByCategory(items: ConsumableOption[]) {
  return items.reduce<Record<string, ConsumableOption[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})
}

function ConsumablePicker({
  dict,
  consumables,
  usedIds,
  onAdd,
  onClose,
}: {
  dict: Dictionary
  consumables: ConsumableOption[]
  usedIds: string[]
  onAdd: (id: string, qty: number) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ConsumableOption | null>(null)
  const [quantity, setQuantity] = useState(1)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  const filtered = consumables.filter(c =>
    c.is_active &&
    !usedIds.includes(c.id) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) ||
      categoryLabel(dict, c.category).toLowerCase().includes(search.toLowerCase()) ||
      (c.code ?? '').toLowerCase().includes(search.toLowerCase()))
  )
  const grouped = groupByCategory(filtered)
  const overStock = selected && quantity > selected.qty_in_stock

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{dict.calls.form.pickerTitle}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
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
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {Object.keys(grouped).length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">{dict.calls.form.noneFoundPicker}</div>
          ) : Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="mb-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 py-2">{categoryLabel(dict, cat)}</div>
              <div className="space-y-1">
                {items.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelected(c); setQuantity(1) }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left border transition-colors',
                      selected?.id === c.id ? 'bg-red-50 border-red-200' : 'hover:bg-slate-50 border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {c.code && (
                        <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">{c.code}</span>
                      )}
                      <span className="text-sm font-medium text-slate-800 truncate">{c.name}</span>
                    </div>
                    <span className={cn('text-xs ml-3 shrink-0', c.qty_in_stock === 0 ? 'text-red-500' : 'text-slate-400')}>
                      {c.qty_in_stock === 0 ? dict.calls.form.outOfStock : `${dict.calls.form.inStockPrefix} ${c.qty_in_stock} ${unitLabel(dict, c.unit)}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {selected && (
          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 rounded-b-2xl">
            <div className="text-sm font-medium text-slate-700 mb-3 truncate">{selected.name}</div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg">−</button>
              <input type="number" min="1" value={quantity}
                onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                className={cn('w-16 text-center text-sm font-semibold border rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500',
                  overStock ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300 bg-white')} />
              <button type="button" onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-lg">+</button>
              <span className="text-sm text-slate-400">{unitLabel(dict, selected.unit)}</span>
              <button type="button" onClick={() => onAdd(selected.id, quantity)} disabled={!!overStock}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors">
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

export default function EditCallForm({ lang, dict, call, vehicles, bags, consumables }: Props) {
  const router = useRouter()

  const existingDate = new Date(call.date)
  const [date, setDate] = useState(existingDate.toISOString().split('T')[0])
  const [time, setTime] = useState(existingDate.toTimeString().slice(0, 5))
  const [description, setDescription] = useState(call.description ?? '')
  const [vehicleId, setVehicleId] = useState(call.vehicle_id)
  const [bagId, setBagId] = useState(call.bag_id)
  const [writeoffs, setWriteoffs] = useState<WriteoffInput[]>(
    call.writeoffs.map(w => ({ consumable_id: w.consumable_id, quantity: w.quantity }))
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredBags = vehicleId ? bags.filter(b => b.vehicle_id === vehicleId) : bags
  const usedIds = writeoffs.map(w => w.consumable_id)

  function getConsumable(id: string) {
    // Stock available = current stock + what was originally written off for this consumable
    const original = call.writeoffs.find(w => w.consumable_id === id)
    const base = consumables.find(c => c.id === id)
    if (!base) return null
    return { ...base, qty_in_stock: base.qty_in_stock + (original?.quantity ?? 0) }
  }

  function updateQuantity(idx: number, quantity: number) {
    setWriteoffs(prev => prev.map((w, i) => i === idx ? { ...w, quantity } : w))
  }

  function removeWriteoff(idx: number) {
    setWriteoffs(prev => prev.filter((_, i) => i !== idx))
  }

  function handlePickerAdd(consumable_id: string, quantity: number) {
    setWriteoffs(prev => [...prev, { consumable_id, quantity }])
    setPickerOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!vehicleId) { setError(dict.calls.form.selectVehicleError); return }
    if (!bagId) { setError(dict.calls.form.selectBagError); return }

    const parsed = new Date(`${date}T${time}`)
    if (isNaN(parsed.getTime())) { setError(dict.calls.form.invalidDateTime); return }

    setSaving(true)

    try {
      const validWriteoffs = writeoffs.filter(w => w.consumable_id && w.quantity > 0)
      const result = await updateCallAction(lang, call.id, {
        date: parsed.toISOString(),
        description,
        vehicleId,
        bagId,
        writeoffs: validWriteoffs,
      })

      if (result?.error) {
        setError(result.error)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{dict.calls.form.editCallTitle}</h1>
        </div>

        {/* Call info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">{dict.calls.form.callInfo}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.calls.form.date}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.calls.form.time}</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.calls.form.vehicle} <span className="text-red-500">*</span></label>
              <select value={vehicleId} onChange={e => { setVehicleId(e.target.value); setBagId('') }}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                <option value="">{dict.calls.form.selectVehicle}</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.number}{v.name ? ` — ${v.name}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.calls.form.bag} <span className="text-red-500">*</span></label>
              <select value={bagId} onChange={e => setBagId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                <option value="">{dict.calls.form.selectBag}</option>
                {filteredBags.map(b => <option key={b.id} value={b.id}>{b.number}{b.description ? ` — ${b.description}` : ''}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.calls.form.callDescription}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder={dict.calls.form.descriptionPlaceholder}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </div>
        </div>

        {/* Writeoffs */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">
              {dict.calls.form.consumablesSection}
              {writeoffs.length > 0 && <span className="ml-2 text-xs font-normal text-slate-400">{writeoffs.length} {dict.calls.form.items}</span>}
            </h2>
            <button type="button" onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium">
              <Plus className="w-4 h-4" />{dict.calls.form.add}
            </button>
          </div>

          {writeoffs.length === 0 ? (
            <button type="button" onClick={() => setPickerOpen(true)}
              className="w-full py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg hover:border-red-300 hover:text-red-400 transition-colors">
              {dict.calls.form.clickToAdd}
            </button>
          ) : (
            <div className="space-y-2">
              {writeoffs.map((w, idx) => {
                const c = getConsumable(w.consumable_id)
                const overStock = c && w.quantity > c.qty_in_stock
                return (
                  <div key={idx} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg border',
                    overStock ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50')}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{c?.name ?? '—'}</div>
                      <div className="text-xs text-slate-400">{c ? categoryLabel(dict, c.category) : ''}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => updateQuantity(idx, Math.max(1, w.quantity - 1))}
                        className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-base">−</button>
                      <input type="number" min="1" value={w.quantity}
                        onChange={e => updateQuantity(idx, Math.max(1, Number(e.target.value)))}
                        className={cn('w-14 text-center text-sm font-semibold border rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-red-500',
                          overStock ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300 bg-white')} />
                      <button type="button" onClick={() => updateQuantity(idx, w.quantity + 1)}
                        className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-base">+</button>
                      <span className="text-xs text-slate-400 w-6">{c ? unitLabel(dict, c.unit) : ''}</span>
                    </div>
                    {overStock && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                    <button type="button" onClick={() => removeWriteoff(idx)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
              <button type="button" onClick={() => setPickerOpen(true)}
                className="w-full py-2.5 text-sm text-slate-400 hover:text-red-500 border border-dashed border-slate-200 hover:border-red-300 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />{dict.calls.form.addMore}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            {dict.calls.form.cancel}
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {dict.calls.form.saveChanges}
          </button>
        </div>
      </form>

      {pickerOpen && (
        <ConsumablePicker
          dict={dict}
          consumables={consumables}
          usedIds={usedIds}
          onAdd={handlePickerAdd}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  )
}

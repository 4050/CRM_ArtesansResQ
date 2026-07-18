'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { createCallAction } from '../actions'
import type { Vehicle, Bag, WriteoffInput } from '@/types'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import type { ConsumableOption } from '@/lib/data/consumables'
import { unitLabel, categoryLabel } from '@/lib/consumable-labels'
import { cn } from '@/lib/utils'
import ConsumablePicker from '@/components/calls/ConsumablePicker'

interface Props {
  lang: Locale
  dict: Dictionary
  vehicles: Vehicle[]
  bags: (Bag & { vehicle?: { number: string } })[]
  consumables: ConsumableOption[]
  currentUserName: string
}

export default function NewCallForm({ lang, dict, vehicles, bags, consumables, currentUserName }: Props) {
  const router = useRouter()

  const now = new Date()
  const todayDate = now.toISOString().split('T')[0]
  const nowTime = now.toTimeString().slice(0, 5)

  const [date, setDate] = useState(todayDate)
  const [time, setTime] = useState(nowTime)
  const [description, setDescription] = useState('')
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '')
  const [bagId, setBagId] = useState('')
  const [writeoffs, setWriteoffs] = useState<WriteoffInput[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredBags = vehicleId ? bags.filter(b => b.vehicle_id === vehicleId) : bags

  function getConsumable(id: string) {
    return consumables.find(c => c.id === id)
  }

  const usedIds = writeoffs.map(w => w.consumable_id)

  function handlePickerAdd(consumable_id: string, quantity: number) {
    setWriteoffs(prev => [...prev, { consumable_id, quantity }])
    setPickerOpen(false)
  }

  function updateQuantity(idx: number, quantity: number) {
    setWriteoffs(prev => prev.map((w, i) => i === idx ? { ...w, quantity } : w))
  }

  function removeWriteoff(idx: number) {
    setWriteoffs(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!vehicleId) { setError(dict.calls.form.selectVehicleError); return }
    if (!bagId) { setError(dict.calls.form.selectBagError); return }

    const validWriteoffs = writeoffs.filter(w => w.consumable_id && w.quantity > 0)

    const parsed = new Date(`${date}T${time}`)
    if (isNaN(parsed.getTime())) {
      setError(dict.calls.form.invalidDateTime)
      return
    }

    setSaving(true)

    try {
      const result = await createCallAction(lang, {
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
        <h1 className="text-2xl font-bold text-slate-900">{dict.calls.form.newCallTitle}</h1>

        {/* Call info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">{dict.calls.form.callInfo}</h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.calls.form.whoWritesOff}</label>
            <input
              value={currentUserName}
              disabled
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.calls.form.date}</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.calls.form.time}</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {dict.calls.form.vehicle} <span className="text-red-500">*</span>
              </label>
              <select
                value={vehicleId}
                onChange={e => { setVehicleId(e.target.value); setBagId('') }}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              >
                <option value="">{dict.calls.form.selectVehicle}</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.number}{v.name ? ` — ${v.name}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {dict.calls.form.bag} <span className="text-red-500">*</span>
              </label>
              <select
                value={bagId}
                onChange={e => setBagId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              >
                <option value="">{dict.calls.form.selectBag}</option>
                {filteredBags.map(b => (
                  <option key={b.id} value={b.id}>{b.number}{b.description ? ` — ${b.description}` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.calls.form.callDescription}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder={dict.calls.form.descriptionPlaceholder}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
        </div>

        {/* Writeoffs */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">
              {dict.calls.form.consumablesSection}
              {writeoffs.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400">{writeoffs.length} {dict.calls.form.items}</span>
              )}
            </h2>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              {dict.calls.form.add}
            </button>
          </div>

          {writeoffs.length === 0 ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg hover:border-red-300 hover:text-red-400 transition-colors"
            >
              {dict.calls.form.clickToAdd}
            </button>
          ) : (
            <div className="space-y-2">
              {writeoffs.map((w, idx) => {
                const c = getConsumable(w.consumable_id)
                const overStock = c && w.quantity > c.qty_in_stock
                return (
                  <div key={idx} className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg border',
                    overStock ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{c?.name}</div>
                      <div className="text-xs text-slate-400">{c ? categoryLabel(dict, c.category) : ''}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, Math.max(1, w.quantity - 1))}
                        className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-base"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={w.quantity}
                        onChange={e => updateQuantity(idx, Math.max(1, Number(e.target.value)))}
                        className={cn(
                          'w-14 text-center text-sm font-semibold border rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-red-500',
                          overStock ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300 bg-white'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, w.quantity + 1)}
                        className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-base"
                      >
                        +
                      </button>
                      <span className="text-xs text-slate-400 w-6">{c ? unitLabel(dict, c.unit) : ''}</span>
                    </div>
                    {overStock && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                    <button
                      type="button"
                      onClick={() => removeWriteoff(idx)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full py-2.5 text-sm text-slate-400 hover:text-red-500 border border-dashed border-slate-200 hover:border-red-300 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {dict.calls.form.addMore}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            {dict.calls.form.cancel}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {dict.calls.form.saveCall}
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

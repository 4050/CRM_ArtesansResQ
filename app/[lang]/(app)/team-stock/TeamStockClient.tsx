'use client'

import { useState } from 'react'
import { Undo2, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import type { TeamStockRow } from '@/lib/data/team-stock'
import { unitLabel } from '@/lib/consumable-labels'
import StockTable, { type StockItem } from '@/components/stock/StockTable'
import Modal from '@/components/ui/Modal'
import { returnFromTeamStockAction, discardFromTeamStockAction } from './actions'

interface Props {
  lang: Locale
  dict: Dictionary
  items: TeamStockRow[]
  isAdmin: boolean
}

type TeamStockItem = StockItem & { consumableId: string }
type ActionMode = 'return' | 'discard' | null

function toStockItem(row: TeamStockRow): TeamStockItem {
  return {
    id: row.id,
    consumableId: row.consumable_id,
    code: row.consumable?.code ?? null,
    name: row.consumable?.name ?? '',
    category: row.consumable?.category ?? 'other',
    unit: row.consumable?.unit ?? 'pcs',
    qty_in_stock: row.qty_in_stock,
    qty_minimum: row.consumable?.qty_minimum ?? 0,
    is_active: row.consumable?.is_active,
  }
}

export default function TeamStockClient({ lang, dict, items: initial, isAdmin }: Props) {
  const [items, setItems] = useState(initial)
  const [target, setTarget] = useState<TeamStockItem | null>(null)
  const [mode, setMode] = useState<ActionMode>(null)
  const [qty, setQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const visibleItems = items.filter(row => row.consumable?.is_active !== false || showInactive)

  function openReturn(item: TeamStockItem) {
    setTarget(item)
    setMode('return')
    setQty(1)
    setSaveError('')
  }

  function openDiscard(item: TeamStockItem) {
    setTarget(item)
    setMode('discard')
    setQty(1)
    setSaveError('')
  }

  function closeModal() {
    setTarget(null)
    setMode(null)
    setSaveError('')
  }

  async function handleConfirm() {
    if (!target || qty <= 0) return
    setSaving(true)
    setSaveError('')

    const { error } = mode === 'discard'
      ? await discardFromTeamStockAction(lang, target.consumableId, qty)
      : await returnFromTeamStockAction(lang, target.consumableId, qty)

    if (error) {
      setSaveError(error)
      setSaving(false)
      return
    }

    setItems(prev => prev.map(row => row.id === target.id ? { ...row, qty_in_stock: row.qty_in_stock - qty } : row))
    setSaving(false)
    closeModal()
  }

  function renderRowActions(item: TeamStockItem) {
    return (
      <>
        <button
          onClick={() => openReturn(item)}
          title={dict.teamStock.returnToMain}
          disabled={item.qty_in_stock <= 0}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => openDiscard(item)}
          title={dict.teamStock.discardToWaste}
          disabled={item.qty_in_stock <= 0}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </>
    )
  }

  function renderCardActions(item: TeamStockItem) {
    return (
      <>
        <button onClick={() => openReturn(item)} disabled={item.qty_in_stock <= 0} className="p-1.5 text-blue-600 bg-blue-50 rounded-lg disabled:opacity-30">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={() => openDiscard(item)} disabled={item.qty_in_stock <= 0} className="p-1.5 text-red-600 bg-red-50 rounded-lg disabled:opacity-30">
          <Trash2 className="w-4 h-4" />
        </button>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.teamStock.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{dict.teamStock.subtitle}</p>
        </div>
        {isAdmin && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-slate-300"
            />
            {dict.teamStock.showInactive}
          </label>
        )}
      </div>

      <StockTable
        dict={dict}
        items={visibleItems.map(toStockItem)}
        labels={{
          searchPlaceholder: dict.teamStock.searchPlaceholder,
          allCategories: dict.teamStock.allCategories,
          code: dict.teamStock.code,
          name: dict.teamStock.name,
          category: dict.teamStock.category,
          unit: dict.teamStock.unit,
          stock: dict.teamStock.stock,
          minimum: dict.teamStock.minimum,
          noneFound: dict.teamStock.noneFound,
        }}
        renderRowActions={isAdmin ? renderRowActions : undefined}
        renderCardActions={isAdmin ? renderCardActions : undefined}
      />

      {/* Return to main warehouse / discard modal */}
      {target && mode && (
        <Modal
          title={mode === 'discard' ? dict.teamStock.discardTitle : dict.teamStock.returnTitle}
          onClose={closeModal}
          closeDisabled={saving}
          footer={<>
            <button
              onClick={closeModal}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              {dict.teamStock.cancel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || qty <= 0 || qty > target.qty_in_stock}
              className={
                mode === 'discard'
                  ? 'flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2'
                  : 'flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2'
              }
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'discard' ? dict.teamStock.discard : dict.teamStock.return}
            </button>
          </>}
        >
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <div className="text-sm font-medium text-slate-800">{target.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {dict.teamStock.currentTeamStock}: <span className="font-semibold text-slate-700">{target.qty_in_stock} {unitLabel(dict, target.unit)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {(mode === 'discard' ? dict.teamStock.howMuchToDiscard : dict.teamStock.howMuchToReturn).replace('{unit}', unitLabel(dict, target.unit))}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xl font-medium"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max={target.qty_in_stock}
                value={qty}
                onChange={e => setQty(Math.max(1, Math.min(target.qty_in_stock, Number(e.target.value))))}
                className="flex-1 text-center text-lg font-bold border border-slate-300 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setQty(q => Math.min(target.qty_in_stock, q + 1))}
                className="w-10 h-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xl font-medium"
              >
                +
              </button>
            </div>
          </div>

          {mode === 'discard' ? (
            <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{dict.teamStock.discardWarning}</span>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              {dict.teamStock.teamWillBecome}: <span className="font-bold">{target.qty_in_stock - qty} {unitLabel(dict, target.unit)}</span>
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {dict.teamStock.error}: {saveError}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

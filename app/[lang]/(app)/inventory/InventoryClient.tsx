'use client'

import { useState } from 'react'
import { AlertTriangle, Edit2, Plus, PackagePlus, Send, Search, X, Loader2, Trash2 } from 'lucide-react'
import {
  createConsumableAction,
  updateConsumableAction,
  restockConsumableAction,
  archiveConsumableAction,
  transferToTeamStockAction,
} from './actions'
import type { Consumable, ConsumableUnit } from '@/types'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import { unitLabel, categoryLabel, CONSUMABLE_UNITS, CONSUMABLE_CATEGORIES } from '@/lib/consumable-labels'
import { cn, isLowStock } from '@/lib/utils'

const ALL_CATEGORIES = 'all'

interface Props {
  lang: Locale
  dict: Dictionary
  consumables: Consumable[]
  isAdmin: boolean
}

const emptyForm = {
  code: '',
  name: '',
  category: 'other' as string,
  unit: 'pcs' as ConsumableUnit,
  qty_in_stock: 0,
  qty_minimum: 0,
  description: '',
}

type ModalMode = 'edit' | 'add' | 'restock' | 'delete' | 'issue' | null

export default function InventoryClient({ lang, dict, consumables: initial, isAdmin }: Props) {
  const [consumables, setConsumables] = useState(initial)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [modal, setModal] = useState<ModalMode>(null)
  const [target, setTarget] = useState<Consumable | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [restockQty, setRestockQty] = useState(1)
  const [issueQty, setIssueQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const filtered = consumables.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === ALL_CATEGORIES || c.category === category
    return matchSearch && matchCat
  })

  function openEdit(c: Consumable) {
    setTarget(c)
    setForm({
      code: c.code ?? '',
      name: c.name,
      category: c.category,
      unit: c.unit,
      qty_in_stock: c.qty_in_stock,
      qty_minimum: c.qty_minimum,
      description: c.description ?? '',
    })
    setModal('edit')
  }

  function openRestock(c: Consumable) {
    setTarget(c)
    setRestockQty(1)
    setModal('restock')
  }

  function openIssue(c: Consumable) {
    setTarget(c)
    setIssueQty(1)
    setModal('issue')
  }

  function openAdd() {
    setTarget(null)
    setForm(emptyForm)
    setModal('add')
  }

  function openDelete(c: Consumable) {
    setTarget(c)
    setModal('delete')
  }

  function closeModal() {
    setModal(null)
    setTarget(null)
    setSaveError('')
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    const payload = { ...form, code: form.code.trim() || null }

    if (modal === 'edit' && target) {
      const { data, error } = await updateConsumableAction(lang, target.id, {
        code: payload.code,
        name: payload.name,
        category: payload.category,
        unit: payload.unit,
        qty_minimum: payload.qty_minimum,
        description: payload.description,
      })

      if (error) { setSaveError(error); setSaving(false); return }
      if (data) setConsumables(prev => prev.map(c => c.id === data.id ? data : c))
    } else if (modal === 'add') {
      const { data, error } = await createConsumableAction(lang, payload)

      if (error) { setSaveError(error); setSaving(false); return }
      if (data) setConsumables(prev => [...prev, data])
    }
    setSaving(false)
    closeModal()
  }

  async function handleRestock() {
    if (!target || restockQty <= 0) return
    setSaving(true)
    setSaveError('')
    const { data, error } = await restockConsumableAction(lang, target.id, restockQty)

    if (error) { setSaveError(error); setSaving(false); return }
    if (data) setConsumables(prev => prev.map(c => c.id === data.id ? data : c))
    setSaving(false)
    closeModal()
  }

  async function handleIssue() {
    if (!target || issueQty <= 0) return
    setSaving(true)
    setSaveError('')
    const { error } = await transferToTeamStockAction(lang, target.id, issueQty)

    if (error) { setSaveError(error); setSaving(false); return }
    setConsumables(prev => prev.map(c => c.id === target.id ? { ...c, qty_in_stock: c.qty_in_stock - issueQty } : c))
    setSaving(false)
    closeModal()
  }

  async function handleDelete() {
    if (!target) return
    setSaving(true)
    setSaveError('')

    const { error } = await archiveConsumableAction(lang, target.id)

    if (error) {
      setSaveError(error)
      setSaving(false)
      return
    }

    setConsumables(prev => prev.filter(item => item.id !== target.id))
    setSaving(false)
    closeModal()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{dict.inventory.title}</h1>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {dict.inventory.newItem}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={dict.inventory.searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        >
          <option value={ALL_CATEGORIES}>{dict.inventory.allCategories}</option>
          {CONSUMABLE_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(dict, c)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Desktop table */}
        <table className="hidden md:table w-full">
          <thead>
            <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
              <th className="text-left px-5 py-3">{dict.inventory.code}</th>
              <th className="text-left px-5 py-3">{dict.inventory.name}</th>
              <th className="text-left px-5 py-3">{dict.inventory.category}</th>
              <th className="text-left px-5 py-3">{dict.inventory.unit}</th>
              <th className="text-right px-5 py-3">{dict.inventory.stock}</th>
              <th className="text-right px-5 py-3">{dict.inventory.minimum}</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">{dict.inventory.noneFound}</td>
              </tr>
            ) : filtered.map(item => {
              const low = isLowStock(item.qty_in_stock, item.qty_minimum)
              return (
                <tr key={item.id} className={cn('hover:bg-slate-50 transition-colors', low && 'bg-red-50/50')}>
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
                  <td className="px-5 py-3">
                    {isAdmin && <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openRestock(item)} title={dict.inventory.restock} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <PackagePlus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openIssue(item)} title={dict.inventory.issueToTeam} disabled={item.qty_in_stock <= 0} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(item)} title={dict.inventory.edit} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openDelete(item)} title={dict.inventory.delete} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">{dict.inventory.noneFound}</div>
          ) : filtered.map(item => {
            const low = isLowStock(item.qty_in_stock, item.qty_minimum)
            return (
              <div key={item.id} className={cn('flex items-center gap-3 px-4 py-3', low && 'bg-red-50/50')}>
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
                {isAdmin && <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openRestock(item)} className="p-1.5 text-green-600 bg-green-50 rounded-lg">
                    <PackagePlus className="w-4 h-4" />
                  </button>
                  <button onClick={() => openIssue(item)} disabled={item.qty_in_stock <= 0} className="p-1.5 text-blue-600 bg-blue-50 rounded-lg disabled:opacity-30">
                    <Send className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(item)} className="p-1.5 text-slate-500 bg-slate-100 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => openDelete(item)} className="p-1.5 text-red-600 bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>}
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
          {dict.inventory.shownOf.replace('{shown}', String(filtered.length)).replace('{total}', String(consumables.length))}
        </div>
      </div>

      {/* Delete confirmation */}
      {modal === 'delete' && target && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{dict.inventory.deleteTitle}</h2>
              <button onClick={closeModal} disabled={saving} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <div className="text-sm font-medium text-slate-900">{target.name}</div>
                <div className="text-xs text-slate-500 mt-1">{dict.inventory.inStockShort}: {target.qty_in_stock} {unitLabel(dict, target.unit)}</div>
              </div>
              <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{dict.inventory.deleteWarning}</span>
              </div>
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {dict.inventory.error}: {saveError}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
              >
                {dict.inventory.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {dict.inventory.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock modal */}
      {modal === 'restock' && target && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{dict.inventory.restockTitle}</h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <div className="text-sm font-medium text-slate-800">{target.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {dict.inventory.currentStock}: <span className="font-semibold text-slate-700">{target.qty_in_stock} {unitLabel(dict, target.unit)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {dict.inventory.howMuchToAdd.replace('{unit}', unitLabel(dict, target.unit))}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRestockQty(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xl font-medium"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={restockQty}
                    onChange={e => setRestockQty(Math.max(1, Number(e.target.value)))}
                    className="flex-1 text-center text-lg font-bold border border-slate-300 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => setRestockQty(q => q + 1)}
                    className="w-10 h-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xl font-medium"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                {dict.inventory.willBecome}: <span className="font-bold">{target.qty_in_stock + restockQty} {unitLabel(dict, target.unit)}</span>
              </div>
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {dict.inventory.error}: {saveError}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {dict.inventory.cancel}
              </button>
              <button
                onClick={handleRestock}
                disabled={saving || restockQty <= 0}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {dict.inventory.addToStock}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue to team modal */}
      {modal === 'issue' && target && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{dict.inventory.issueTitle}</h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <div className="text-sm font-medium text-slate-800">{target.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {dict.inventory.currentMainStock}: <span className="font-semibold text-slate-700">{target.qty_in_stock} {unitLabel(dict, target.unit)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {dict.inventory.howMuchToIssue.replace('{unit}', unitLabel(dict, target.unit))}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIssueQty(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xl font-medium"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={target.qty_in_stock}
                    value={issueQty}
                    onChange={e => setIssueQty(Math.max(1, Math.min(target.qty_in_stock, Number(e.target.value))))}
                    className="flex-1 text-center text-lg font-bold border border-slate-300 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIssueQty(q => Math.min(target.qty_in_stock, q + 1))}
                    className="w-10 h-10 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xl font-medium"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                {dict.inventory.mainWillBecome}: <span className="font-bold">{target.qty_in_stock - issueQty} {unitLabel(dict, target.unit)}</span>
              </div>
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {dict.inventory.error}: {saveError}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {dict.inventory.cancel}
              </button>
              <button
                onClick={handleIssue}
                disabled={saving || issueQty <= 0 || issueQty > target.qty_in_stock}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {dict.inventory.issue}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Add modal */}
      {(modal === 'edit' || modal === 'add') && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">
                {modal === 'edit' ? dict.inventory.editTitle : dict.inventory.addTitle}
              </h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.inventory.codeOptional}</label>
                  <input
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder={dict.inventory.codePlaceholder}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.inventory.name}</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.inventory.category}</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                  >
                    {CONSUMABLE_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(dict, c)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.inventory.unit}</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value as ConsumableUnit }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                  >
                    {CONSUMABLE_UNITS.map(u => <option key={u} value={u}>{unitLabel(dict, u)}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {modal === 'add' ? dict.inventory.openingStock : dict.inventory.currentStockLabel}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.qty_in_stock}
                    onChange={e => setForm(f => ({ ...f, qty_in_stock: Number(e.target.value) }))}
                    disabled={modal === 'edit'}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.inventory.minimumStock}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.qty_minimum}
                    onChange={e => setForm(f => ({ ...f, qty_minimum: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.inventory.descriptionOptional}</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder={dict.inventory.descriptionPlaceholder}
                />
              </div>
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {dict.inventory.error}: {saveError}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {dict.inventory.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {dict.inventory.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

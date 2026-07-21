'use client'

import { useState } from 'react'
import { AlertTriangle, Edit2, Plus, PackagePlus, Send, Loader2, Trash2, Ban, FileSpreadsheet } from 'lucide-react'
import {
  createConsumableAction,
  updateConsumableAction,
  restockConsumableAction,
  archiveConsumableAction,
  deleteConsumableAction,
  transferToTeamStockAction,
} from './actions'
import type { Consumable, ConsumableUnit } from '@/types'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import { unitLabel, categoryLabel, CONSUMABLE_UNITS, CONSUMABLE_CATEGORIES } from '@/lib/consumable-labels'
import StockTable from '@/components/stock/StockTable'
import Modal from '@/components/ui/Modal'
import ImportExcelModal from './ImportExcelModal'

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
  is_active: true,
}

type ModalMode = 'edit' | 'add' | 'restock' | 'deactivate' | 'delete' | 'issue' | null

export default function InventoryClient({ lang, dict, consumables: initial, isAdmin }: Props) {
  const [consumables, setConsumables] = useState(initial)
  const [modal, setModal] = useState<ModalMode>(null)
  const [target, setTarget] = useState<Consumable | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [restockQty, setRestockQty] = useState(1)
  const [issueQty, setIssueQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const visibleConsumables = consumables.filter(c => c.is_active || showInactive)

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
      is_active: c.is_active,
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

  function openDeactivate(c: Consumable) {
    setTarget(c)
    setModal('deactivate')
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
        is_active: payload.is_active,
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

  async function handleDeactivate() {
    if (!target) return
    setSaving(true)
    setSaveError('')

    const { error } = await archiveConsumableAction(lang, target.id)

    if (error) {
      setSaveError(error)
      setSaving(false)
      return
    }

    setConsumables(prev => prev.map(c => c.id === target.id ? { ...c, is_active: false } : c))
    setSaving(false)
    closeModal()
  }

  async function handleDelete() {
    if (!target) return
    setSaving(true)
    setSaveError('')

    const { error } = await deleteConsumableAction(lang, target.id)

    if (error) {
      setSaveError(error)
      setSaving(false)
      return
    }

    setConsumables(prev => prev.filter(item => item.id !== target.id))
    setSaving(false)
    closeModal()
  }

  function renderRowActions(item: Consumable) {
    return (
      <>
        <button onClick={() => openRestock(item)} title={dict.inventory.restock} disabled={!item.is_active} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors">
          <PackagePlus className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => openIssue(item)} title={dict.inventory.issueToTeam} disabled={!item.is_active || item.qty_in_stock <= 0} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors">
          <Send className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => openEdit(item)} title={dict.inventory.edit} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        {item.is_active && (
          <button onClick={() => openDeactivate(item)} title={dict.inventory.deactivate} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
            <Ban className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => openDelete(item)} title={dict.inventory.deleteForever} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </>
    )
  }

  function renderCardActions(item: Consumable) {
    return (
      <>
        <button onClick={() => openRestock(item)} disabled={!item.is_active} className="p-1.5 text-green-600 bg-green-50 rounded-lg disabled:opacity-30">
          <PackagePlus className="w-4 h-4" />
        </button>
        <button onClick={() => openIssue(item)} disabled={!item.is_active || item.qty_in_stock <= 0} className="p-1.5 text-blue-600 bg-blue-50 rounded-lg disabled:opacity-30">
          <Send className="w-4 h-4" />
        </button>
        <button onClick={() => openEdit(item)} className="p-1.5 text-slate-500 bg-slate-100 rounded-lg">
          <Edit2 className="w-4 h-4" />
        </button>
        {item.is_active && (
          <button onClick={() => openDeactivate(item)} className="p-1.5 text-amber-600 bg-amber-50 rounded-lg">
            <Ban className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => openDelete(item)} className="p-1.5 text-red-600 bg-red-50 rounded-lg">
          <Trash2 className="w-4 h-4" />
        </button>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{dict.inventory.title}</h1>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                className="rounded border-slate-300"
              />
              {dict.inventory.showInactive}
            </label>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {dict.inventory.import}
            </button>
          )}
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
      </div>

      <StockTable
        dict={dict}
        items={visibleConsumables}
        labels={{
          searchPlaceholder: dict.inventory.searchPlaceholder,
          allCategories: dict.inventory.allCategories,
          code: dict.inventory.code,
          name: dict.inventory.name,
          category: dict.inventory.category,
          unit: dict.inventory.unit,
          stock: dict.inventory.stock,
          minimum: dict.inventory.minimum,
          noneFound: dict.inventory.noneFound,
          shownOf: dict.inventory.shownOf,
        }}
        renderRowActions={isAdmin ? renderRowActions : undefined}
        renderCardActions={isAdmin ? renderCardActions : undefined}
      />

      {/* Deactivate confirmation */}
      {modal === 'deactivate' && target && (
        <Modal
          title={dict.inventory.deactivateTitle}
          onClose={closeModal}
          closeDisabled={saving}
          footer={<>
            <button
              onClick={closeModal}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              {dict.inventory.cancel}
            </button>
            <button
              onClick={handleDeactivate}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              {dict.inventory.makeInactive}
            </button>
          </>}
        >
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <div className="text-sm font-medium text-slate-900">{target.name}</div>
            <div className="text-xs text-slate-500 mt-1">{dict.inventory.inStockShort}: {target.qty_in_stock} {unitLabel(dict, target.unit)}</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{dict.inventory.deactivateWarning}</span>
          </div>
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {dict.inventory.error}: {saveError}
            </div>
          )}
        </Modal>
      )}

      {/* Hard delete confirmation */}
      {modal === 'delete' && target && (
        <Modal
          title={dict.inventory.deleteTitle}
          onClose={closeModal}
          closeDisabled={saving}
          footer={<>
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
          </>}
        >
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <div className="text-sm font-medium text-slate-900">{target.name}</div>
            <div className="text-xs text-slate-500 mt-1">{dict.inventory.inStockShort}: {target.qty_in_stock} {unitLabel(dict, target.unit)}</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{dict.inventory.deleteWarning}</span>
          </div>
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {dict.inventory.error}: {saveError}
            </div>
          )}
        </Modal>
      )}

      {/* Restock modal */}
      {modal === 'restock' && target && (
        <Modal
          title={dict.inventory.restockTitle}
          onClose={closeModal}
          footer={<>
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
          </>}
        >
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
        </Modal>
      )}

      {/* Issue to team modal */}
      {modal === 'issue' && target && (
        <Modal
          title={dict.inventory.issueTitle}
          onClose={closeModal}
          footer={<>
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
          </>}
        >
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
        </Modal>
      )}

      {/* Edit / Add modal */}
      {(modal === 'edit' || modal === 'add') && (
        <Modal
          title={modal === 'edit' ? dict.inventory.editTitle : dict.inventory.addTitle}
          onClose={closeModal}
          maxWidth="max-w-md"
          footer={<>
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
          </>}
        >
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
              {modal === 'edit' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.inventory.status}</label>
                  <select
                    value={form.is_active ? 'active' : 'inactive'}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                  >
                    <option value="active">{dict.inventory.statusActive}</option>
                    <option value="inactive">{dict.inventory.statusInactive}</option>
                  </select>
                </div>
              )}
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {dict.inventory.error}: {saveError}
                </div>
              )}
        </Modal>
      )}

      {showImport && (
        <ImportExcelModal
          lang={lang}
          dict={dict}
          onClose={() => setShowImport(false)}
          onImported={(created, restocked) => {
            setConsumables(prev => {
              const restockedIds = new Set(restocked.map(c => c.id))
              const merged = prev.map(c => restockedIds.has(c.id) ? restocked.find(r => r.id === c.id)! : c)
              return [...merged, ...created]
            })
          }}
        />
      )}
    </div>
  )
}

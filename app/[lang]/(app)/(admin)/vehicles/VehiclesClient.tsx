'use client'

import { useState } from 'react'
import { Plus, Truck, ShoppingBag, Loader2, Edit2, Trash2, Ban, AlertTriangle } from 'lucide-react'
import {
  createVehicleAction,
  updateVehicleAction,
  archiveVehicleAction,
  deleteVehicleAction,
  createBagAction,
  updateBagAction,
  archiveBagAction,
  deleteBagAction,
} from './actions'
import type { Vehicle, Bag } from '@/types'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'

type BagRow = Bag & { vehicle?: { number: string } }

interface Props {
  lang: Locale
  dict: Dictionary
  vehicles: Vehicle[]
  bags: BagRow[]
  isAdmin: boolean
}

type ModalMode =
  | 'add-vehicle' | 'edit-vehicle' | 'deactivate-vehicle' | 'delete-vehicle'
  | 'add-bag' | 'edit-bag' | 'deactivate-bag' | 'delete-bag'
  | null

const emptyVehicleForm = { number: '', name: '', is_active: true }
const emptyBagForm = { number: '', vehicle_id: '', description: '', is_active: true }

export default function VehiclesClient({ lang, dict, vehicles: initialVehicles, bags: initialBags, isAdmin }: Props) {
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [bags, setBags] = useState(initialBags)
  const [modal, setModal] = useState<ModalMode>(null)
  const [vehicleTarget, setVehicleTarget] = useState<Vehicle | null>(null)
  const [bagTarget, setBagTarget] = useState<BagRow | null>(null)
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm)
  const [bagForm, setBagForm] = useState(emptyBagForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showInactiveVehicles, setShowInactiveVehicles] = useState(false)
  const [showInactiveBags, setShowInactiveBags] = useState(false)

  const visibleVehicles = vehicles.filter(v => v.is_active || showInactiveVehicles)
  const visibleBags = bags.filter(b => b.is_active || showInactiveBags)

  function closeModal() {
    setModal(null)
    setVehicleTarget(null)
    setBagTarget(null)
    setSaveError('')
  }

  function openAddVehicle() {
    setVehicleForm(emptyVehicleForm)
    setModal('add-vehicle')
  }

  function openEditVehicle(v: Vehicle) {
    setVehicleTarget(v)
    setVehicleForm({ number: v.number, name: v.name ?? '', is_active: v.is_active })
    setModal('edit-vehicle')
  }

  function openDeactivateVehicle(v: Vehicle) {
    setVehicleTarget(v)
    setModal('deactivate-vehicle')
  }

  function openDeleteVehicle(v: Vehicle) {
    setVehicleTarget(v)
    setModal('delete-vehicle')
  }

  function openAddBag() {
    setBagForm({ ...emptyBagForm, vehicle_id: vehicles[0]?.id ?? '' })
    setModal('add-bag')
  }

  function openEditBag(b: BagRow) {
    setBagTarget(b)
    setBagForm({ number: b.number, vehicle_id: b.vehicle_id, description: b.description ?? '', is_active: b.is_active })
    setModal('edit-bag')
  }

  function openDeactivateBag(b: BagRow) {
    setBagTarget(b)
    setModal('deactivate-bag')
  }

  function openDeleteBag(b: BagRow) {
    setBagTarget(b)
    setModal('delete-bag')
  }

  async function handleSaveVehicle() {
    setSaving(true)
    setSaveError('')

    const number = vehicleForm.number.trim()
    const name = vehicleForm.name.trim() || null

    if (modal === 'edit-vehicle' && vehicleTarget) {
      const { data, error } = await updateVehicleAction(lang, vehicleTarget.id, { number, name, is_active: vehicleForm.is_active })
      if (error) { setSaveError(error); setSaving(false); return }
      if (data) setVehicles(prev => prev.map(v => v.id === data.id ? data : v))
    } else {
      const { data, error } = await createVehicleAction(lang, { number, name })
      if (error) { setSaveError(error); setSaving(false); return }
      if (data) setVehicles(prev => [...prev, data].sort((a, b) => a.number.localeCompare(b.number)))
    }

    setSaving(false)
    closeModal()
  }

  async function handleDeactivateVehicle() {
    if (!vehicleTarget) return
    setSaving(true)
    setSaveError('')

    const { error } = await archiveVehicleAction(lang, vehicleTarget.id)
    if (error) { setSaveError(error); setSaving(false); return }

    setVehicles(prev => prev.map(v => v.id === vehicleTarget.id ? { ...v, is_active: false } : v))
    setSaving(false)
    closeModal()
  }

  async function handleDeleteVehicle() {
    if (!vehicleTarget) return
    setSaving(true)
    setSaveError('')

    const { error } = await deleteVehicleAction(lang, vehicleTarget.id)
    if (error) { setSaveError(error); setSaving(false); return }

    setVehicles(prev => prev.filter(v => v.id !== vehicleTarget.id))
    setSaving(false)
    closeModal()
  }

  async function handleSaveBag() {
    setSaving(true)
    setSaveError('')

    const number = bagForm.number.trim()
    const vehicle_id = bagForm.vehicle_id
    const description = bagForm.description.trim() || null
    const vehicle = vehicles.find(v => v.id === vehicle_id)

    if (modal === 'edit-bag' && bagTarget) {
      const { data, error } = await updateBagAction(lang, bagTarget.id, { number, vehicle_id, description, is_active: bagForm.is_active })
      if (error) { setSaveError(error); setSaving(false); return }
      if (data) setBags(prev => prev.map(b => b.id === data.id ? { ...data, vehicle } : b))
    } else {
      const { data, error } = await createBagAction(lang, { number, vehicle_id, description })
      if (error) { setSaveError(error); setSaving(false); return }
      if (data) setBags(prev => [...prev, { ...data, vehicle }].sort((a, b) => a.number.localeCompare(b.number)))
    }

    setSaving(false)
    closeModal()
  }

  async function handleDeactivateBag() {
    if (!bagTarget) return
    setSaving(true)
    setSaveError('')

    const { error } = await archiveBagAction(lang, bagTarget.id)
    if (error) { setSaveError(error); setSaving(false); return }

    setBags(prev => prev.map(b => b.id === bagTarget.id ? { ...b, is_active: false } : b))
    setSaving(false)
    closeModal()
  }

  async function handleDeleteBag() {
    if (!bagTarget) return
    setSaving(true)
    setSaveError('')

    const { error } = await deleteBagAction(lang, bagTarget.id)
    if (error) { setSaveError(error); setSaving(false); return }

    setBags(prev => prev.filter(b => b.id !== bagTarget.id))
    setSaving(false)
    closeModal()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{dict.vehicles.title}</h1>

      {/* Vehicles */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">{dict.vehicles.vehiclesSection}</h2>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactiveVehicles}
                  onChange={e => setShowInactiveVehicles(e.target.checked)}
                  className="rounded border-slate-300"
                />
                {dict.vehicles.showInactive}
              </label>
            )}
            {isAdmin && (
              <button
                onClick={openAddVehicle}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {dict.vehicles.addVehicle}
              </button>
            )}
          </div>
        </div>
        {visibleVehicles.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">{dict.vehicles.noVehiclesYet}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleVehicles.map(v => (
              <div key={v.id} className={cn('px-5 py-3 flex items-center justify-between', !v.is_active && 'opacity-50')}>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    {v.number}
                  </span>
                  {v.name && <span className="text-sm text-slate-600">{v.name}</span>}
                  <span className={cn('text-xs', v.is_active ? 'text-green-600' : 'text-slate-400')}>
                    {v.is_active ? dict.vehicles.active : dict.vehicles.inactive}
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditVehicle(v)} title={dict.vehicles.edit} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {v.is_active && (
                      <button onClick={() => openDeactivateVehicle(v)} title={dict.vehicles.deactivate} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => openDeleteVehicle(v)} title={dict.vehicles.deleteForever} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bags */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">{dict.vehicles.bagsSection}</h2>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactiveBags}
                  onChange={e => setShowInactiveBags(e.target.checked)}
                  className="rounded border-slate-300"
                />
                {dict.vehicles.showInactive}
              </label>
            )}
            {isAdmin && (
              <button
                onClick={openAddBag}
                disabled={vehicles.filter(v => v.is_active).length === 0}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {dict.vehicles.addBag}
              </button>
            )}
          </div>
        </div>
        {visibleBags.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">{dict.vehicles.noBagsYet}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleBags.map(b => (
              <div key={b.id} className={cn('px-5 py-3 flex items-center justify-between', !b.is_active && 'opacity-50')}>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                    {b.number}
                  </span>
                  {b.description && <span className="text-sm text-slate-600">{b.description}</span>}
                  <span className={cn('text-xs', b.is_active ? 'text-green-600' : 'text-slate-400')}>
                    {b.is_active ? dict.vehicles.active : dict.vehicles.inactive}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    {b.vehicle?.number ?? '—'}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditBag(b)} title={dict.vehicles.edit} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {b.is_active && (
                        <button onClick={() => openDeactivateBag(b)} title={dict.vehicles.deactivate} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => openDeleteBag(b)} title={dict.vehicles.deleteForever} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / edit vehicle modal */}
      {(modal === 'add-vehicle' || modal === 'edit-vehicle') && (
        <Modal
          title={modal === 'edit-vehicle' ? dict.vehicles.editVehicle : dict.vehicles.newVehicle}
          onClose={closeModal}
          closeDisabled={saving}
          footer={<>
            <button
              onClick={closeModal}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              {dict.vehicles.cancel}
            </button>
            <button
              onClick={handleSaveVehicle}
              disabled={saving || !vehicleForm.number.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {modal === 'edit-vehicle' ? dict.vehicles.save : dict.vehicles.add}
            </button>
          </>}
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.vehicles.number}</label>
            <input
              value={vehicleForm.number}
              onChange={e => setVehicleForm(f => ({ ...f, number: e.target.value }))}
              placeholder={dict.vehicles.numberPlaceholder}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.vehicles.nameOptional}</label>
            <input
              value={vehicleForm.name}
              onChange={e => setVehicleForm(f => ({ ...f, name: e.target.value }))}
              placeholder={dict.vehicles.namePlaceholder}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          {modal === 'edit-vehicle' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.vehicles.status}</label>
              <select
                value={vehicleForm.is_active ? 'active' : 'inactive'}
                onChange={e => setVehicleForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              >
                <option value="active">{dict.vehicles.statusActive}</option>
                <option value="inactive">{dict.vehicles.statusInactive}</option>
              </select>
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {dict.vehicles.error}: {saveError}
            </div>
          )}
        </Modal>
      )}

      {/* Deactivate vehicle confirmation */}
      {modal === 'deactivate-vehicle' && vehicleTarget && (
        <Modal
          title={dict.vehicles.deactivateVehicleTitle}
          onClose={closeModal}
          closeDisabled={saving}
          footer={<>
            <button
              onClick={closeModal}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              {dict.vehicles.cancel}
            </button>
            <button
              onClick={handleDeactivateVehicle}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              {dict.vehicles.makeInactive}
            </button>
          </>}
        >
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <div className="text-sm font-medium text-slate-900">{vehicleTarget.number}{vehicleTarget.name ? ` — ${vehicleTarget.name}` : ''}</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{dict.vehicles.deactivateVehicleWarning}</span>
          </div>
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {dict.vehicles.error}: {saveError}
            </div>
          )}
        </Modal>
      )}

      {/* Hard delete vehicle confirmation */}
      {modal === 'delete-vehicle' && vehicleTarget && (
        <Modal
          title={dict.vehicles.deleteVehicleTitle}
          onClose={closeModal}
          closeDisabled={saving}
          footer={<>
            <button
              onClick={closeModal}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              {dict.vehicles.cancel}
            </button>
            <button
              onClick={handleDeleteVehicle}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {dict.vehicles.delete}
            </button>
          </>}
        >
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <div className="text-sm font-medium text-slate-900">{vehicleTarget.number}{vehicleTarget.name ? ` — ${vehicleTarget.name}` : ''}</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{dict.vehicles.deleteVehicleWarning}</span>
          </div>
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {dict.vehicles.error}: {saveError}
            </div>
          )}
        </Modal>
      )}

      {/* Add / edit bag modal */}
      {(modal === 'add-bag' || modal === 'edit-bag') && (
        <Modal
          title={modal === 'edit-bag' ? dict.vehicles.editBag : dict.vehicles.newBag}
          onClose={closeModal}
          closeDisabled={saving}
          footer={<>
            <button
              onClick={closeModal}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              {dict.vehicles.cancel}
            </button>
            <button
              onClick={handleSaveBag}
              disabled={saving || !bagForm.number.trim() || !bagForm.vehicle_id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {modal === 'edit-bag' ? dict.vehicles.save : dict.vehicles.add}
            </button>
          </>}
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.vehicles.vehicleLabel}</label>
            <select
              value={bagForm.vehicle_id}
              onChange={e => setBagForm(f => ({ ...f, vehicle_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
            >
              {vehicles.filter(v => v.is_active || v.id === bagForm.vehicle_id).map(v => (
                <option key={v.id} value={v.id}>{v.number}{v.name ? ` — ${v.name}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.vehicles.number}</label>
            <input
              value={bagForm.number}
              onChange={e => setBagForm(f => ({ ...f, number: e.target.value }))}
              placeholder={dict.vehicles.bagNumberPlaceholder}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.vehicles.descriptionOptional}</label>
            <input
              value={bagForm.description}
              onChange={e => setBagForm(f => ({ ...f, description: e.target.value }))}
              placeholder={dict.vehicles.bagDescriptionPlaceholder}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          {modal === 'edit-bag' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.vehicles.status}</label>
              <select
                value={bagForm.is_active ? 'active' : 'inactive'}
                onChange={e => setBagForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              >
                <option value="active">{dict.vehicles.statusActive}</option>
                <option value="inactive">{dict.vehicles.statusInactive}</option>
              </select>
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {dict.vehicles.error}: {saveError}
            </div>
          )}
        </Modal>
      )}

      {/* Deactivate bag confirmation */}
      {modal === 'deactivate-bag' && bagTarget && (
        <Modal
          title={dict.vehicles.deactivateBagTitle}
          onClose={closeModal}
          closeDisabled={saving}
          footer={<>
            <button
              onClick={closeModal}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              {dict.vehicles.cancel}
            </button>
            <button
              onClick={handleDeactivateBag}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              {dict.vehicles.makeInactive}
            </button>
          </>}
        >
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <div className="text-sm font-medium text-slate-900">{bagTarget.number}{bagTarget.description ? ` — ${bagTarget.description}` : ''}</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{dict.vehicles.deactivateBagWarning}</span>
          </div>
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {dict.vehicles.error}: {saveError}
            </div>
          )}
        </Modal>
      )}

      {/* Hard delete bag confirmation */}
      {modal === 'delete-bag' && bagTarget && (
        <Modal
          title={dict.vehicles.deleteBagTitle}
          onClose={closeModal}
          closeDisabled={saving}
          footer={<>
            <button
              onClick={closeModal}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              {dict.vehicles.cancel}
            </button>
            <button
              onClick={handleDeleteBag}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {dict.vehicles.delete}
            </button>
          </>}
        >
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <div className="text-sm font-medium text-slate-900">{bagTarget.number}{bagTarget.description ? ` — ${bagTarget.description}` : ''}</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{dict.vehicles.deleteBagWarning}</span>
          </div>
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {dict.vehicles.error}: {saveError}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

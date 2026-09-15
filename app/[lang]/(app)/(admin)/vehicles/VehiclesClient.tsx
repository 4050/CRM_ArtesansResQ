'use client'

import { useState } from 'react'
import { Plus, Truck, ShoppingBag, Edit2, Trash2, Ban } from 'lucide-react'
import {
  createVehicleAction,
  updateVehicleAction,
  archiveVehicleAction,
  deleteVehicleAction,
  createBagAction,
  updateBagAction,
  archiveBagAction,
  deleteBagAction,
  type NewVehicleInput,
  type VehicleFormInput,
  type NewBagInput,
  type BagFormInput,
} from './actions'
import type { Vehicle, Bag } from '@/types'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import { cn } from '@/lib/utils'
import { useArchivableCrud } from '@/lib/hooks/useArchivableCrud'
import EntityFormModal from '@/components/ui/EntityFormModal'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Props {
  lang: Locale
  dict: Dictionary
  vehicles: Vehicle[]
  bags: Bag[]
  isAdmin: boolean
}

interface VehicleForm {
  number: string
  name: string
  is_active: boolean
}

interface BagForm {
  number: string
  description: string
  is_active: boolean
}

const emptyVehicleForm: VehicleForm = { number: '', name: '', is_active: true }
const emptyBagForm: BagForm = { number: '', description: '', is_active: true }

export default function VehiclesClient({ lang, dict, vehicles: initialVehicles, bags: initialBags, isAdmin }: Props) {
  const [showInactiveVehicles, setShowInactiveVehicles] = useState(false)
  const [showInactiveBags, setShowInactiveBags] = useState(false)

  const vehicleCrud = useArchivableCrud<Vehicle, VehicleForm, NewVehicleInput, VehicleFormInput>(initialVehicles, {
    actions: {
      create: input => createVehicleAction(lang, input),
      update: (id, input) => updateVehicleAction(lang, id, input),
      archive: id => archiveVehicleAction(lang, id),
      remove: id => deleteVehicleAction(lang, id),
    },
    emptyForm: emptyVehicleForm,
    toForm: v => ({ number: v.number, name: v.name ?? '', is_active: v.is_active }),
    toCreateInput: form => ({ number: form.number.trim(), name: form.name.trim() || null }),
    toUpdateInput: form => ({ number: form.number.trim(), name: form.name.trim() || null, is_active: form.is_active }),
  })

  const bagCrud = useArchivableCrud<Bag, BagForm, NewBagInput, BagFormInput>(initialBags, {
    actions: {
      create: input => createBagAction(lang, input),
      update: (id, input) => updateBagAction(lang, id, input),
      archive: id => archiveBagAction(lang, id),
      remove: id => deleteBagAction(lang, id),
    },
    emptyForm: emptyBagForm,
    toForm: b => ({ number: b.number, description: b.description ?? '', is_active: b.is_active }),
    toCreateInput: form => ({ number: form.number.trim(), description: form.description.trim() || null }),
    toUpdateInput: form => ({ number: form.number.trim(), description: form.description.trim() || null, is_active: form.is_active }),
  })

  const visibleVehicles = vehicleCrud.items.filter(v => v.is_active || showInactiveVehicles)
  const visibleBags = bagCrud.items.filter(b => b.is_active || showInactiveBags)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{dict.vehicles.title}</h1>

      {/* Vehicles */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">{dict.vehicles.vehiclesSection}</h2>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
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
                onClick={vehicleCrud.openAdd}
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
              <div key={v.id} className={cn('px-5 py-3 flex items-center justify-between flex-wrap gap-2', !v.is_active && 'opacity-50')}>
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
                    <button onClick={() => vehicleCrud.openEdit(v)} title={dict.vehicles.edit} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {v.is_active && (
                      <button onClick={() => vehicleCrud.openDeactivate(v)} title={dict.vehicles.deactivate} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => vehicleCrud.openDelete(v)} title={dict.vehicles.deleteForever} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">{dict.vehicles.bagsSection}</h2>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
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
                onClick={bagCrud.openAdd}
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
              <div key={b.id} className={cn('px-5 py-3 flex items-center justify-between flex-wrap gap-2', !b.is_active && 'opacity-50')}>
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
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => bagCrud.openEdit(b)} title={dict.vehicles.edit} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {b.is_active && (
                        <button onClick={() => bagCrud.openDeactivate(b)} title={dict.vehicles.deactivate} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => bagCrud.openDelete(b)} title={dict.vehicles.deleteForever} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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

      {/* Add / edit vehicle */}
      {(vehicleCrud.modal === 'add' || vehicleCrud.modal === 'edit') && (
        <EntityFormModal
          title={vehicleCrud.modal === 'edit' ? dict.vehicles.editVehicle : dict.vehicles.newVehicle}
          primaryLabel={dict.vehicles.number}
          primaryValue={vehicleCrud.form.number}
          primaryPlaceholder={dict.vehicles.numberPlaceholder}
          onPrimaryChange={number => vehicleCrud.setForm(f => ({ ...f, number }))}
          secondaryLabel={dict.vehicles.nameOptional}
          secondaryValue={vehicleCrud.form.name}
          secondaryPlaceholder={dict.vehicles.namePlaceholder}
          onSecondaryChange={name => vehicleCrud.setForm(f => ({ ...f, name }))}
          showStatus={vehicleCrud.modal === 'edit'}
          statusLabel={dict.vehicles.status}
          statusActive={vehicleCrud.form.is_active}
          onStatusChange={is_active => vehicleCrud.setForm(f => ({ ...f, is_active }))}
          statusActiveLabel={dict.vehicles.statusActive}
          statusInactiveLabel={dict.vehicles.statusInactive}
          saveLabel={vehicleCrud.modal === 'edit' ? dict.vehicles.save : dict.vehicles.add}
          cancelLabel={dict.vehicles.cancel}
          saving={vehicleCrud.saving}
          canSave={!!vehicleCrud.form.number.trim()}
          error={vehicleCrud.error}
          errorLabel={dict.vehicles.error}
          onClose={vehicleCrud.close}
          onSave={vehicleCrud.save}
        />
      )}

      {/* Deactivate vehicle confirmation */}
      {vehicleCrud.modal === 'deactivate' && vehicleCrud.target && (
        <ConfirmModal
          title={dict.vehicles.deactivateVehicleTitle}
          itemLabel={`${vehicleCrud.target.number}${vehicleCrud.target.name ? ` — ${vehicleCrud.target.name}` : ''}`}
          warning={dict.vehicles.deactivateVehicleWarning}
          tone="amber"
          icon={Ban}
          confirmLabel={dict.vehicles.makeInactive}
          cancelLabel={dict.vehicles.cancel}
          saving={vehicleCrud.saving}
          error={vehicleCrud.error}
          errorLabel={dict.vehicles.error}
          onClose={vehicleCrud.close}
          onConfirm={vehicleCrud.confirmDeactivate}
        />
      )}

      {/* Hard delete vehicle confirmation */}
      {vehicleCrud.modal === 'delete' && vehicleCrud.target && (
        <ConfirmModal
          title={dict.vehicles.deleteVehicleTitle}
          itemLabel={`${vehicleCrud.target.number}${vehicleCrud.target.name ? ` — ${vehicleCrud.target.name}` : ''}`}
          warning={dict.vehicles.deleteVehicleWarning}
          tone="red"
          icon={Trash2}
          confirmLabel={dict.vehicles.delete}
          cancelLabel={dict.vehicles.cancel}
          saving={vehicleCrud.saving}
          error={vehicleCrud.error}
          errorLabel={dict.vehicles.error}
          onClose={vehicleCrud.close}
          onConfirm={vehicleCrud.confirmDelete}
        />
      )}

      {/* Add / edit bag */}
      {(bagCrud.modal === 'add' || bagCrud.modal === 'edit') && (
        <EntityFormModal
          title={bagCrud.modal === 'edit' ? dict.vehicles.editBag : dict.vehicles.newBag}
          primaryLabel={dict.vehicles.number}
          primaryValue={bagCrud.form.number}
          primaryPlaceholder={dict.vehicles.bagNumberPlaceholder}
          onPrimaryChange={number => bagCrud.setForm(f => ({ ...f, number }))}
          secondaryLabel={dict.vehicles.descriptionOptional}
          secondaryValue={bagCrud.form.description}
          secondaryPlaceholder={dict.vehicles.bagDescriptionPlaceholder}
          onSecondaryChange={description => bagCrud.setForm(f => ({ ...f, description }))}
          showStatus={bagCrud.modal === 'edit'}
          statusLabel={dict.vehicles.status}
          statusActive={bagCrud.form.is_active}
          onStatusChange={is_active => bagCrud.setForm(f => ({ ...f, is_active }))}
          statusActiveLabel={dict.vehicles.statusActive}
          statusInactiveLabel={dict.vehicles.statusInactive}
          saveLabel={bagCrud.modal === 'edit' ? dict.vehicles.save : dict.vehicles.add}
          cancelLabel={dict.vehicles.cancel}
          saving={bagCrud.saving}
          canSave={!!bagCrud.form.number.trim()}
          error={bagCrud.error}
          errorLabel={dict.vehicles.error}
          onClose={bagCrud.close}
          onSave={bagCrud.save}
        />
      )}

      {/* Deactivate bag confirmation */}
      {bagCrud.modal === 'deactivate' && bagCrud.target && (
        <ConfirmModal
          title={dict.vehicles.deactivateBagTitle}
          itemLabel={`${bagCrud.target.number}${bagCrud.target.description ? ` — ${bagCrud.target.description}` : ''}`}
          warning={dict.vehicles.deactivateBagWarning}
          tone="amber"
          icon={Ban}
          confirmLabel={dict.vehicles.makeInactive}
          cancelLabel={dict.vehicles.cancel}
          saving={bagCrud.saving}
          error={bagCrud.error}
          errorLabel={dict.vehicles.error}
          onClose={bagCrud.close}
          onConfirm={bagCrud.confirmDeactivate}
        />
      )}

      {/* Hard delete bag confirmation */}
      {bagCrud.modal === 'delete' && bagCrud.target && (
        <ConfirmModal
          title={dict.vehicles.deleteBagTitle}
          itemLabel={`${bagCrud.target.number}${bagCrud.target.description ? ` — ${bagCrud.target.description}` : ''}`}
          warning={dict.vehicles.deleteBagWarning}
          tone="red"
          icon={Trash2}
          confirmLabel={dict.vehicles.delete}
          cancelLabel={dict.vehicles.cancel}
          saving={bagCrud.saving}
          error={bagCrud.error}
          errorLabel={dict.vehicles.error}
          onClose={bagCrud.close}
          onConfirm={bagCrud.confirmDelete}
        />
      )}
    </div>
  )
}

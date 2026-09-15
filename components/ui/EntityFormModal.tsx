'use client'

import { Loader2 } from 'lucide-react'
import Modal from './Modal'

interface Props {
  title: string
  primaryLabel: string
  primaryValue: string
  primaryPlaceholder: string
  onPrimaryChange: (value: string) => void
  secondaryLabel: string
  secondaryValue: string
  secondaryPlaceholder: string
  onSecondaryChange: (value: string) => void
  showStatus: boolean
  statusLabel: string
  statusActive: boolean
  onStatusChange: (active: boolean) => void
  statusActiveLabel: string
  statusInactiveLabel: string
  saveLabel: string
  cancelLabel: string
  saving: boolean
  canSave: boolean
  error: string
  errorLabel: string
  onClose: () => void
  onSave: () => void
}

// The add/edit form shape shared by every archivable entity screen: a
// required "number" field, one optional free-text field, and (only while
// editing) a status toggle. See VehiclesClient.tsx (vehicles and bags),
// which used to carry two near-identical copies of this dialog.
export default function EntityFormModal({
  title,
  primaryLabel,
  primaryValue,
  primaryPlaceholder,
  onPrimaryChange,
  secondaryLabel,
  secondaryValue,
  secondaryPlaceholder,
  onSecondaryChange,
  showStatus,
  statusLabel,
  statusActive,
  onStatusChange,
  statusActiveLabel,
  statusInactiveLabel,
  saveLabel,
  cancelLabel,
  saving,
  canSave,
  error,
  errorLabel,
  onClose,
  onSave,
}: Props) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      closeDisabled={saving}
      footer={<>
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onSave}
          disabled={saving || !canSave}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saveLabel}
        </button>
      </>}
    >
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{primaryLabel}</label>
        <input
          value={primaryValue}
          onChange={e => onPrimaryChange(e.target.value)}
          placeholder={primaryPlaceholder}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{secondaryLabel}</label>
        <input
          value={secondaryValue}
          onChange={e => onSecondaryChange(e.target.value)}
          placeholder={secondaryPlaceholder}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      {showStatus && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{statusLabel}</label>
          <select
            value={statusActive ? 'active' : 'inactive'}
            onChange={e => onStatusChange(e.target.value === 'active')}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
          >
            <option value="active">{statusActiveLabel}</option>
            <option value="inactive">{statusInactiveLabel}</option>
          </select>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {errorLabel}: {error}
        </div>
      )}
    </Modal>
  )
}

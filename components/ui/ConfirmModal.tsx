'use client'

import { AlertTriangle, Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal from './Modal'

interface Props {
  title: string
  itemLabel: string
  warning: string
  tone: 'amber' | 'red'
  icon: LucideIcon
  confirmLabel: string
  cancelLabel: string
  saving: boolean
  error: string
  errorLabel: string
  onClose: () => void
  onConfirm: () => void
}

const TONE_CLASSES: Record<Props['tone'], { button: string; warning: string }> = {
  amber: {
    button: 'bg-amber-600 hover:bg-amber-700',
    warning: 'text-amber-800 bg-amber-50 border-amber-200',
  },
  red: {
    button: 'bg-red-600 hover:bg-red-700',
    warning: 'text-red-800 bg-red-50 border-red-200',
  },
}

// The deactivate/delete confirmation shape shared by every archivable
// entity screen: an item summary, a colored warning, and a
// cancel/confirm footer. See VehiclesClient.tsx (vehicles and bags),
// which used to carry four near-identical copies of this dialog.
export default function ConfirmModal({
  title,
  itemLabel,
  warning,
  tone,
  icon: Icon,
  confirmLabel,
  cancelLabel,
  saving,
  error,
  errorLabel,
  onClose,
  onConfirm,
}: Props) {
  const toneClasses = TONE_CLASSES[tone]

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
          onClick={onConfirm}
          disabled={saving}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 rounded-lg transition-colors',
            toneClasses.button,
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
          {confirmLabel}
        </button>
      </>}
    >
      <div className="bg-slate-50 rounded-lg px-4 py-3">
        <div className="text-sm font-medium text-slate-900">{itemLabel}</div>
      </div>
      <div className={cn('flex items-start gap-2 text-sm border rounded-lg px-4 py-3', toneClasses.warning)}>
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{warning}</span>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {errorLabel}: {error}
        </div>
      )}
    </Modal>
  )
}

'use client'

import { useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

interface Props {
  title: string
  onClose: () => void
  // Disable the X button while a destructive action is in flight — only the
  // confirmation dialogs (delete/deactivate) do this; forms don't bother.
  closeDisabled?: boolean
  maxWidth?: 'max-w-sm' | 'max-w-md' | 'max-w-2xl' | 'max-w-4xl'
  children: ReactNode
  footer: ReactNode
}

// Full class names spelled out as literal strings (not built with template
// interpolation) so Tailwind's build-time source scanner - which just looks
// for whole utility tokens in the raw file text - actually picks them up.
// Below `sm` the dialog is always edge-to-edge full width; maxWidth only
// caps it at `sm` and up, once it's back to a centered floating card.
const SM_MAX_WIDTH: Record<NonNullable<Props['maxWidth']>, string> = {
  'max-w-sm': 'sm:max-w-sm',
  'max-w-md': 'sm:max-w-md',
  'max-w-2xl': 'sm:max-w-2xl',
  'max-w-4xl': 'sm:max-w-4xl',
}

export default function Modal({ title, onClose, closeDisabled, maxWidth = 'max-w-sm', children, footer }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Every CRUD/confirmation flow in the app goes through this component, so
  // it needs to behave like a real dialog for keyboard/screen-reader users -
  // see lib/hooks/useFocusTrap.ts.
  useFocusTrap(dialogRef, { onClose, closeDisabled })

  return (
    // Below `sm`, this anchors to the bottom edge full-bleed (a "bottom
    // sheet") instead of floating a centered card - reachable one-handed
    // and edge-to-edge on a phone, which is where every one of this app's
    // CRUD/confirmation flows actually gets used. At `sm` and up it's the
    // original centered dialog.
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full flex flex-col max-h-[92vh] sm:max-h-[85vh]', SM_MAX_WIDTH[maxWidth])}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 id={titleId} className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} disabled={closeDisabled} className="p-2.5 -m-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {children}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 shrink-0">
          {footer}
        </div>
      </div>
    </div>
  )
}

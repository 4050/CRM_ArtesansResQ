'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  onClose: () => void
  // Disable the X button while a destructive action is in flight — only the
  // confirmation dialogs (delete/deactivate) do this; forms don't bother.
  closeDisabled?: boolean
  maxWidth?: 'max-w-sm' | 'max-w-md' | 'max-w-2xl'
  children: ReactNode
  footer: ReactNode
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ title, onClose, closeDisabled, maxWidth = 'max-w-sm', children, footer }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Every CRUD/confirmation flow in the app goes through this component, so
  // it needs to behave like a real dialog for keyboard/screen-reader users:
  // focus moves in on open and back out on close, Escape closes it (unless
  // an action is in flight, matching the X button's own disabled state),
  // and Tab can't escape to the page behind the overlay.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!closeDisabled) onClose()
        return
      }
      if (e.key !== 'Tab' || !dialog) return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose, closeDisabled])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('bg-white rounded-2xl shadow-xl w-full', maxWidth)}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 id={titleId} className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} disabled={closeDisabled} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          {footer}
        </div>
      </div>
    </div>
  )
}

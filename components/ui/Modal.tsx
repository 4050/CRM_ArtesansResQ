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

// Full class names spelled out as literal strings (not built with template
// interpolation) so Tailwind's build-time source scanner - which just looks
// for whole utility tokens in the raw file text - actually picks them up.
// Below `sm` the dialog is always edge-to-edge full width; maxWidth only
// caps it at `sm` and up, once it's back to a centered floating card.
const SM_MAX_WIDTH: Record<NonNullable<Props['maxWidth']>, string> = {
  'max-w-sm': 'sm:max-w-sm',
  'max-w-md': 'sm:max-w-md',
  'max-w-2xl': 'sm:max-w-2xl',
}

export default function Modal({ title, onClose, closeDisabled, maxWidth = 'max-w-sm', children, footer }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // onClose/closeDisabled are read through refs, not effect deps - every
  // keystroke in a form field re-renders the parent with a new `onClose`
  // function identity, and putting that in the deps array reran this
  // effect on every keystroke, stealing focus back to the dialog's first
  // focusable element (the X button) mid-typing. Refs are updated in their
  // own effect (not directly during render, which React disallows) so
  // they're always current by the time a keydown handler reads them.
  const onCloseRef = useRef(onClose)
  const closeDisabledRef = useRef(closeDisabled)
  useEffect(() => {
    onCloseRef.current = onClose
    closeDisabledRef.current = closeDisabled
  })

  // Every CRUD/confirmation flow in the app goes through this component, so
  // it needs to behave like a real dialog for keyboard/screen-reader users:
  // focus moves in on open and back out on close, Escape closes it (unless
  // an action is in flight, matching the X button's own disabled state),
  // and Tab can't escape to the page behind the overlay. Runs once per
  // mount/unmount (i.e. once per open/close), not on every re-render.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!closeDisabledRef.current) onCloseRef.current()
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
  }, [])

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

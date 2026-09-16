'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface Options {
  onClose: () => void
  // Disable the Escape shortcut while a destructive action is in flight -
  // only some dialogs (confirmations, forms mid-save) do this.
  closeDisabled?: boolean
  // Whether to focus the dialog's first focusable element on mount.
  // Disable when the caller wants to focus something specific itself
  // regardless of DOM order - see ConsumablePicker.tsx, which focuses its
  // search input via its own effect instead.
  autoFocus?: boolean
}

// Keyboard/focus behavior shared by every full-screen dialog in this app:
// focus moves in on open and back out on close, Escape closes it (unless
// closeDisabled), and Tab can't escape to the page behind the overlay.
// See components/ui/Modal.tsx and components/calls/ConsumablePicker.tsx,
// which used to each carry their own near-identical copy of this - kept
// as two call sites rather than folded into one shared dialog component,
// since their surrounding markup (title/children/footer slots vs. a
// custom search+list+quantity-footer layout) doesn't map onto each other.
export function useFocusTrap(dialogRef: RefObject<HTMLElement | null>, { onClose, closeDisabled, autoFocus = true }: Options) {
  // onClose/closeDisabled are read through refs, not effect deps - an
  // inline onClose (a new function identity every render, e.g. from a
  // parent re-rendering on every keystroke in a form field) would rerun
  // this effect constantly, stealing focus back to the dialog's first
  // focusable element mid-typing. Refs are updated in their own effect
  // (not directly during render, which React disallows) so they're always
  // current by the time a keydown handler reads them.
  const onCloseRef = useRef(onClose)
  const closeDisabledRef = useRef(closeDisabled)
  useEffect(() => {
    onCloseRef.current = onClose
    closeDisabledRef.current = closeDisabled
  })

  // Runs once per mount/unmount (i.e. once per open/close), not on every
  // re-render.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    if (autoFocus) dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately once-per-mount, see comment above
  }, [])
}

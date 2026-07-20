'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  onClose: () => void
  // Disable the X button while a destructive action is in flight — only the
  // confirmation dialogs (delete/deactivate) do this; forms don't bother.
  closeDisabled?: boolean
  maxWidth?: 'max-w-sm' | 'max-w-md'
  children: ReactNode
  footer: ReactNode
}

export default function Modal({ title, onClose, closeDisabled, maxWidth = 'max-w-sm', children, footer }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={cn('bg-white rounded-2xl shadow-xl w-full', maxWidth)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} disabled={closeDisabled} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {children}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          {footer}
        </div>
      </div>
    </div>
  )
}

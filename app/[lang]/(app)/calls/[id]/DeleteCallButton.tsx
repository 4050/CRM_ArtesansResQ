'use client'

import { useState } from 'react'
import { Trash2, Loader2, X, AlertTriangle } from 'lucide-react'
import { deleteCallAction } from '../actions'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'

interface Props {
  lang: Locale
  dict: Dictionary['calls']['deleteButton']
  callId: string
}

export default function DeleteCallButton({ lang, dict, callId }: Props) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')

    const result = await deleteCallAction(lang, callId)
    if (result?.error) {
      setError(result.error)
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-slate-300 hover:bg-red-50 hover:border-red-300 rounded-lg transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        {dict.delete}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{dict.title}</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                {dict.warning}
              </p>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
              >
                {dict.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {dict.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

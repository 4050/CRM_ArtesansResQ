'use client'

import { useState } from 'react'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { deleteCallAction } from '../actions'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import Modal from '@/components/ui/Modal'

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

    // Same try/finally shape as NewCallForm/EditCallForm's submit handlers -
    // deleteCallAction redirects on success (which unwinds through here as
    // a thrown Next.js signal, not a normal return), so this can't be a
    // try/catch: catching it would treat the redirect as an error. Without
    // finally, though, any *other* thrown failure (a dropped connection,
    // not an { error } response) left `deleting` stuck true forever, with
    // every button in the modal - including the X - disabled and no way
    // out short of a page reload.
    try {
      const result = await deleteCallAction(lang, callId)
      if (result?.error) {
        setError(result.error)
      }
    } finally {
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
        <Modal
          title={dict.title}
          onClose={() => setOpen(false)}
          closeDisabled={deleting}
          footer={<>
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
          </>}
        >
          <p className="text-sm text-slate-600">
            {dict.warning}
          </p>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

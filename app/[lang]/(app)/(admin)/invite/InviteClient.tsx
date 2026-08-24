'use client'

import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { inviteUserAction } from './actions'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'

interface Props {
  lang: Locale
  dict: Dictionary
}

export default function InviteClient({ lang, dict }: Props) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const result = await inviteUserAction(lang, email)

    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(dict.invite.success.replace('{email}', email.trim()))
      setEmail('')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.invite.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.invite.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.invite.email}</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder={dict.invite.emailPlaceholder}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {dict.invite.submit}
        </button>
      </form>
    </div>
  )
}

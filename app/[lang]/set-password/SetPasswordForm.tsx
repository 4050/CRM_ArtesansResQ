'use client'

import { useState } from 'react'
import { setPasswordAction } from '@/lib/actions/auth'
import { Ambulance, Loader2 } from 'lucide-react'
import type { Locale } from '@/app/[lang]/dictionaries'

interface Props {
  lang: Locale
  dict: {
    appName: string
    appTagline: string
    title: string
    subtitle: string
    password: string
    confirmPassword: string
    submit: string
    passwordPlaceholder: string
    passwordsDontMatch: string
  }
}

export default function SetPasswordForm({ lang, dict }: Props) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(dict.passwordsDontMatch)
      return
    }

    setLoading(true)
    const result = await setPasswordAction(lang, password)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-600 rounded-2xl mb-4">
            <Ambulance className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.appName}</h1>
          <p className="text-slate-500 text-sm mt-1">{dict.appTagline}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{dict.title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{dict.subtitle}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.password}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder={dict.passwordPlaceholder}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.confirmPassword}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder={dict.passwordPlaceholder}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {dict.submit}
          </button>
        </form>
      </div>
    </div>
  )
}

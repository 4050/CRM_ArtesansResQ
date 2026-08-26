'use client'

import { useState } from 'react'
import { Loader2, Mail, KeyRound } from 'lucide-react'
import { inviteUserAction, createUserAction } from './actions'
import { cn } from '@/lib/utils'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'

interface Props {
  lang: Locale
  dict: Dictionary
}

const inputClass = 'w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent'
const plainInputClass = 'w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent'

function InviteByEmailForm({ lang, dict }: Props) {
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
            className={inputClass}
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
  )
}

function CreateWithPasswordForm({ lang, dict }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const result = await createUserAction(lang, { name, email, password })

    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(dict.invite.successCreate.replace('{email}', email.trim()))
      setName('')
      setEmail('')
      setPassword('')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.invite.name}</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder={dict.invite.namePlaceholder}
          className={plainInputClass}
        />
      </div>

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
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{dict.invite.password}</label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder={dict.invite.passwordPlaceholder}
            className={inputClass}
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
        {dict.invite.submitCreate}
      </button>
    </form>
  )
}

export default function InviteClient({ lang, dict }: Props) {
  const [mode, setMode] = useState<'invite' | 'create'>('invite')

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.invite.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.invite.subtitle}</p>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('invite')}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            mode === 'invite' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {dict.invite.modeInvite}
        </button>
        <button
          type="button"
          onClick={() => setMode('create')}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            mode === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {dict.invite.modeCreate}
        </button>
      </div>

      {mode === 'invite' ? (
        <InviteByEmailForm lang={lang} dict={dict} />
      ) : (
        <CreateWithPasswordForm lang={lang} dict={dict} />
      )}
    </div>
  )
}

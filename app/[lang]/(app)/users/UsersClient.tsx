'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { setUserRoleAction } from './actions'
import type { OrgMember } from '@/lib/data/users'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import { cn } from '@/lib/utils'

interface Props {
  lang: Locale
  dict: Dictionary
  members: OrgMember[]
  currentUserId: string
}

export default function UsersClient({ lang, dict, members: initial, currentUserId }: Props) {
  const [members, setMembers] = useState(initial)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleRoleChange(userId: string, role: 'admin' | 'medic') {
    setSavingId(userId)
    setError('')

    const { error } = await setUserRoleAction(lang, userId, role)

    if (error) {
      setError(error)
      setSavingId(null)
      return
    }

    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role } : m))
    setSavingId(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.users.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.users.subtitle}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {dict.users.error}: {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="hidden md:table w-full">
          <thead>
            <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
              <th className="text-left px-5 py-3">{dict.users.name}</th>
              <th className="text-left px-5 py-3">{dict.users.role}</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {members.map(member => {
              const isSelf = member.id === currentUserId
              const isMasterAdmin = member.role === 'master_admin'
              return (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">
                    {member.name}
                    {isSelf && <span className="ml-2 text-xs font-normal text-slate-400">{dict.users.thisIsYou}</span>}
                  </td>
                  <td className="px-5 py-3">
                    {isSelf || isMasterAdmin ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                        {dict.users.roleLabels[member.role]}
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={e => handleRoleChange(member.id, e.target.value as 'admin' | 'medic')}
                        disabled={savingId === member.id}
                        className={cn(
                          'px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white disabled:opacity-50',
                        )}
                      >
                        <option value="admin">{dict.users.roleLabels.admin}</option>
                        <option value="medic">{dict.users.roleLabels.medic}</option>
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {savingId === member.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400 inline-block" />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {members.map(member => {
            const isSelf = member.id === currentUserId
            const isMasterAdmin = member.role === 'master_admin'
            return (
              <div key={member.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">{member.name}</span>
                  {isSelf && <span className="text-xs text-slate-400">{dict.users.thisIsYou}</span>}
                </div>
                {isSelf || isMasterAdmin ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                    {dict.users.roleLabels[member.role]}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={e => handleRoleChange(member.id, e.target.value as 'admin' | 'medic')}
                      disabled={savingId === member.id}
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white disabled:opacity-50"
                    >
                      <option value="admin">{dict.users.roleLabels.admin}</option>
                      <option value="medic">{dict.users.roleLabels.medic}</option>
                    </select>
                    {savingId === member.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Loader2, ShieldOff, ShieldCheck, Trash2, AlertTriangle } from 'lucide-react'
import { setUserRoleAction, setUserActiveAction, deleteUserAction } from './actions'
import type { OrgMember } from '@/lib/data/users'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'

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
  const [deleteTarget, setDeleteTarget] = useState<OrgMember | null>(null)

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

  async function handleToggleActive(userId: string, active: boolean) {
    setSavingId(userId)
    setError('')

    const { error } = await setUserActiveAction(lang, userId, active)

    if (error) {
      setError(error)
      setSavingId(null)
      return
    }

    setMembers(prev => prev.map(m => m.id === userId ? { ...m, is_active: active } : m))
    setSavingId(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setSavingId(deleteTarget.id)
    setError('')

    const { error } = await deleteUserAction(lang, deleteTarget.id)

    if (error) {
      setError(error)
      setSavingId(null)
      return
    }

    setMembers(prev => prev.filter(m => m.id !== deleteTarget.id))
    setSavingId(null)
    setDeleteTarget(null)
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
              <th className="text-left px-5 py-3">{dict.users.access}</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {members.map(member => {
              const isSelf = member.id === currentUserId
              const isMasterAdmin = member.role === 'master_admin'
              const isProtected = isSelf || isMasterAdmin
              const saving = savingId === member.id
              return (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">
                    {member.name}
                    {isSelf && <span className="ml-2 text-xs font-normal text-slate-400">{dict.users.thisIsYou}</span>}
                  </td>
                  <td className="px-5 py-3">
                    {isProtected ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                        {dict.users.roleLabels[member.role]}
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={e => handleRoleChange(member.id, e.target.value as 'admin' | 'medic')}
                        disabled={saving}
                        className={cn(
                          'px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white disabled:opacity-50',
                        )}
                      >
                        <option value="admin">{dict.users.roleLabels.admin}</option>
                        <option value="medic">{dict.users.roleLabels.medic}</option>
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                        member.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                      )}
                    >
                      {member.is_active ? dict.users.statusActive : dict.users.statusRestricted}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400 inline-block" />
                    ) : !isProtected && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(member.id, !member.is_active)}
                          title={member.is_active ? dict.users.restrict : dict.users.restore}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        >
                          {member.is_active ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(member)}
                          title={dict.users.deleteUser}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
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
            const isProtected = isSelf || isMasterAdmin
            const saving = savingId === member.id
            return (
              <div key={member.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">{member.name}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                        member.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                      )}
                    >
                      {member.is_active ? dict.users.statusActive : dict.users.statusRestricted}
                    </span>
                    {isSelf && <span className="text-xs text-slate-400">{dict.users.thisIsYou}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isProtected ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                      {dict.users.roleLabels[member.role]}
                    </span>
                  ) : (
                    <select
                      value={member.role}
                      onChange={e => handleRoleChange(member.id, e.target.value as 'admin' | 'medic')}
                      disabled={saving}
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white disabled:opacity-50"
                    >
                      <option value="admin">{dict.users.roleLabels.admin}</option>
                      <option value="medic">{dict.users.roleLabels.medic}</option>
                    </select>
                  )}
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  ) : !isProtected && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(member.id, !member.is_active)}
                        title={member.is_active ? dict.users.restrict : dict.users.restore}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                      >
                        {member.is_active ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(member)}
                        title={dict.users.deleteUser}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {deleteTarget && (
        <Modal
          title={dict.users.deleteTitle}
          onClose={() => setDeleteTarget(null)}
          closeDisabled={savingId === deleteTarget.id}
          footer={<>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={savingId === deleteTarget.id}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
            >
              {dict.users.cancel}
            </button>
            <button
              onClick={handleDelete}
              disabled={savingId === deleteTarget.id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {savingId === deleteTarget.id && <Loader2 className="w-4 h-4 animate-spin" />}
              {dict.users.deleteUser}
            </button>
          </>}
        >
          <p className="text-sm text-slate-600">
            {dict.users.deleteWarning}
          </p>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

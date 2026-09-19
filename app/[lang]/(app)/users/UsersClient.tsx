'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react'
import { setUserRoleAction, setUserActiveAction, deleteUserAction } from './actions'
import type { OrgMember } from '@/lib/data/users'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import { cn, isOnline, ONLINE_THRESHOLD_MS } from '@/lib/utils'
import { formatDateTime } from '@/lib/date-utils'
import ConfirmModal from '@/components/ui/ConfirmModal'

function OnlineStatus({ member, lang, dict }: { member: OrgMember; lang: Locale; dict: Dictionary }) {
  // Re-checked periodically (rather than only at page load) so a member
  // who stops sending heartbeats shows as offline without the admin
  // having to reload the page.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ONLINE_THRESHOLD_MS / 2)
    return () => clearInterval(id)
  }, [])

  if (isOnline(member.last_seen_at, now)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        {dict.users.online}
      </span>
    )
  }

  return (
    <span className="text-xs text-slate-400">
      {member.last_seen_at ? `${dict.users.lastSeenPrefix}: ${formatDateTime(member.last_seen_at, lang)}` : dict.users.lastSeenNever}
    </span>
  )
}

// Shared by the desktop table and mobile card rendering of a member's row
// below - a role badge (protected members) or an editable <select>
// (everyone else). selectClassName is a caller prop, not baked in here,
// since the table cell and the mobile flex row size the control
// differently (the mobile row also needs it to grow via flex-1).
function MemberRoleControl({
  member,
  isProtected,
  saving,
  dict,
  onChange,
  selectClassName,
}: {
  member: OrgMember
  isProtected: boolean
  saving: boolean
  dict: Dictionary
  onChange: (role: 'admin' | 'medic') => void
  selectClassName: string
}) {
  if (isProtected) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
        {dict.users.roleLabels[member.role]}
      </span>
    )
  }

  return (
    <select
      value={member.role}
      onChange={e => onChange(e.target.value as 'admin' | 'medic')}
      disabled={saving}
      className={selectClassName}
    >
      <option value="admin">{dict.users.roleLabels.admin}</option>
      <option value="medic">{dict.users.roleLabels.medic}</option>
    </select>
  )
}

// Shared active/restricted badge - identical in both layouts.
function MemberStatusBadge({ member, dict }: { member: OrgMember; dict: Dictionary }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        member.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
      )}
    >
      {member.is_active ? dict.users.statusActive : dict.users.statusRestricted}
    </span>
  )
}

// The deactivate/restore + delete button pair - identical in both
// layouts. The surrounding saving-spinner/isProtected branching stays at
// each call site instead of in here, since the desktop and mobile
// spinners need slightly different classes (the table cell's needs
// inline-block; the mobile flex row's doesn't).
function MemberActionButtons({
  member,
  dict,
  onToggleActive,
  onDelete,
}: {
  member: OrgMember
  dict: Dictionary
  onToggleActive: () => void
  onDelete: () => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleActive}
        title={member.is_active ? dict.users.restrict : dict.users.restore}
        className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
      >
        {member.is_active ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        title={dict.users.deleteUser}
        className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </>
  )
}

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

  // Computed once per member, then read by both the desktop table and
  // mobile card renderers below - previously recomputed identically in
  // two separate .map() passes over the same list.
  const rows = members.map(member => {
    const isSelf = member.id === currentUserId
    const isMasterAdmin = member.role === 'master_admin'
    return {
      member,
      isSelf,
      isProtected: isSelf || isMasterAdmin,
      saving: savingId === member.id,
    }
  })

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
              <th className="text-left px-5 py-3">{dict.users.online}</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(({ member, isSelf, isProtected, saving }) => (
              <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-slate-900">
                  {member.name}
                  {isSelf && <span className="ml-2 text-xs font-normal text-slate-400">{dict.users.thisIsYou}</span>}
                </td>
                <td className="px-5 py-3">
                  <MemberRoleControl
                    member={member}
                    isProtected={isProtected}
                    saving={saving}
                    dict={dict}
                    onChange={role => handleRoleChange(member.id, role)}
                    selectClassName="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white disabled:opacity-50"
                  />
                </td>
                <td className="px-5 py-3">
                  <MemberStatusBadge member={member} dict={dict} />
                </td>
                <td className="px-5 py-3">
                  <OnlineStatus member={member} lang={lang} dict={dict} />
                </td>
                <td className="px-5 py-3 text-right">
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400 inline-block" />
                  ) : !isProtected && (
                    <div className="flex items-center justify-end gap-2">
                      <MemberActionButtons
                        member={member}
                        dict={dict}
                        onToggleActive={() => handleToggleActive(member.id, !member.is_active)}
                        onDelete={() => setDeleteTarget(member)}
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {rows.map(({ member, isSelf, isProtected, saving }) => (
            <div key={member.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">{member.name}</span>
                <div className="flex items-center gap-2">
                  <MemberStatusBadge member={member} dict={dict} />
                  {isSelf && <span className="text-xs text-slate-400">{dict.users.thisIsYou}</span>}
                </div>
              </div>
              <OnlineStatus member={member} lang={lang} dict={dict} />
              <div className="flex items-center gap-2">
                <MemberRoleControl
                  member={member}
                  isProtected={isProtected}
                  saving={saving}
                  dict={dict}
                  onChange={role => handleRoleChange(member.id, role)}
                  selectClassName="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white disabled:opacity-50"
                />
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : !isProtected && (
                  <MemberActionButtons
                    member={member}
                    dict={dict}
                    onToggleActive={() => handleToggleActive(member.id, !member.is_active)}
                    onDelete={() => setDeleteTarget(member)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title={dict.users.deleteTitle}
          warning={dict.users.deleteWarning}
          tone="red"
          icon={Trash2}
          confirmLabel={dict.users.deleteUser}
          cancelLabel={dict.users.cancel}
          saving={savingId === deleteTarget.id}
          error={error}
          errorLabel={dict.users.error}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

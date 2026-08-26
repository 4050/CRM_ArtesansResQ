import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, Truck, ShoppingBag, User, FileText, Package, Pencil } from 'lucide-react'
import { formatDateTime, toBCP47 } from '@/lib/utils'
import { unitLabel, categoryLabel } from '@/lib/consumable-labels'
import { getCallDetail } from '@/lib/data/calls'
import { getProfile } from '@/lib/data/users'
import { isAdminRole } from '@/lib/roles'
import { getDictionary, hasLocale } from '../../../dictionaries'
import DeleteCallButton from './DeleteCallButton'

export default async function CallDetailPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const dateLocale = toBCP47(lang)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const authUserId = claimsData?.claims.sub

  const [call, profile] = await Promise.all([
    getCallDetail(id),
    getProfile(authUserId!),
  ])

  if (!call) notFound()

  const date = new Date(call.date)
  const vehicle = call.vehicle as { number: string; name: string | null } | null
  const bag = call.bag as { number: string; description: string | null } | null
  const callUser = call.user as { name: string } | null
  const canManage = call.user_id === authUserId || isAdminRole(profile?.role)
  const writeoffs = (call.writeoffs ?? []) as {
    id: string
    quantity: number
    consumable_id: string | null
    consumable: { name: string; unit: string; category: string } | null
  }[]

  const grouped = writeoffs.reduce<Record<string, typeof writeoffs>>((acc, w) => {
    const cat = w.consumable?.category ?? 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(w)
    return acc
  }, {})

  const totalItems = writeoffs.reduce((s, w) => s + w.quantity, 0)

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/${lang}/writeoffs`}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{dict.calls.detail.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{formatDateTime(call.date, lang)}</p>
        </div>
        {canManage && <div className="flex items-center gap-2">
          <Link
            href={`/${lang}/calls/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
            {dict.calls.detail.edit}
          </Link>
          <DeleteCallButton lang={lang} dict={dict.calls.deleteButton} callId={id} />
        </div>}
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-slate-100">
          <div className="px-5 py-4 flex items-start gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">{dict.calls.detail.date}</div>
              <div className="text-sm font-medium text-slate-800">
                {date.toLocaleDateString(dateLocale, { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
          <div className="px-5 py-4 flex items-start gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">{dict.calls.detail.time}</div>
              <div className="text-sm font-medium text-slate-800">
                {date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-slate-100">
          <div className="px-5 py-4 flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <Truck className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">{dict.calls.detail.vehicle}</div>
              <div className="text-sm font-medium text-slate-800">
                {vehicle?.number ?? '—'}
              </div>
              {vehicle?.name && (
                <div className="text-xs text-slate-400">{vehicle.name}</div>
              )}
            </div>
          </div>
          <div className="px-5 py-4 flex items-start gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <ShoppingBag className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">{dict.calls.detail.bag}</div>
              <div className="text-sm font-medium text-slate-800">
                {bag?.number ?? '—'}
              </div>
              {bag?.description && (
                <div className="text-xs text-slate-400">{bag.description}</div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 flex items-start gap-3">
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-0.5">{dict.calls.detail.writtenOffBy}</div>
            <div className="text-sm font-medium text-slate-800">{callUser?.name ?? '—'}</div>
          </div>
        </div>

        {call.description && (
          <div className="px-5 py-4 flex items-start gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">{dict.calls.detail.description}</div>
              <div className="text-sm text-slate-700 leading-relaxed">{call.description}</div>
            </div>
          </div>
        )}
      </div>

      {/* Writeoffs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">{dict.calls.detail.writtenOffItems}</h2>
          </div>
          {writeoffs.length > 0 && (
            <span className="text-sm text-slate-400">{writeoffs.length} {dict.calls.detail.items} · {totalItems} {dict.calls.detail.units}</span>
          )}
        </div>

        {writeoffs.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">
            {dict.calls.detail.noneWrittenOff}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-5 py-2 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {categoryLabel(dict, category)}
                </div>
                {items.map((w) => (
                  <div key={w.id} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-800">{w.consumable?.name ?? '—'}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {w.quantity}{' '}
                      <span className="font-normal text-slate-400">{w.consumable ? unitLabel(dict, w.consumable.unit) : ''}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

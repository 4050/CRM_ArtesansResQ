import { BarChart3, CalendarDays, Package, Users } from 'lucide-react'
import { getWriteoffsInRange } from '@/lib/data/writeoffs'
import { unitLabel, categoryLabel, sourceLabel } from '@/lib/consumable-labels'
import { dateInputStartOfDayIso, dateInputEndOfDayIso } from '@/lib/utils'
import { ORG_TIMEZONE } from '@/lib/timezone'
import { getDictionary, hasLocale } from '../../../dictionaries'
import { notFound } from 'next/navigation'

// "YYYY-MM-DD" for `date`'s calendar date in the org's timezone (see
// lib/timezone.ts), for a <input type="date"> default value - not the
// server's timezone, which date.toISOString().slice(0, 10) would silently
// use instead.
function toDateInput(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ORG_TIMEZONE }).format(date)
}

// Shape + parseability check on the raw "from"/"to" query params before
// they're fed into the org-timezone conversion below - decoupled from that
// conversion on purpose, since it doesn't need to know about any timezone.
function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  const sp = await searchParams
  const now = new Date()
  const todayInput = toDateInput(now)
  const monthStartInput = `${todayInput.slice(0, 7)}-01`
  const from = sp.from ?? monthStartInput
  const to = sp.to ?? todayInput
  const validRange = isValidDateInput(from) && isValidDateInput(to) && from <= to

  const report = validRange
    ? await getWriteoffsInRange(dateInputStartOfDayIso(from, ORG_TIMEZONE), dateInputEndOfDayIso(to, ORG_TIMEZONE))
    : { operations: 0, totalQuantity: 0, employees: 0, byConsumable: [] }

  const { operations, totalQuantity, employees } = report
  const byConsumable = report.byConsumable.map(item => ({
    name: item.name ?? dict.reports.deletedItem,
    unit: item.unit ?? 'pcs',
    category: item.category ?? 'other',
    source: item.source ?? 'other',
    quantity: item.quantity,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{dict.reports.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.reports.subtitle}</p>
      </div>

      <form className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-2 gap-3 w-full sm:contents">
          <label className="text-sm text-slate-600 w-full sm:w-auto">
            <span className="block mb-1.5 font-medium">{dict.reports.fromDate}</span>
            <input name="from" type="date" defaultValue={from} className="w-full sm:w-auto px-3 py-2 border border-slate-300 rounded-lg" />
          </label>
          <label className="text-sm text-slate-600 w-full sm:w-auto">
            <span className="block mb-1.5 font-medium">{dict.reports.toDate}</span>
            <input name="to" type="date" defaultValue={to} className="w-full sm:w-auto px-3 py-2 border border-slate-300 rounded-lg" />
          </label>
        </div>
        <button className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg">{dict.reports.generate}</button>
        {!validRange && <span className="text-sm text-red-600">{dict.reports.invalidRange}</span>}
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: dict.reports.writeoffOperations, value: operations, icon: CalendarDays, bgClass: 'bg-blue-100', iconClass: 'text-blue-600' },
          { label: dict.reports.unitsWrittenOff, value: totalQuantity, icon: Package, bgClass: 'bg-green-100', iconClass: 'text-green-600' },
          { label: dict.reports.employees, value: employees, icon: Users, bgClass: 'bg-purple-100', iconClass: 'text-purple-600' },
        ].map(({ label, value, icon: Icon, bgClass, iconClass }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${iconClass}`} />
            </div>
            <div><div className="text-2xl font-bold text-slate-900">{value}</div><div className="text-sm text-slate-500">{label}</div></div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900">{dict.reports.consumptionByItem}</h2>
        </div>
        {byConsumable.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">{dict.reports.noneForPeriod}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {byConsumable.map(item => (
              <div key={`${item.category}:${item.source}:${item.name}`} className="px-5 py-3 flex items-center justify-between gap-4">
                <div><div className="text-sm font-medium text-slate-900">{item.name}</div><div className="text-xs text-slate-400">{categoryLabel(dict, item.category)} · {sourceLabel(dict, item.source)}</div></div>
                <div className="text-sm font-bold text-slate-900">{item.quantity} <span className="font-normal text-slate-400">{unitLabel(dict, item.unit)}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

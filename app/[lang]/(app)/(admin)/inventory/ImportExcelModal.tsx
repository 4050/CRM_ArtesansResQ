'use client'

import { useState } from 'react'
import { Loader2, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { unitLabel, categoryLabel } from '@/lib/consumable-labels'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import type { Consumable } from '@/types'
import { parseInventoryExcelAction, confirmInventoryImportAction, type ImportPreview } from './importActions'

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024 // 10MB - see next.config.ts's serverActions.bodySizeLimit

interface Props {
  lang: Locale
  dict: Dictionary
  onClose: () => void
  onImported: (created: Consumable[], restocked: Consumable[]) => void
}

export default function ImportExcelModal({ lang, dict, onClose, onImported }: Props) {
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [parsing, setParsing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Kept in sync by hand with next.config.ts's serverActions.bodySizeLimit
    // - rejecting oversized files here avoids an upload that would only
    // fail with an opaque body-size error once it reaches the server.
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      e.target.value = ''
      setError(dict.inventory.importFileTooLarge)
      return
    }

    setParsing(true)
    setError('')
    setPreview(null)

    const formData = new FormData()
    formData.append('file', file)
    const result = await parseInventoryExcelAction(formData)

    if (result.error) {
      setError(result.error)
      setParsing(false)
      return
    }

    setPreview(result.data ?? null)
    setParsing(false)
  }

  async function handleConfirm() {
    if (!preview) return
    setConfirming(true)
    setError('')

    const result = await confirmInventoryImportAction(lang, {
      toCreate: preview.toCreate,
      toRestock: preview.toRestock.map(r => ({ consumableId: r.consumableId, quantity: r.row.quantity })),
    })

    if (result.error) {
      // Some rows may have already gone through before the failure (e.g. the
      // restock loop errors partway). Drop those from the preview so a retry
      // only resends what's still pending, instead of re-creating consumables
      // or double-counting a restock quantity already applied.
      const createdCodes = new Set(result.created.map(c => c.code))
      const restockedIds = new Set(result.restocked.map(c => c.id))
      setPreview(prev => prev && {
        ...prev,
        toCreate: prev.toCreate.filter(r => !createdCodes.has(r.code)),
        toRestock: prev.toRestock.filter(r => !restockedIds.has(r.consumableId)),
      })
      setError(result.error)
      setConfirming(false)
      if (result.created.length || result.restocked.length) onImported(result.created, result.restocked)
      return
    }

    onImported(result.created, result.restocked)
    setConfirming(false)
    onClose()
  }

  const busy = parsing || confirming
  const hasActionableRows = !!preview && (preview.toCreate.length > 0 || preview.toRestock.length > 0)

  return (
    <Modal
      title={dict.inventory.importTitle}
      onClose={onClose}
      closeDisabled={busy}
      maxWidth="max-w-2xl"
      footer={<>
        <button
          onClick={onClose}
          disabled={busy}
          className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors"
        >
          {dict.inventory.cancel}
        </button>
        {preview && (
          <button
            onClick={handleConfirm}
            disabled={busy || !hasActionableRows}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {confirming && <Loader2 className="w-4 h-4 animate-spin" />}
            {dict.inventory.importConfirm}
          </button>
        )}
      </>}
    >
      {!preview && (
        <div>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-10 cursor-pointer hover:border-red-400 hover:bg-red-50/30 transition-colors">
            {parsing ? <Loader2 className="w-6 h-6 text-slate-400 animate-spin" /> : <Upload className="w-6 h-6 text-slate-400" />}
            <span className="text-sm text-slate-500">{parsing ? dict.inventory.importParsing : dict.inventory.importPickFile}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={parsing}
              className="hidden"
            />
          </label>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          {preview.toCreate.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                {dict.inventory.importToCreate} ({preview.toCreate.length})
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2">{dict.inventory.code}</th>
                      <th className="text-left px-3 py-2">{dict.inventory.name}</th>
                      <th className="text-left px-3 py-2">{dict.inventory.category}</th>
                      <th className="text-right px-3 py-2">{dict.inventory.openingStock}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.toCreate.map(row => (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-1.5 font-mono text-xs text-slate-500">{row.code}</td>
                        <td className="px-3 py-1.5 text-slate-900">{row.name}</td>
                        <td className="px-3 py-1.5 text-slate-500">{categoryLabel(dict, row.category)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-green-600">+{row.quantity} {unitLabel(dict, row.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.toRestock.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                {dict.inventory.importToRestock} ({preview.toRestock.length})
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2">{dict.inventory.name}</th>
                      <th className="text-right px-3 py-2">{dict.inventory.importCurrentQty}</th>
                      <th className="text-right px-3 py-2">{dict.inventory.willBecome}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.toRestock.map(r => (
                      <tr key={r.row.rowNumber}>
                        <td className="px-3 py-1.5 text-slate-900">{r.existingName}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{r.currentQty}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-blue-600">{r.currentQty + r.row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {dict.inventory.importErrors} ({preview.errors.length})
              </h3>
              <div className="border border-amber-200 bg-amber-50 rounded-lg divide-y divide-amber-100">
                {preview.errors.map(e => (
                  <div key={e.rowNumber} className="px-3 py-1.5 text-sm text-amber-800">
                    {dict.inventory.importRow} {e.rowNumber}: {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasActionableRows && preview.errors.length === 0 && (
            <div className="text-sm text-slate-400 text-center py-4">{dict.inventory.importNoValidRows}</div>
          )}

          {hasActionableRows && (
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              {dict.inventory.importSummary
                .replace('{create}', String(preview.toCreate.length))
                .replace('{restock}', String(preview.toRestock.length))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {dict.inventory.error}: {error}
        </div>
      )}
    </Modal>
  )
}

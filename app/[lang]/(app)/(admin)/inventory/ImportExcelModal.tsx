'use client'

import { useState } from 'react'
import { Loader2, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { unitLabel, categoryLabel, CONSUMABLE_CATEGORIES } from '@/lib/consumable-labels'
import { clampQuantityInput } from '@/lib/input-utils'
import type { Dictionary, Locale } from '@/app/[lang]/dictionaries'
import type { Consumable } from '@/types'
import { parseInventoryExcelAction, confirmInventoryImportAction, type ImportPreview, type ImportRow } from './importActions'

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

    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await parseInventoryExcelAction(lang, formData)

      if (result.error) {
        setError(result.error)
        return
      }

      setPreview(result.data ?? null)
    } catch {
      // A thrown network/server error (not a { error } result) used to
      // leave `parsing` stuck true forever, permanently disabling the
      // modal's close button - see closeDisabled below.
      setError('Something went wrong — check your connection and try again')
    } finally {
      setParsing(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    setConfirming(true)
    setError('')

    try {
      // confirmInventoryImportAction applies the whole batch as a single
      // transaction now (see confirm_inventory_import) - either every row
      // succeeds or none do, so there's no partial result to reconcile the
      // preview against on failure the way there used to be.
      const result = await confirmInventoryImportAction(lang, {
        toCreate: preview.toCreate,
        toRestock: preview.toRestock.map(r => ({ consumableId: r.consumableId, quantity: r.row.quantity })),
      })

      if (result.error) {
        setError(result.error)
        return
      }

      onImported(result.created, result.restocked)
      onClose()
    } catch {
      setError('Something went wrong — check your connection and try again')
    } finally {
      setConfirming(false)
    }
  }

  const busy = parsing || confirming
  const hasActionableRows = !!preview && (preview.toCreate.length > 0 || preview.toRestock.length > 0)

  // Confirming re-validates every field server-side regardless (see
  // confirm_inventory_import) - editing here just lets an admin fix an
  // obvious parse mistake (a typo'd code, a category the sheet didn't
  // set) without having to fix the spreadsheet and re-upload.
  function updateCreateRow(rowNumber: number, patch: Partial<ImportRow>) {
    setPreview(prev => prev && { ...prev, toCreate: prev.toCreate.map(r => r.rowNumber === rowNumber ? { ...r, ...patch } : r) })
  }

  function updateRestockQuantity(rowNumber: number, quantity: number) {
    setPreview(prev => prev && {
      ...prev,
      toRestock: prev.toRestock.map(r => r.row.rowNumber === rowNumber ? { ...r, row: { ...r.row, quantity } } : r),
    })
  }

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
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
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
                        <td className="px-1 py-1">
                          <input
                            value={row.code}
                            onChange={e => updateCreateRow(row.rowNumber, { code: e.target.value })}
                            disabled={busy}
                            className="w-24 px-2 py-1 font-mono text-xs text-slate-700 border border-transparent rounded hover:border-slate-200 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50 bg-transparent"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={row.name}
                            onChange={e => updateCreateRow(row.rowNumber, { name: e.target.value })}
                            disabled={busy}
                            className="w-full min-w-[120px] px-2 py-1 text-sm text-slate-900 border border-transparent rounded hover:border-slate-200 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50 bg-transparent"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <select
                            value={row.category}
                            onChange={e => updateCreateRow(row.rowNumber, { category: e.target.value })}
                            disabled={busy}
                            className="px-2 py-1 text-sm text-slate-500 border border-transparent rounded hover:border-slate-200 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50 bg-transparent"
                          >
                            {!CONSUMABLE_CATEGORIES.some(c => c === row.category) && (
                              <option value={row.category}>{categoryLabel(dict, row.category)}</option>
                            )}
                            {CONSUMABLE_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(dict, c)}</option>)}
                          </select>
                        </td>
                        <td className="px-1 py-1 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-green-600 font-semibold">+</span>
                            <input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={e => updateCreateRow(row.rowNumber, { quantity: clampQuantityInput(e.target.value) })}
                              disabled={busy}
                              className="w-16 px-2 py-1 text-sm text-right font-semibold text-green-600 border border-transparent rounded hover:border-slate-200 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50 bg-transparent"
                            />
                            <span className="text-slate-400 text-xs shrink-0">{unitLabel(dict, row.unit)}</span>
                          </div>
                        </td>
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
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2">{dict.inventory.name}</th>
                      <th className="text-right px-3 py-2">{dict.inventory.importCurrentQty}</th>
                      <th className="text-right px-3 py-2">{dict.inventory.importAddQty}</th>
                      <th className="text-right px-3 py-2">{dict.inventory.willBecome}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.toRestock.map(r => (
                      <tr key={r.row.rowNumber}>
                        <td className="px-3 py-1.5 text-slate-900">{r.existingName}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{r.currentQty}</td>
                        <td className="px-1 py-1 text-right">
                          <input
                            type="number"
                            min="1"
                            value={r.row.quantity}
                            onChange={e => updateRestockQuantity(r.row.rowNumber, clampQuantityInput(e.target.value))}
                            disabled={busy}
                            className="w-16 px-2 py-1 text-sm text-right font-semibold text-slate-700 border border-transparent rounded hover:border-slate-200 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50 bg-transparent"
                          />
                        </td>
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

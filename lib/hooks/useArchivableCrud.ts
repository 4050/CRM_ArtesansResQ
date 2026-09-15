'use client'

import { useState } from 'react'

interface ArchivableEntity {
  id: string
  number: string
  is_active: boolean
}

type ActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string }

export type CrudModal = 'add' | 'edit' | 'deactivate' | 'delete' | null

interface CrudActions<T extends ArchivableEntity, CreateInput, UpdateInput> {
  create(input: CreateInput): Promise<ActionResult<T>>
  update(id: string, input: UpdateInput): Promise<ActionResult<T>>
  archive(id: string): Promise<{ error?: string }>
  remove(id: string): Promise<{ error?: string }>
}

interface CrudConfig<T extends ArchivableEntity, Form, CreateInput, UpdateInput> {
  actions: CrudActions<T, CreateInput, UpdateInput>
  emptyForm: Form
  toForm(item: T): Form
  toCreateInput(form: Form): CreateInput
  toUpdateInput(form: Form): UpdateInput
}

// The open/save/deactivate/delete state machine shared by every "list of
// archivable, number-keyed entities with add/edit/deactivate/delete"
// admin screen (vehicles, bags in VehiclesClient.tsx) - previously
// duplicated once per entity almost line-for-line.
export function useArchivableCrud<T extends ArchivableEntity, Form, CreateInput, UpdateInput>(
  initialItems: T[],
  config: CrudConfig<T, Form, CreateInput, UpdateInput>,
) {
  const [items, setItems] = useState(initialItems)
  const [modal, setModal] = useState<CrudModal>(null)
  const [target, setTarget] = useState<T | null>(null)
  const [form, setForm] = useState<Form>(config.emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function close() {
    setModal(null)
    setTarget(null)
    setError('')
  }

  function openAdd() {
    setForm(config.emptyForm)
    setModal('add')
  }

  function openEdit(item: T) {
    setTarget(item)
    setForm(config.toForm(item))
    setModal('edit')
  }

  function openDeactivate(item: T) {
    setTarget(item)
    setModal('deactivate')
  }

  function openDelete(item: T) {
    setTarget(item)
    setModal('delete')
  }

  async function save() {
    setSaving(true)
    setError('')

    const result = modal === 'edit' && target
      ? await config.actions.update(target.id, config.toUpdateInput(form))
      : await config.actions.create(config.toCreateInput(form))

    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    // TS can't narrow ActionResult<T>'s two branches by result.error alone
    // when T is a generic type parameter rather than a concrete type - this
    // check is the type guard the discriminated union itself can't give it.
    const saved = result.data
    if (saved) {
      setItems(prev =>
        modal === 'edit'
          ? prev.map(item => (item.id === saved.id ? saved : item))
          : [...prev, saved].sort((a, b) => a.number.localeCompare(b.number)),
      )
    }
    setSaving(false)
    close()
  }

  async function confirmDeactivate() {
    if (!target) return
    setSaving(true)
    setError('')

    const { error } = await config.actions.archive(target.id)
    if (error) {
      setError(error)
      setSaving(false)
      return
    }

    const deactivatedId = target.id
    setItems(prev => prev.map(item => (item.id === deactivatedId ? { ...item, is_active: false } : item)))
    setSaving(false)
    close()
  }

  async function confirmDelete() {
    if (!target) return
    setSaving(true)
    setError('')

    const { error } = await config.actions.remove(target.id)
    if (error) {
      setError(error)
      setSaving(false)
      return
    }

    const deletedId = target.id
    setItems(prev => prev.filter(item => item.id !== deletedId))
    setSaving(false)
    close()
  }

  return {
    items,
    modal,
    target,
    form,
    setForm,
    saving,
    error,
    openAdd,
    openEdit,
    openDeactivate,
    openDelete,
    close,
    save,
    confirmDeactivate,
    confirmDelete,
  }
}

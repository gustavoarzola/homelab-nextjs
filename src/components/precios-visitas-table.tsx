'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Pencil, ToggleLeft, ToggleRight, X } from 'lucide-react'
import type { PrecioVisitaRow } from '@/lib/actions/precios'
import type { SearchParams } from '@/components/data-table'
import { SelectCombobox } from '@/components/select-combobox'
import { COMUNAS_OPTIONS } from '@/lib/comunas'

type Props = {
  initialRows: PrecioVisitaRow[]
  onCreate: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  onUpdate: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  onToggle: (id: number, activo: boolean) => Promise<{ success: boolean; error?: string }>
  search: (params: SearchParams) => Promise<{ rows: PrecioVisitaRow[]; total: number }>
}

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; row: PrecioVisitaRow }
  | { type: 'confirmToggle'; id: number; activo: boolean }

const inputClass = 'rounded-lg px-3 py-2 text-sm outline-none'
const inputStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--input)',
  color: 'var(--foreground)',
}

function PrecioVisitaForm({
  row,
  onDone,
}: {
  row?: PrecioVisitaRow
  onDone: (fd: FormData) => Promise<{ success: boolean; error?: string }>
}) {
  const comunaToIdx = (c: string | null | undefined) =>
    c ? COMUNAS_OPTIONS.findIndex((o) => o.label === c) : null

  const [selectedComuna, setSelectedComuna] = useState<number | null>(comunaToIdx(row?.comuna))
  const [isBasePrice, setIsBasePrice] = useState(row?.comuna === null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('comuna', !isBasePrice && selectedComuna !== null ? (COMUNAS_OPTIONS[selectedComuna]?.label ?? '') : '')
    if (row) fd.set('id', String(row.id))
    setError(null)
    startTransition(async () => {
      const result = await onDone(fd)
      if (!result.success && result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ backgroundColor: 'oklch(0.6 0.2 29 / 10%)', color: 'var(--destructive)', border: '1px solid var(--destructive)' }}
        >
          {error}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Comuna</label>
        <SelectCombobox
          mode="single"
          options={COMUNAS_OPTIONS}
          selected={selectedComuna}
          onChange={setSelectedComuna}
          placeholder="Buscar comuna…"
          disabled={isPending || isBasePrice}
        />
      </div>
      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
        <input
          type="checkbox"
          checked={isBasePrice}
          onChange={(e) => {
            setIsBasePrice(e.target.checked)
            if (e.target.checked) setSelectedComuna(null)
          }}
          disabled={isPending}
        />
        Precio base sin comuna
      </label>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Precio ($)</label>
        <input
          name="precio"
          type="number"
          min="0"
          required
          defaultValue={row?.precio ?? ''}
          disabled={isPending}
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {row ? 'Guardar' : 'Crear'}
        </button>
      </div>
    </form>
  )
}

export function PreciosVisitasTable({ initialRows, onCreate, onUpdate, onToggle, search }: Props) {
  const [rows, setRows] = useState(initialRows)
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [filterBuscar, setFilterBuscar] = useState('')
  const [isPending, startTransition] = useTransition()

  const applyFilters = () => {
    startTransition(async () => {
      const data = await search({
        filters: { buscar: filterBuscar },
        sort: null,
        page: 1,
        pageSize: 100,
      } as SearchParams)
      setRows(data.rows)
    })
  }

  const handleCreate = async (fd: FormData) => {
    const res = await onCreate(fd)
    if (res.success) {
      setModal({ type: 'none' })
      applyFilters()
    }
    return res
  }

  const handleUpdate = async (fd: FormData) => {
    const res = await onUpdate(fd)
    if (res.success) {
      setModal({ type: 'none' })
      applyFilters()
    }
    return res
  }

  const handleToggle = (id: number, activo: boolean) => {
    startTransition(async () => {
      await onToggle(id, activo)
      applyFilters()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div
        className="flex flex-wrap items-end gap-3 rounded-xl border p-4"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Buscar comuna</label>
          <input
            type="text"
            value={filterBuscar}
            placeholder="Nombre de comuna…"
            onChange={(e) => setFilterBuscar(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="rounded-lg px-3 py-2 text-sm outline-none w-52"
            style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
          />
        </div>

        <button
          onClick={applyFilters}
          disabled={isPending}
          className="rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50 hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          Aplicar
        </button>

        <button
          onClick={() => {
            setFilterBuscar('')
            startTransition(async () => {
              const data = await search({ filters: {}, sort: null, page: 1, pageSize: 100 } as SearchParams)
              setRows(data.rows)
            })
          }}
          disabled={isPending}
          className="rounded-lg px-4 py-1.5 text-sm disabled:opacity-50 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Limpiar
        </button>

        <button
          onClick={() => setModal({ type: 'create' })}
          disabled={isPending}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo precio
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              <th className="px-4 py-3 text-left font-medium">Comuna</th>
              <th className="px-4 py-3 text-right font-medium">Precio</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  No hay precios configurados.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>
                  {row.comuna ?? 'Precio base'}
                </td>
                <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--foreground)' }}>
                  ${row.precio.toLocaleString('es-CL')}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={
                      row.activo
                        ? { backgroundColor: 'oklch(0.6 0.118 184.704 / 12%)', color: 'oklch(0.45 0.118 184.704)' }
                        : { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
                    }
                  >
                    {row.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setModal({ type: 'edit', row })}
                      disabled={isPending}
                      className="rounded p-1 transition-opacity hover:opacity-70"
                      style={{ color: 'var(--muted-foreground)' }}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setModal({ type: 'confirmToggle', id: row.id, activo: row.activo })}
                      disabled={isPending}
                      className="rounded p-1 transition-opacity hover:opacity-70"
                      style={{ color: 'var(--muted-foreground)' }}
                      title={row.activo ? 'Desactivar' : 'Activar'}
                    >
                      {row.activo ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.type !== 'none' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'oklch(0 0 0 / 35%)', backdropFilter: 'blur(4px)' }}
        >
          {modal.type === 'confirmToggle' && (
            <div
              className="w-full max-w-sm rounded-xl border p-6 shadow-xl"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h2 className="mb-2 text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                {modal.activo ? '¿Desactivar precio?' : '¿Activar precio?'}
              </h2>
              <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {modal.activo
                  ? 'El precio quedará inactivo y no aparecerá en los listados principales.'
                  : 'El precio volverá a estar disponible.'}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setModal({ type: 'none' })}
                  disabled={isPending}
                  className="rounded-lg px-4 py-2 text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    handleToggle(modal.id, modal.activo)
                    setModal({ type: 'none' })
                  }}
                  disabled={isPending}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={modal.activo
                    ? { backgroundColor: 'var(--destructive)', color: 'white' }
                    : { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {modal.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          )}

          {(modal.type === 'create' || modal.type === 'edit') && (
            <div
              className="w-full max-w-md rounded-xl border shadow-xl"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                  {modal.type === 'create' ? 'Nuevo precio de visita' : 'Editar precio de visita'}
                </h2>
                <button
                  onClick={() => setModal({ type: 'none' })}
                  disabled={isPending}
                  className="rounded p-1 hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <PrecioVisitaForm
                  row={modal.type === 'edit' ? modal.row : undefined}
                  onDone={modal.type === 'edit' ? handleUpdate : handleCreate}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

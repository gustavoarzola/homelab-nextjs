'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import type { PrecioExamenRow } from '@/lib/actions/precios'
import type { SearchParams } from '@/components/data-table'
import { SelectCombobox } from '@/components/select-combobox'

type Props = {
  initialRows: PrecioExamenRow[]
  examenes: { id: number; label: string }[]
  onCreate: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  onUpdate: (fd: FormData) => Promise<{ success: boolean; error?: string }>
  onToggle: (id: number, activo: boolean) => Promise<{ success: boolean; error?: string }>
  search: (params: SearchParams) => Promise<{ rows: PrecioExamenRow[]; total: number }>
}

const TIPO_PREVISION_LABELS: Record<string, string> = {
  fonasa: 'Fonasa',
  isapre: 'Isapre',
  particular: 'Particular',
}

const TIPO_OPTIONS = [
  { id: 0, label: 'Fonasa' },
  { id: 1, label: 'Isapre' },
  { id: 2, label: 'Particular' },
]

const tipoPrevisionFromId = (id: number | null) =>
  id === 0 ? 'fonasa' : id === 1 ? 'isapre' : id === 2 ? 'particular' : ''

const tipoPrevisionToId = (v: string) =>
  v === 'fonasa' ? 0 : v === 'isapre' ? 1 : v === 'particular' ? 2 : null

const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none'
const inputStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--input)',
  color: 'var(--foreground)',
}

function PrecioExamenForm({
  examenes,
  row,
  onDone,
}: {
  examenes: { id: number; label: string }[]
  row?: PrecioExamenRow
  onDone: (fd: FormData) => Promise<void>
}) {
  const [selectedExamen, setSelectedExamen] = useState<number | null>(row?.idExamen ?? null)
  const [selectedTipo, setSelectedTipo] = useState<number | null>(
    row ? tipoPrevisionToId(row.tipoPrevision) : null,
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('idExamen', String(selectedExamen ?? ''))
    fd.set('tipoPrevision', tipoPrevisionFromId(selectedTipo))
    if (row) fd.set('id', String(row.id))
    setError(null)
    startTransition(async () => {
      await onDone(fd)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      {error && <p className="w-full text-xs" style={{ color: 'var(--destructive)' }}>{error}</p>}
      <div className="min-w-48 flex-1">
        <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--foreground)' }}>Examen</label>
        <SelectCombobox
          mode="single"
          options={examenes}
          selected={selectedExamen}
          onChange={setSelectedExamen}
          placeholder="Buscar examen…"
          disabled={isPending || !!row}
        />
      </div>
      <div className="w-36">
        <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--foreground)' }}>Previsión</label>
        <SelectCombobox
          mode="single"
          options={TIPO_OPTIONS}
          selected={selectedTipo}
          onChange={setSelectedTipo}
          placeholder="Tipo…"
          disabled={isPending}
        />
      </div>
      <div className="w-44">
        <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--foreground)' }}>Comuna (opcional)</label>
        <input name="comuna" type="text" defaultValue={row?.comuna ?? ''} disabled={isPending} className={inputClass} style={inputStyle} placeholder="ej: Providencia" />
      </div>
      <div className="w-32">
        <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--foreground)' }}>Precio ($)</label>
        <input name="precio" type="number" min="0" required defaultValue={row?.precio ?? ''} disabled={isPending} className={inputClass} style={inputStyle} />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {row ? 'Guardar' : 'Agregar'}
      </button>
    </form>
  )
}

export function PreciosExamenesTable({ initialRows, examenes, onCreate, onUpdate, onToggle, search }: Props) {
  const [rows, setRows] = useState(initialRows)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const reload = () => {
    startTransition(async () => {
      const data = await search({ filters: {}, sort: null, page: 1, pageSize: 100 } as SearchParams)
      setRows(data.rows)
    })
  }

  const handleCreate = async (fd: FormData) => {
    const res = await onCreate(fd)
    if (res.success) reload()
  }

  const handleUpdate = async (fd: FormData) => {
    const res = await onUpdate(fd)
    if (res.success) { setEditingId(null); reload() }
  }

  const handleToggle = (id: number, activo: boolean) => {
    startTransition(async () => {
      await onToggle(id, activo)
      reload()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* New row form */}
      <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          <Plus className="mr-1 inline h-3.5 w-3.5" />
          Nuevo precio de examen
        </p>
        <PrecioExamenForm examenes={examenes} onDone={handleCreate} />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              <th className="px-4 py-3 text-left font-medium">Examen</th>
              <th className="px-4 py-3 text-left font-medium">Previsión</th>
              <th className="px-4 py-3 text-left font-medium">Comuna</th>
              <th className="px-4 py-3 text-right font-medium">Precio</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  No hay precios configurados.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
                {editingId === row.id ? (
                  <td colSpan={6} className="px-4 py-3">
                    <PrecioExamenForm examenes={examenes} row={row} onDone={async (fd) => { await handleUpdate(fd) }} />
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>
                      {row.examenNombre}
                      <span className="ml-1 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        ({row.examenCodigo})
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                      {TIPO_PREVISION_LABELS[row.tipoPrevision] ?? row.tipoPrevision}
                    </td>
                    <td className="px-4 py-3" style={{ color: row.comuna ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                      {row.comuna ?? '— todas —'}
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
                          onClick={() => setEditingId(row.id)}
                          disabled={isPending}
                          className="rounded p-1 transition-opacity hover:opacity-70"
                          style={{ color: 'var(--muted-foreground)' }}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggle(row.id, row.activo)}
                          disabled={isPending}
                          className="rounded p-1 transition-opacity hover:opacity-70"
                          style={{ color: 'var(--muted-foreground)' }}
                          title={row.activo ? 'Desactivar' : 'Activar'}
                        >
                          {row.activo ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

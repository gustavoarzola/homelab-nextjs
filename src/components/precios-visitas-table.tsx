'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Pencil, ToggleLeft, ToggleRight, X, Check } from 'lucide-react'
import type { PrecioVisitaRow } from '@/lib/actions/precios'
import type { SearchParams } from '@/components/data-table'
import { SelectCombobox } from '@/components/select-combobox'
import { Button } from '@/components/ui/button'
import { StatusDot } from '@/components/ui/status-dot'
import { EmptyState } from '@/components/ui/empty-state'
import { Callout } from '@/components/ui/callout'

type ComunaOption = { id: number; nombre: string }

type Props = {
  initialRows: PrecioVisitaRow[]
  comunas: ComunaOption[]
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

function PrecioVisitaForm({
  row,
  comunas,
  onDone,
}: {
  row?: PrecioVisitaRow
  comunas: ComunaOption[]
  onDone: (fd: FormData) => Promise<{ success: boolean; error?: string }>
}) {
  const comunaOptions = comunas.map((c) => ({ id: c.id, label: c.nombre }))

  const [selectedIdComuna, setSelectedIdComuna] = useState<number | null>(row?.idComuna ?? null)
  const [isBasePrice, setIsBasePrice] = useState(row ? row.idComuna === null : false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('idComuna', !isBasePrice && selectedIdComuna !== null ? String(selectedIdComuna) : '')
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
      {error && <Callout tone="bad">{error}</Callout>}
      <div className="hl-fieldgroup">
        <label>Comuna</label>
        <SelectCombobox
          mode="single"
          options={comunaOptions}
          selected={selectedIdComuna}
          onChange={setSelectedIdComuna}
          placeholder="Buscar comuna…"
          disabled={isPending || isBasePrice}
        />
      </div>
      <label
        role="checkbox"
        aria-checked={isBasePrice}
        tabIndex={0}
        onClick={() => {
          const next = !isBasePrice
          setIsBasePrice(next)
          if (next) setSelectedIdComuna(null)
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            const next = !isBasePrice
            setIsBasePrice(next)
            if (next) setSelectedIdComuna(null)
          }
        }}
        className="flex cursor-pointer items-center gap-2 select-none"
        style={{ fontSize: 'var(--text-base)' }}
      >
        <span className="hl-checkbox" data-checked={isBasePrice ? '' : undefined}>
          {isBasePrice && <Check style={{ width: 12, height: 12 }} strokeWidth={3} />}
        </span>
        Precio base sin comuna
      </label>
      <div className="hl-fieldgroup">
        <label>Precio ($)</label>
        <div className="hl-input">
          <input
            name="precio"
            type="number"
            min="0"
            required
            defaultValue={row?.precio ?? ''}
            disabled={isPending}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {row ? 'Guardar' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}

export function PreciosVisitasTable({ initialRows, comunas, onCreate, onUpdate, onToggle, search }: Props) {
  const [rows, setRows] = useState(initialRows)
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [filterBuscar, setFilterBuscar] = useState('')
  const [filterMostrarInactivos, setFilterMostrarInactivos] = useState(false)
  const [isPending, startTransition] = useTransition()

  const applyFilters = (opts?: { buscar?: string; mostrarInactivos?: boolean }) => {
    const buscar = opts?.buscar ?? filterBuscar
    const mostrarInactivos = opts?.mostrarInactivos ?? filterMostrarInactivos
    startTransition(async () => {
      const data = await search({
        filters: { buscar, mostrarInactivos },
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
    <div>
      {/* Filters */}
      <div className="toolbar">
        <div className="toolbar__field">
          <label className="hl-label">Buscar comuna</label>
          <div className="hl-input" style={{ width: 208 }}>
            <input
              type="text"
              value={filterBuscar}
              placeholder="Nombre de comuna…"
              onChange={(e) => setFilterBuscar(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
          </div>
        </div>

        <label
          role="checkbox"
          aria-checked={filterMostrarInactivos}
          tabIndex={0}
          onClick={() => {
            const next = !filterMostrarInactivos
            setFilterMostrarInactivos(next)
            applyFilters({ mostrarInactivos: next })
          }}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              const next = !filterMostrarInactivos
              setFilterMostrarInactivos(next)
              applyFilters({ mostrarInactivos: next })
            }
          }}
          className="toolbar__check"
        >
          <span className="hl-checkbox" data-checked={filterMostrarInactivos ? '' : undefined}>
            {filterMostrarInactivos && <Check style={{ width: 12, height: 12 }} strokeWidth={3} />}
          </span>
          Mostrar inactivos
        </label>

        <Button onClick={() => applyFilters()} disabled={isPending}>
          Aplicar
        </Button>

        <Button
          variant="ghost"
          onClick={() => {
            setFilterBuscar('')
            setFilterMostrarInactivos(false)
            startTransition(async () => {
              const data = await search({ filters: { mostrarInactivos: false }, sort: null, page: 1, pageSize: 100 } as SearchParams)
              setRows(data.rows)
            })
          }}
          disabled={isPending}
        >
          Limpiar
        </Button>

        <Button className="ml-auto" onClick={() => setModal({ type: 'create' })} disabled={isPending}>
          <Plus />
          Nuevo precio
        </Button>
      </div>

      {/* Table */}
      <div className="hl-card hl-card--flush">
        <table className="hl-table">
          <thead>
            <tr>
              <th>Comuna</th>
              <th className="hl-num">Precio</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState title="No hay precios configurados." />
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 500 }}>{row.comuna ?? 'Precio base'}</td>
                <td className="hl-num hl-tnum">${row.precio.toLocaleString('es-CL')}</td>
                <td>
                  <StatusDot active={row.activo}>{row.activo ? 'Activo' : 'Inactivo'}</StatusDot>
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setModal({ type: 'edit', row })} disabled={isPending} title="Editar">
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setModal({ type: 'confirmToggle', id: row.id, activo: row.activo })}
                      disabled={isPending}
                      title={row.activo ? 'Desactivar' : 'Activar'}
                    >
                      {row.activo ? <ToggleRight /> : <ToggleLeft />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.type !== 'none' && (
        <div className="hl-backdrop">
          {modal.type === 'confirmToggle' && (
            <div className="hl-modal" style={{ maxWidth: 400 }}>
              <div className="hl-modal__body">
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>
                  {modal.activo ? '¿Desactivar precio?' : '¿Activar precio?'}
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
                  {modal.activo
                    ? 'El precio quedará inactivo y no aparecerá en los listados principales.'
                    : 'El precio volverá a estar disponible.'}
                </p>
              </div>
              <div className="hl-modal__foot">
                <Button variant="ghost" onClick={() => setModal({ type: 'none' })} disabled={isPending}>
                  Cancelar
                </Button>
                <Button
                  variant={modal.activo ? 'destructive' : 'default'}
                  onClick={() => {
                    handleToggle(modal.id, modal.activo)
                    setModal({ type: 'none' })
                  }}
                  disabled={isPending}
                >
                  {isPending && <Loader2 className="animate-spin" />}
                  {modal.activo ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </div>
          )}

          {(modal.type === 'create' || modal.type === 'edit') && (
            <div className="hl-modal" style={{ maxWidth: 420 }}>
              <div className="hl-modal__head">
                <h2>{modal.type === 'create' ? 'Nuevo precio de visita' : 'Editar precio de visita'}</h2>
                <button className="hl-modal__close" onClick={() => setModal({ type: 'none' })} disabled={isPending} aria-label="Cerrar">
                  <X />
                </button>
              </div>
              <div className="hl-modal__body">
                <PrecioVisitaForm
                  row={modal.type === 'edit' ? modal.row : undefined}
                  comunas={comunas}
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

'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  Plus, PowerOff, Power, Trash2, Pencil,
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, X, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SelectCombobox } from './select-combobox'
import { FormDatePicker } from './form-date-picker'

// ─── Public types ─────────────────────────────────────────────────────────────

export type { ColumnDef }   // consumers import ColumnDef from here

export type Result = { success: boolean; error?: string }

export type SearchParams = {
  filters: Record<string, string | boolean>
  sort: { key: string; dir: 'asc' | 'desc' } | null
  page: number
  pageSize: number
}

export type SelectOption = { value: string; label: string }

export type FilterDef = {
  key: string
  label: string
  type: 'text' | 'checkbox' | 'select' | 'select-single' | 'date' | 'date-range'
  placeholder?: string
  options?: SelectOption[]   // for type='select' or 'select-single'
  keyFrom?: string           // for type='date-range'
  keyTo?: string             // for type='date-range'
}

export type FormFieldDef = {
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'select' | 'select-single'
  required?: boolean
  placeholder?: string
  options?: SelectOption[]   // for type='select' or 'select-single'
}

// ─── Internal ─────────────────────────────────────────────────────────────────

const ACTIONS_COL = 'actions'

type ModalState<T> =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; row: T }
  | { type: 'confirmToggle'; id: number; activo: boolean }
  | { type: 'confirmDelete'; id: number }

type Props<T extends { id: number; activo?: boolean }> = {
  initialData: { rows: T[]; total: number }
  columns: ColumnDef<T>[]
  filters: FilterDef[]
  formFields: FormFieldDef[]
  search: (params: SearchParams) => Promise<{ rows: T[]; total: number }>
  onCreate?: (fd: FormData) => Promise<Result>
  onUpdate?: (fd: FormData) => Promise<Result>
  onToggle?: (id: number, activo: boolean) => Promise<Result>
  onDelete?: (id: number) => Promise<Result>
  entityLabel?: string
  createLabel?: string
  createHref?: string
  getEditHref?: (row: T) => string | null
  extraRowActions?: (row: T) => React.ReactNode
}

// ─── Helpers (module-level, pure) ─────────────────────────────────────────────

function initFilters(defs: FilterDef[]): Record<string, string | boolean> {
  const entries: [string, string | boolean][] = []
  for (const f of defs) {
    if (f.type === 'date-range') {
      entries.push([f.keyFrom!, ''], [f.keyTo!, ''])
    } else {
      entries.push([f.key, f.type === 'checkbox' ? false : ''])
    }
  }
  return Object.fromEntries(entries)
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (current > 3) pages.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

function toOurSort(s: SortingState): SearchParams['sort'] {
  return s[0] ? { key: s[0].id, dir: s[0].desc ? 'desc' : 'asc' } : null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T extends { id: number; activo?: boolean }>({
  initialData,
  columns,
  filters: filterDefs,
  formFields,
  search,
  onCreate,
  onUpdate,
  onToggle,
  onDelete,
  entityLabel = 'registro',
  createLabel,
  createHref,
  getEditHref,
  extraRowActions,
}: Props<T>) {
  const [data, setData] = useState(initialData)
  const [draft, setDraft] = useState(() => initFilters(filterDefs))
  const [applied, setApplied] = useState(() => initFilters(filterDefs))
  const [sorting, setSorting] = useState<SortingState>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modal, setModal] = useState<ModalState<T>>({ type: 'none' })
  const [formDraft, setFormDraft] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const totalPages = Math.ceil(data.total / pageSize)

  const gridTemplate = useMemo(() => {
    const dataColCount = columns.filter((c) => (c as { id?: string }).id !== ACTIONS_COL).length
    return `${Array(dataColCount).fill('1fr').join(' ')} auto`
  }, [columns])

  const hasActiveFilters = filterDefs.some((f) => {
    if (f.type === 'checkbox') return applied[f.key] === true
    if (f.type === 'date-range') return (applied[f.keyFrom!] as string) !== '' || (applied[f.keyTo!] as string) !== ''
    return (applied[f.key] as string) !== ''
  })

  // ── Search ─────────────────────────────────────────────────────────────────

  const runSearch = (params: SearchParams) => {
    startTransition(async () => {
      try {
        setData(await search(params))
      } catch {
        toast.error('Error al cargar los datos')
      }
    })
  }

  const handleApply = () => {
    setApplied(draft)
    setPage(1)
    runSearch({ filters: draft, sort: toOurSort(sorting), page: 1, pageSize })
  }

  const handleClear = () => {
    const empty = initFilters(filterDefs)
    setDraft(empty)
    setApplied(empty)
    setPage(1)
    runSearch({ filters: empty, sort: toOurSort(sorting), page: 1, pageSize })
  }

  const handleSortingChange = (updater: SortingState | ((prev: SortingState) => SortingState)) => {
    const newSorting = typeof updater === 'function' ? updater(sorting) : updater
    setSorting(newSorting)
    setPage(1)
    runSearch({ filters: applied, sort: toOurSort(newSorting), page: 1, pageSize })
  }

  const handlePage = (p: number) => {
    setPage(p)
    runSearch({ filters: applied, sort: toOurSort(sorting), page: p, pageSize })
  }

  const handlePageSize = (n: number) => {
    setPageSize(n)
    setPage(1)
    runSearch({ filters: applied, sort: toOurSort(sorting), page: 1, pageSize: n })
  }

  const refetch = (currentPage = page) =>
    runSearch({ filters: applied, sort: toOurSort(sorting), page: currentPage, pageSize })

  // ── Mutations ──────────────────────────────────────────────────────────────

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!onCreate) return
    startTransition(async () => {
      const r = await onCreate(new FormData(e.currentTarget))
      if (r.success) {
        toast.success(`${entityLabel} creado/a`)
        setModal({ type: 'none' })
        setPage(1)
        refetch(1)
      } else {
        toast.error(r.error ?? 'Error al crear')
      }
    })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>, id: number) => {
    e.preventDefault()
    if (!onUpdate) return
    const fd = new FormData(e.currentTarget)
    fd.set('id', String(id))
    startTransition(async () => {
      const r = await onUpdate(fd)
      if (r.success) {
        toast.success(`${entityLabel} actualizado/a`)
        setModal({ type: 'none' })
        refetch()
      } else {
        toast.error(r.error ?? 'Error al actualizar')
      }
    })
  }

  const handleToggle = (id: number, activo: boolean) => {
    startTransition(async () => {
      const r = await onToggle!(id, activo)
      if (r.success) refetch()
      else toast.error(r.error ?? 'Error al cambiar estado')
    })
  }

  const handleDelete = (id: number) => {
    startTransition(async () => {
      const r = await onDelete!(id)
      if (r.success) {
        toast.success(`${entityLabel} eliminado/a`)
        setModal({ type: 'none' })
        const newPage = data.rows.length === 1 && page > 1 ? page - 1 : page
        setPage(newPage)
        refetch(newPage)
      } else {
        toast.error(r.error ?? 'Error al eliminar')
        setModal({ type: 'none' })
      }
    })
  }

  // ── TanStack Table ─────────────────────────────────────────────────────────

  const table = useReactTable({
    data: data.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    state: {
      sorting,
      pagination: { pageIndex: page - 1, pageSize },
    },
    onSortingChange: handleSortingChange,
    onPaginationChange: () => {},   // handled manually
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Filters */}
      <div
        className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border p-4"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {filterDefs.map((f) => (
          <div key={f.type === 'date-range' ? `${f.keyFrom}-${f.keyTo}` : f.key} className="flex flex-col gap-1">
            {f.type === 'checkbox' ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm select-none" style={{ color: 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={draft[f.key] as boolean}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.checked }))}
                  className="h-4 w-4 cursor-pointer rounded"
                />
                {f.label}
              </label>
            ) : f.type === 'select' ? (
              <>
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{f.label}</label>
                <select
                  value={draft[f.key] as string}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="rounded-lg px-3 py-2 text-sm outline-none w-52"
                  style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
                >
                  {f.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </>
            ) : f.type === 'select-single' ? (() => {
              const opts = f.options ?? []
              const comboOptions = opts.map((opt, idx) => ({ id: idx, label: opt.label }))
              const selectedIdx = opts.findIndex((o) => o.value !== '' && o.value === (draft[f.key] as string))
              return (
                <>
                  <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{f.label}</label>
                  <div style={{ width: '208px' }}>
                    <SelectCombobox
                      mode="single"
                      options={comboOptions}
                      selected={selectedIdx >= 0 ? selectedIdx : null}
                      onChange={(idx) => setDraft((d) => ({ ...d, [f.key]: idx !== null ? (opts[idx]?.value ?? '') : '' }))}
                      placeholder={f.placeholder}
                    />
                  </div>
                </>
              )
            })() : f.type === 'date-range' ? (
              <>
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{f.label}</label>
                <div style={{ width: '292px' }}>
                  <FormDatePicker
                    mode="range"
                    value={{
                      from: ((draft[f.keyFrom!] as string) || undefined),
                      to: ((draft[f.keyTo!] as string) || undefined),
                    }}
                    onChange={(value) =>
                      setDraft((d) => ({
                        ...d,
                        [f.keyFrom!]: value?.from ?? '',
                        [f.keyTo!]: value?.to ?? '',
                      }))
                    }
                    weekStartsOn={1}
                    placeholder={f.label}
                  />
                </div>
              </>
            ) : f.type === 'date' ? (
              <>
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{f.label}</label>
                <div style={{ width: '208px' }}>
                  <FormDatePicker
                    mode="single"
                    value={((draft[f.key] as string) || undefined)}
                    onChange={(value) => setDraft((d) => ({ ...d, [f.key]: value ?? '' }))}
                    weekStartsOn={1}
                    placeholder={f.placeholder ?? f.label}
                  />
                </div>
              </>
            ) : (
              <>
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{f.label}</label>
                <input
                  type="text"
                  value={draft[f.key] as string}
                  placeholder={f.placeholder}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                  className="rounded-lg px-3 py-2 text-sm outline-none w-52"
                  style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
                />
              </>
            )}
          </div>
        ))}
        <button
          onClick={handleApply}
          disabled={isPending}
          className="rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50 hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          Aplicar
        </button>
        {hasActiveFilters && (
          <button
            onClick={handleClear}
            disabled={isPending}
            className="rounded-lg px-4 py-1.5 text-sm disabled:opacity-50 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {data.total} {data.total === 1 ? entityLabel : `${entityLabel}s`}
        </p>
        {createHref ? (
          <Link
            href={createHref}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Plus className="h-4 w-4" />
            {createLabel ?? `Nuevo/a ${entityLabel}`}
          </Link>
        ) : (
          <button
            onClick={() => {
              setFormDraft({})
              setModal({ type: 'create' })
            }}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:opacity-80 transition-opacity"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Plus className="h-4 w-4" />
            {createLabel ?? `Nuevo/a ${entityLabel}`}
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
          opacity: isPending ? 0.6 : 1,
          transition: 'opacity 150ms',
        }}
      >
        {/* Header */}
        {table.getHeaderGroups().map((hg) => {
          const visibleHeaders = hg.headers.filter((h) => h.id !== ACTIONS_COL)
          return (
            <div
              key={hg.id}
              className="grid border-b px-4 py-2 text-xs font-medium uppercase tracking-wide"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', gridTemplateColumns: gridTemplate }}
            >
              {visibleHeaders.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                return (
                  <div
                    key={header.id}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    className={cn('flex items-center gap-1 select-none', canSort && 'cursor-pointer hover:opacity-80')}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {canSort && (
                      sorted === 'asc' ? <ChevronUp className="h-3 w-3" />
                      : sorted === 'desc' ? <ChevronDown className="h-3 w-3" />
                      : <ChevronsUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </div>
                )
              })}
              {/* Actions column header placeholder */}
              <div />
            </div>
          )
        })}

        {/* Rows */}
        {table.getRowModel().rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Sin resultados.
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const dataCells = row.getVisibleCells().filter((c) => c.column.id !== ACTIONS_COL)
            return (
              <div
                key={row.id}
                className={cn('grid items-center border-b px-4 py-3 last:border-0', row.original.activo === false && 'opacity-50')}
                style={{ borderColor: 'var(--border)', gridTemplateColumns: gridTemplate }}
              >
                {dataCells.map((cell) => (
                  <div key={cell.id} className="pr-4 text-sm" style={{ color: 'var(--foreground)' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}

                {/* Row actions */}
                <div className="flex items-center justify-end gap-1">
                  {extraRowActions?.(row.original)}
                  {(() => {
                    const editHref = getEditHref?.(row.original)
                    if (editHref) {
                      return (
                        <Link
                          href={editHref}
                          title="Editar"
                          className="rounded p-1.5 hover:opacity-80 transition-opacity"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      )
                    }
                    if (!getEditHref) {
                      return (
                        <button
                          onClick={() => {
                            const initialDraft: Record<string, string> = {}
                            formFields.forEach((f) => {
                              initialDraft[f.name] = String((row.original as Record<string, unknown>)[f.name] ?? '')
                            })
                            setFormDraft(initialDraft)
                            setModal({ type: 'edit', row: row.original })
                          }}
                          disabled={isPending}
                          title="Editar"
                          className="rounded p-1.5 hover:opacity-80 transition-opacity disabled:opacity-30"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )
                    }
                    return null
                  })()}

                  {onToggle && row.original.activo !== undefined && (
                    <button
                      onClick={() => setModal({ type: 'confirmToggle', id: row.original.id, activo: row.original.activo! })}
                      disabled={isPending}
                      title={row.original.activo ? 'Desactivar' : 'Activar'}
                      className="rounded p-1.5 hover:opacity-80 transition-opacity disabled:opacity-30"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {row.original.activo ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    </button>
                  )}

                  {onDelete && (
                    <button
                      onClick={() => setModal({ type: 'confirmDelete', id: row.original.id })}
                      disabled={isPending}
                      title="Eliminar"
                      className="rounded p-1.5 hover:opacity-80 transition-opacity disabled:opacity-30"
                      style={{ color: 'var(--destructive)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          <span>Mostrar</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSize(Number(e.target.value))}
            disabled={isPending}
            className="rounded-md px-2 py-1 text-sm outline-none disabled:opacity-50"
            style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
          >
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>por página</span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePage(page - 1)}
              disabled={page <= 1 || isPending}
              className="cursor-pointer rounded p-1.5 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {getPageNumbers(page, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => handlePage(p)}
                  disabled={isPending}
                  className="h-8 w-8 cursor-pointer rounded text-sm font-medium transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                  style={p === page
                    ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
                    : { color: 'var(--foreground)' }
                  }
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => handlePage(page + 1)}
              disabled={page >= totalPages || isPending}
              className="cursor-pointer rounded p-1.5 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
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
                {modal.activo ? `¿Desactivar ${entityLabel}?` : `¿Activar ${entityLabel}?`}
              </h2>
              <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {modal.activo
                  ? `El ${entityLabel} quedará inactivo y no aparecerá en los listados principales.`
                  : `El ${entityLabel} volverá a estar disponible.`}
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
                  onClick={() => { handleToggle(modal.id, modal.activo); setModal({ type: 'none' }) }}
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

          {modal.type === 'confirmDelete' && (
            <div
              className="w-full max-w-sm rounded-xl border p-6 shadow-xl"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h2 className="mb-2 text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                ¿Eliminar {entityLabel}?
              </h2>
              <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Esta acción no se puede deshacer.
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
                  onClick={() => handleDelete(modal.id)}
                  disabled={isPending}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: 'var(--destructive)', color: 'white' }}
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Eliminar
                </button>
              </div>
            </div>
          )}

          {(modal.type === 'create' || modal.type === 'edit') && (
            <div
              className="w-full max-w-lg rounded-xl border shadow-xl"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                  {modal.type === 'create' ? (createLabel ?? `Nuevo/a ${entityLabel}`) : `Editar ${entityLabel}`}
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

              <form
                key={modal.type === 'edit' ? `edit-${modal.row.id}` : 'create'}
                onSubmit={(e) => modal.type === 'edit' ? handleUpdate(e, modal.row.id) : handleCreate(e)}
                className="flex flex-col gap-4 p-6"
              >
                {formFields.map((field) => {
                  const value = modal.type === 'edit'
                    ? ((modal.row as Record<string, unknown>)[field.name] ?? '')
                    : ''
                  return (
                    <div key={field.name} className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {field.label}
                        {field.required && <span className="ml-0.5" style={{ color: 'var(--destructive)' }}>*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          name={field.name}
                          required={field.required}
                          defaultValue={String(value)}
                          disabled={isPending}
                          className="rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50"
                          style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
                        >
                          {!field.required && <option value="">— Seleccionar —</option>}
                          {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      ) : field.type === 'select-single' ? (() => {
                        const opts = field.options ?? []
                        const selectedVal = formDraft[field.name] ?? String(value)
                        const comboOptions = opts.map((opt, idx) => ({ id: idx, label: opt.label }))
                        const selectedIdx = opts.findIndex((o) => o.value === selectedVal)
                        return (
                          <>
                            <input type="hidden" name={field.name} value={selectedVal} required={field.required} />
                            <SelectCombobox
                              mode="single"
                              options={comboOptions}
                              selected={selectedIdx >= 0 ? selectedIdx : null}
                              onChange={(idx) => setFormDraft((d) => ({ ...d, [field.name]: idx !== null ? (opts[idx]?.value ?? '') : '' }))}
                              placeholder={field.placeholder}
                              disabled={isPending}
                            />
                          </>
                        )
                      })() : (
                        <input
                          name={field.name}
                          type={field.type ?? 'text'}
                          required={field.required}
                          placeholder={field.placeholder}
                          defaultValue={String(value)}
                          disabled={isPending}
                          className="rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50"
                          style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
                        />
                      )}
                    </div>
                  )
                })}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    disabled={isPending}
                    className="rounded-lg px-4 py-2 text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {modal.type === 'create' ? 'Crear' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

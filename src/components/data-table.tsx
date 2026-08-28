'use client'

import { useState, useTransition } from 'react'
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
  ChevronLeft, ChevronRight, X, Loader2, Download, Check, Inbox,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SelectCombobox } from './select-combobox'
import { FormDatePicker } from './form-date-picker'
import { Button } from './ui/button'

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
  exportHref?: string   // Si se pasa, se muestra un botón "Descargar Excel" que apunta a este endpoint con los filtros aplicados como query string
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

function buildExportQuery(
  filters: Record<string, string | boolean>,
  sort: SearchParams['sort'],
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'boolean') {
      if (value) params.set(key, 'true')
    } else if (value !== '') {
      params.set(key, value)
    }
  }
  if (sort) {
    params.set('sortKey', sort.key)
    params.set('sortDir', sort.dir)
  }
  return params.toString()
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
  exportHref,
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
    enableSortingRemoval: false,
    onSortingChange: handleSortingChange,
    onPaginationChange: () => {},   // handled manually
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Filters */}
      <div className="toolbar">
        {filterDefs.map((f) => (
          <div key={f.type === 'date-range' ? `${f.keyFrom}-${f.keyTo}` : f.key} className="flex flex-col gap-1">
            {f.type === 'checkbox' ? (
              <label
                role="checkbox"
                aria-checked={draft[f.key] as boolean}
                tabIndex={0}
                onClick={() => setDraft((d) => ({ ...d, [f.key]: !d[f.key] }))}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    setDraft((d) => ({ ...d, [f.key]: !d[f.key] }))
                  }
                }}
                className="flex cursor-pointer items-center gap-2 select-none"
                style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}
              >
                <span className="hl-checkbox" data-checked={draft[f.key] ? '' : undefined}>
                  {(draft[f.key] as boolean) && <Check style={{ width: 12, height: 12 }} strokeWidth={3} />}
                </span>
                {f.label}
              </label>
            ) : f.type === 'select' ? (
              <>
                <label className="hl-label">{f.label}</label>
                <div className="hl-input hl-input--select" style={{ width: '208px' }}>
                  <select
                    value={draft[f.key] as string}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="w-full appearance-none"
                  >
                    {f.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <ChevronDown className="hl-affix" />
                </div>
              </>
            ) : f.type === 'select-single' ? (() => {
              const opts = f.options ?? []
              const comboOptions = opts.map((opt, idx) => ({ id: idx, label: opt.label }))
              const selectedIdx = opts.findIndex((o) => o.value !== '' && o.value === (draft[f.key] as string))
              return (
                <>
                  <label className="hl-label">{f.label}</label>
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
                <label className="hl-label">{f.label}</label>
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
                <label className="hl-label">{f.label}</label>
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
                <label className="hl-label">{f.label}</label>
                <div className="hl-input" style={{ width: '208px' }}>
                  <input
                    type="text"
                    value={draft[f.key] as string}
                    placeholder={f.placeholder}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                  />
                </div>
              </>
            )}
          </div>
        ))}
        <Button onClick={handleApply} disabled={isPending}>Aplicar</Button>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={handleClear} disabled={isPending}>Limpiar</Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between">
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
          {data.total} {data.total === 1 ? entityLabel : `${entityLabel}s`}
        </p>
        <div className="flex items-center gap-2">
          {exportHref && (
            <Button variant="secondary" asChild>
              <a
                href={(() => {
                  const qs = buildExportQuery(applied, toOurSort(sorting))
                  return qs ? `${exportHref}?${qs}` : exportHref
                })()}
                title="Descargar Excel con los registros filtrados"
              >
                <Download />
                Descargar Excel
              </a>
            </Button>
          )}
          {createHref ? (
            <Button asChild>
              <Link href={createHref}>
                <Plus />
                {createLabel ?? `Nuevo/a ${entityLabel}`}
              </Link>
            </Button>
          ) : onCreate ? (
            <Button
              onClick={() => {
                setFormDraft({})
                setModal({ type: 'create' })
              }}
              disabled={isPending}
            >
              <Plus />
              {createLabel ?? `Nuevo/a ${entityLabel}`}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className="hl-card hl-card--flush" style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 150ms' }}>
        <table className="hl-table">
          <thead>
            {table.getHeaderGroups().map((hg) => {
              const visibleHeaders = hg.headers.filter((h) => h.id !== ACTIONS_COL)
              return (
                <tr key={hg.id}>
                  {visibleHeaders.map((header) => {
                    const canSort = header.column.getCanSort()
                    const sorted = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        className={cn('select-none whitespace-nowrap', canSort && 'cursor-pointer hover:opacity-80')}
                      >
                        <span className="flex items-center gap-1">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            sorted === 'asc' ? <ChevronUp className="h-3 w-3" />
                            : sorted === 'desc' ? <ChevronDown className="h-3 w-3" />
                            : <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </span>
                      </th>
                    )
                  })}
                  {/* Actions column placeholder */}
                  <th />
                </tr>
              )
            })}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="hl-empty">
                    <Inbox />
                    <p>Sin resultados.</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const dataCells = row.getVisibleCells().filter((c) => c.column.id !== ACTIONS_COL)
                return (
                  <tr key={row.id} className={cn(row.original.activo === false && 'opacity-50')}>
                    {dataCells.map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}

                    {/* Row actions */}
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {extraRowActions?.(row.original)}
                        {(() => {
                          const editHref = getEditHref?.(row.original)
                          if (editHref) {
                            return (
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={editHref} title="Editar">
                                  <Pencil />
                                </Link>
                              </Button>
                            )
                          }
                          if (!getEditHref && onUpdate) {
                            return (
                              <Button
                                variant="ghost"
                                size="icon"
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
                              >
                                <Pencil />
                              </Button>
                            )
                          }
                          return null
                        })()}

                        {onToggle && row.original.activo !== undefined && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setModal({ type: 'confirmToggle', id: row.original.id, activo: row.original.activo! })}
                            disabled={isPending}
                            title={row.original.activo ? 'Desactivar' : 'Activar'}
                          >
                            {row.original.activo ? <PowerOff /> : <Power />}
                          </Button>
                        )}

                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setModal({ type: 'confirmDelete', id: row.original.id })}
                            disabled={isPending}
                            title="Eliminar"
                            style={{ color: 'var(--color-destructive)' }}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="hl-pager">
          <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <div className="hl-input hl-input--select" style={{ width: 'auto', height: 30 }}>
              <select
                value={pageSize}
                onChange={(e) => handlePageSize(Number(e.target.value))}
                disabled={isPending}
                className="appearance-none disabled:opacity-50"
              >
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <span>por página</span>
          </div>

          {totalPages > 1 && (
            <div className="hl-pager__nums">
              <button
                aria-label="Anterior"
                onClick={() => handlePage(page - 1)}
                disabled={page <= 1 || isPending}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {getPageNumbers(page, totalPages).map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-1">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => handlePage(p)}
                    disabled={isPending}
                    aria-current={p === page ? 'true' : undefined}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                aria-label="Siguiente"
                onClick={() => handlePage(page + 1)}
                disabled={page >= totalPages || isPending}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal.type !== 'none' && (
        <div className="hl-backdrop">
          {modal.type === 'confirmToggle' && (
            <div className="hl-modal" style={{ maxWidth: 400 }}>
              <div className="hl-modal__body">
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>
                  {modal.activo ? `¿Desactivar ${entityLabel}?` : `¿Activar ${entityLabel}?`}
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
                  {modal.activo
                    ? `El ${entityLabel} quedará inactivo y no aparecerá en los listados principales.`
                    : `El ${entityLabel} volverá a estar disponible.`}
                </p>
              </div>
              <div className="hl-modal__foot">
                <Button variant="ghost" onClick={() => setModal({ type: 'none' })} disabled={isPending}>
                  Cancelar
                </Button>
                <Button
                  variant={modal.activo ? 'destructive' : 'default'}
                  onClick={() => { handleToggle(modal.id, modal.activo); setModal({ type: 'none' }) }}
                  disabled={isPending}
                >
                  {isPending && <Loader2 className="animate-spin" />}
                  {modal.activo ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </div>
          )}

          {modal.type === 'confirmDelete' && (
            <div className="hl-modal" style={{ maxWidth: 400 }}>
              <div className="hl-modal__body">
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>
                  ¿Eliminar {entityLabel}?
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="hl-modal__foot">
                <Button variant="ghost" onClick={() => setModal({ type: 'none' })} disabled={isPending}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(modal.id)} disabled={isPending}>
                  {isPending && <Loader2 className="animate-spin" />}
                  Eliminar
                </Button>
              </div>
            </div>
          )}

          {(modal.type === 'create' || modal.type === 'edit') && (
            <div className="hl-modal">
              <div className="hl-modal__head">
                <h2>{modal.type === 'create' ? (createLabel ?? `Nuevo/a ${entityLabel}`) : `Editar ${entityLabel}`}</h2>
                <button className="hl-modal__close" onClick={() => setModal({ type: 'none' })} disabled={isPending} aria-label="Cerrar">
                  <X />
                </button>
              </div>

              <form
                key={modal.type === 'edit' ? `edit-${modal.row.id}` : 'create'}
                onSubmit={(e) => modal.type === 'edit' ? handleUpdate(e, modal.row.id) : handleCreate(e)}
                className="flex flex-1 min-h-0 flex-col"
              >
              <div className="hl-modal__body">
                {formFields.map((field) => {
                  const value = modal.type === 'edit'
                    ? ((modal.row as Record<string, unknown>)[field.name] ?? '')
                    : ''
                  return (
                    <div key={field.name} className="hl-fieldgroup">
                      <label>
                        {field.label}
                        {field.required && <span className="req"> *</span>}
                      </label>
                      {field.type === 'select' ? (
                        <div className="hl-input hl-input--select">
                          <select
                            name={field.name}
                            required={field.required}
                            defaultValue={String(value)}
                            disabled={isPending}
                            className="w-full appearance-none disabled:opacity-50"
                          >
                            {!field.required && <option value="">— Seleccionar —</option>}
                            {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                          <ChevronDown className="hl-affix" />
                        </div>
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
                        <div className="hl-input">
                          <input
                            name={field.name}
                            type={field.type ?? 'text'}
                            required={field.required}
                            placeholder={field.placeholder}
                            defaultValue={String(value)}
                            disabled={isPending}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
                <div className="hl-modal__foot">
                  <Button type="button" variant="ghost" onClick={() => setModal({ type: 'none' })} disabled={isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="animate-spin" />}
                    {modal.type === 'create' ? 'Crear' : 'Guardar'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

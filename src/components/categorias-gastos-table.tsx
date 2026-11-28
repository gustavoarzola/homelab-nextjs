'use client'

import { useMemo } from 'react'
import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import { StatusDot } from './ui/status-dot'
import type { CategoriaGastoRow } from '@/lib/actions/catalogos'

type GrupoOption = { id: number; label: string; activo: boolean }

type Props = {
  initialData: { rows: CategoriaGastoRow[]; total: number }
  grupos: GrupoOption[]
  search: (params: SearchParams) => Promise<{ rows: CategoriaGastoRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

export function CategoriasGastosTable({ initialData, grupos, search, onCreate, onUpdate, onToggle }: Props) {
  const columns = useMemo<ColumnDef<CategoriaGastoRow>[]>(() => {
    const nombreGrupo = new Map(grupos.map((g) => [g.id, g.label]))
    return [
      { id: 'nombre', header: 'Categoría de gasto', enableSorting: true, cell: ({ row }) => <span>{row.original.nombre}</span> },
      { id: 'grupo', header: 'Grupo', cell: ({ row }) => <span>{nombreGrupo.get(row.original.idGrupo) ?? '—'}</span> },
      { id: 'orden', header: 'Orden', enableSorting: true, cell: ({ row }) => <span className="hl-tnum">{row.original.orden}</span> },
      {
        id: 'activo',
        header: 'Estado',
        cell: ({ row }) => (
          <StatusDot active={row.original.activo}>{row.original.activo ? 'Activo' : 'Inactivo'}</StatusDot>
        ),
      },
    ]
  }, [grupos])

  const grupoOptions = useMemo(() => grupos.map((g) => ({ value: String(g.id), label: g.label })), [grupos])

  const filters = useMemo<FilterDef[]>(() => [
    { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Categoría…' },
    { key: 'grupo', label: 'Grupo', type: 'select-single', options: [{ value: '', label: '— Todos —' }, ...grupoOptions] },
    { key: 'mostrarInactivos', label: 'Mostrar inactivos', type: 'checkbox' },
  ], [grupoOptions])

  const formFields = useMemo<FormFieldDef[]>(() => [
    { name: 'nombre', label: 'Categoría de gasto', required: true, placeholder: 'ej: Factura Imalab' },
    { name: 'idGrupo', label: 'Grupo', type: 'select-single', required: true, placeholder: 'Selecciona un grupo…', options: grupoOptions },
    { name: 'orden', label: 'Orden dentro del grupo', type: 'number', placeholder: '1' },
  ], [grupoOptions])

  return (
    <DataTable
      initialData={initialData}
      columns={columns}
      filters={filters}
      formFields={formFields}
      search={search}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onToggle={onToggle}
      entityLabel="categoría de gasto"
      createLabel="Nueva categoría"
    />
  )
}

'use client'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import { StatusDot } from './ui/status-dot'
import type { CategoriaCostoRow } from '@/lib/actions/catalogos'

type Props = {
  initialData: { rows: CategoriaCostoRow[]; total: number }
  search: (params: SearchParams) => Promise<{ rows: CategoriaCostoRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

const columns: ColumnDef<CategoriaCostoRow>[] = [
  {
    id: 'nombre',
    header: 'Categoría de costo',
    enableSorting: true,
    cell: ({ row }) => <span>{row.original.nombre}</span>,
  },
  {
    id: 'activo',
    header: 'Estado',
    cell: ({ row }) => (
      <StatusDot active={row.original.activo}>{row.original.activo ? 'Activo' : 'Inactivo'}</StatusDot>
    ),
  },
]

const filters: FilterDef[] = [
  { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Categoría…' },
  { key: 'mostrarInactivos', label: 'Mostrar inactivos', type: 'checkbox' },
]

const formFields: FormFieldDef[] = [
  { name: 'nombre', label: 'Categoría de costo', required: true, placeholder: 'ej: Laboratorio Imalab' },
]

export function CategoriasCostosTable({ initialData, search, onCreate, onUpdate, onToggle }: Props) {
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
      entityLabel="categoría de costo"
      createLabel="Nueva categoría"
    />
  )
}

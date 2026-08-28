'use client'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import { StatusDot } from './ui/status-dot'
import { Chip } from './ui/chip'
import type { ProcedimientoRow } from '@/lib/actions/catalogos'

type Props = {
  initialData: { rows: ProcedimientoRow[]; total: number }
  search: (params: SearchParams) => Promise<{ rows: ProcedimientoRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

const CATEGORIAS: Record<string, string> = {
  curaciones: 'Curaciones',
  otros: 'Otros procedimientos',
}

const columns: ColumnDef<ProcedimientoRow>[] = [
  {
    id: 'nombre',
    header: 'Nombre',
    enableSorting: true,
    cell: ({ row }) => <span>{row.original.nombre}</span>,
  },
  {
    id: 'codigo',
    header: 'Código',
    enableSorting: true,
    cell: ({ row }) => <Chip>{row.original.codigo}</Chip>,
  },
  {
    id: 'categoria',
    header: 'Categoría',
    cell: ({ row }) => (
      <span style={{ color: 'var(--color-fg-muted)' }}>
        {CATEGORIAS[row.original.categoria] ?? row.original.categoria}
      </span>
    ),
  },
  {
    id: 'precio',
    header: 'Precio',
    cell: ({ row }) => (
      <span className="hl-tnum block text-right">
        {row.original.precio > 0
          ? `$${row.original.precio.toLocaleString('es-CL')}`
          : <span style={{ color: 'var(--color-fg-muted)' }}>—</span>
        }
      </span>
    ),
  },
  {
    id: 'activo',
    header: 'Estado',
    cell: ({ row }) => (
      <StatusDot active={row.original.activo}>{row.original.activo ? 'Activo' : 'Inactivo'}</StatusDot>
    ),
  },
]

const CATEGORIA_FILTER_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'curaciones', label: 'Curaciones' },
  { value: 'otros', label: 'Otros procedimientos' },
]

const filters: FilterDef[] = [
  { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Nombre o código…' },
  { key: 'categoria', label: 'Categoría', type: 'select-single', options: CATEGORIA_FILTER_OPTIONS },
  { key: 'mostrarInactivos', label: 'Mostrar inactivos', type: 'checkbox' },
]

const CATEGORIA_OPTIONS = [
  { value: 'curaciones', label: 'Curaciones' },
  { value: 'otros', label: 'Otros procedimientos' },
]

const formFields: FormFieldDef[] = [
  { name: 'nombre', label: 'Nombre', required: true },
  { name: 'codigo', label: 'Código', required: true, placeholder: 'ej: PROC-001' },
  { name: 'categoria', label: 'Categoría', type: 'select-single', required: true, options: CATEGORIA_OPTIONS },
  { name: 'precio', label: 'Precio', type: 'number', placeholder: '0' },
]

export function ProcedimientosTable({ initialData, search, onCreate, onUpdate, onToggle }: Props) {
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
      entityLabel="procedimiento"
      createLabel="Nuevo procedimiento"
    />
  )
}

'use client'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import { StatusDot } from './ui/status-dot'
import type { TipoRecargoRow } from '@/lib/actions/catalogos'

type Props = {
  initialData: { rows: TipoRecargoRow[]; total: number }
  search: (params: SearchParams) => Promise<{ rows: TipoRecargoRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

const CLP = (n: number) => '$' + (n || 0).toLocaleString('es-CL')

const columns: ColumnDef<TipoRecargoRow>[] = [
  {
    id: 'nombre',
    header: 'Tipo de Recargo',
    enableSorting: true,
    cell: ({ row }) => <span>{row.original.nombre}</span>,
  },
  {
    id: 'precio',
    header: 'Precio',
    cell: ({ row }) => <span className="hl-tnum block text-right">{CLP(row.original.precio)}</span>,
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
  { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Tipo de recargo…' },
  { key: 'mostrarInactivos', label: 'Mostrar inactivos', type: 'checkbox' },
]

const formFields: FormFieldDef[] = [
  { name: 'nombre', label: 'Tipo de Recargo', required: true },
  { name: 'precio', label: 'Precio', type: 'number', required: true },
]

export function TiposRecargosTable({ initialData, search, onCreate, onUpdate, onToggle }: Props) {
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
      entityLabel="tipo de recargo"
      createLabel="Nuevo tipo de recargo"
    />
  )
}

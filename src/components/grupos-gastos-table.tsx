'use client'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import { StatusDot } from './ui/status-dot'
import type { GrupoGastoRow } from '@/lib/actions/catalogos'

type Props = {
  initialData: { rows: GrupoGastoRow[]; total: number }
  search: (params: SearchParams) => Promise<{ rows: GrupoGastoRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

const columns: ColumnDef<GrupoGastoRow>[] = [
  { id: 'orden', header: 'Orden', enableSorting: true, cell: ({ row }) => <span className="hl-tnum">{row.original.orden}</span> },
  { id: 'nombre', header: 'Grupo de gastos', enableSorting: true, cell: ({ row }) => <span>{row.original.nombre}</span> },
  {
    id: 'activo',
    header: 'Estado',
    cell: ({ row }) => (
      <StatusDot active={row.original.activo}>{row.original.activo ? 'Activo' : 'Inactivo'}</StatusDot>
    ),
  },
]

const filters: FilterDef[] = [
  { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Grupo…' },
  { key: 'mostrarInactivos', label: 'Mostrar inactivos', type: 'checkbox' },
]

const formFields: FormFieldDef[] = [
  { name: 'nombre', label: 'Grupo de gastos', required: true, placeholder: 'ej: Facturas laboratorio' },
  { name: 'orden', label: 'Orden en el reporte', type: 'number', placeholder: '1' },
]

export function GruposGastosTable({ initialData, search, onCreate, onUpdate, onToggle }: Props) {
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
      entityLabel="grupo de gastos"
      createLabel="Nuevo grupo"
    />
  )
}

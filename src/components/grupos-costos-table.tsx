'use client'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import { StatusDot } from './ui/status-dot'
import type { GrupoCostoRow } from '@/lib/actions/catalogos'

type Props = {
  initialData: { rows: GrupoCostoRow[]; total: number }
  search: (params: SearchParams) => Promise<{ rows: GrupoCostoRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

const columns: ColumnDef<GrupoCostoRow>[] = [
  { id: 'orden', header: 'Orden', enableSorting: true, cell: ({ row }) => <span className="hl-tnum">{row.original.orden}</span> },
  { id: 'nombre', header: 'Grupo de costos', enableSorting: true, cell: ({ row }) => <span>{row.original.nombre}</span> },
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
  { name: 'nombre', label: 'Grupo de costos', required: true, placeholder: 'ej: Facturas laboratorio' },
  { name: 'orden', label: 'Orden en el reporte', type: 'number', placeholder: '1' },
]

export function GruposCostosTable({ initialData, search, onCreate, onUpdate, onToggle }: Props) {
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
      entityLabel="grupo de costos"
      createLabel="Nuevo grupo"
    />
  )
}

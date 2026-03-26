'use client'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import type { SucursalRow, LaboratorioRow } from '@/lib/actions/laboratorios'

type Props = {
  initialData: { rows: SucursalRow[]; total: number }
  laboratorios: LaboratorioRow[]
  search: (params: SearchParams) => Promise<{ rows: SucursalRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

const columns: ColumnDef<SucursalRow>[] = [
  {
    id: 'nombre',
    header: 'Nombre',
    enableSorting: true,
    cell: ({ row }) => <span>{row.original.nombre}</span>,
  },
  {
    id: 'laboratorio',
    header: 'Laboratorio',
    enableSorting: true,
    cell: ({ row }) => (
      <span style={{ color: row.original.laboratorio ? 'inherit' : 'var(--muted-foreground)' }}>
        {row.original.laboratorio ?? '—'}
      </span>
    ),
  },
  {
    id: 'activo',
    header: 'Estado',
    cell: ({ row }) => (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={
          row.original.activo
            ? { backgroundColor: 'oklch(0.6 0.118 184.704 / 12%)', color: 'oklch(0.45 0.118 184.704)' }
            : { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
        }
      >
        {row.original.activo ? 'Activa' : 'Inactiva'}
      </span>
    ),
  },
]

export function SucursalesTable({ initialData, laboratorios, search, onCreate, onUpdate, onToggle }: Props) {
  const laboratorioOptions = laboratorios.map((c) => ({ value: String(c.id), label: c.nombre }))

  const filters: FilterDef[] = [
    { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Nombre…' },
    {
      key: 'idLaboratorio',
      label: 'Laboratorio',
      type: 'select-single',
      placeholder: 'Todos los laboratorios',
      options: [{ value: '', label: 'Todos los laboratorios' }, ...laboratorioOptions],
    },
    { key: 'mostrarInactivas', label: 'Mostrar inactivas', type: 'checkbox' },
  ]

  const formFields: FormFieldDef[] = [
    { name: 'nombre', label: 'Nombre', required: true },
    { name: 'idLaboratorio', label: 'Laboratorio', type: 'select-single', required: true, placeholder: 'Buscar laboratorio…', options: laboratorioOptions },
  ]

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
      entityLabel="sucursal"
      createLabel="Nueva sucursal"
    />
  )
}

'use client'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import type { NurseRow } from '@/lib/actions/enfermeras'

type Props = {
  initialData: { rows: NurseRow[]; total: number }
  search: (params: SearchParams) => Promise<{ rows: NurseRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
  onDelete: (id: number) => Promise<Result>
}

const columns: ColumnDef<NurseRow>[] = [
  {
    id: 'apellidoPaterno',
    header: 'Nombre',
    enableSorting: true,
    cell: ({ row }) => (
      <span>
        {row.original.apellidoPaterno}
        {row.original.apellidoMaterno ? ` ${row.original.apellidoMaterno}` : ''},{' '}
        {row.original.nombres}
      </span>
    ),
  },
  {
    id: 'rut',
    header: 'RUT',
    enableSorting: true,
    cell: ({ row }) => (
      <span style={{ color: row.original.rut ? 'inherit' : 'var(--muted-foreground)' }}>
        {row.original.rut ?? '—'}
      </span>
    ),
  },
  {
    id: 'telefono',
    header: 'Teléfono',
    cell: ({ row }) => (
      <span style={{ color: row.original.telefono ? 'inherit' : 'var(--muted-foreground)' }}>
        {row.original.telefono ?? '—'}
      </span>
    ),
  },
  {
    id: 'correo',
    header: 'Correo',
    enableSorting: true,
    cell: ({ row }) => (
      <span style={{ color: row.original.correo ? 'inherit' : 'var(--muted-foreground)' }}>
        {row.original.correo ?? '—'}
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

const filters: FilterDef[] = [
  { key: 'nombre', label: 'Buscar', type: 'text', placeholder: 'Nombre o apellido…' },
  { key: 'mostrarInactivas', label: 'Mostrar inactivas', type: 'checkbox' },
]

const formFields: FormFieldDef[] = [
  { name: 'nombres', label: 'Nombres', required: true },
  { name: 'apellidoPaterno', label: 'Apellido paterno', required: true },
  { name: 'apellidoMaterno', label: 'Apellido materno' },
  { name: 'rut', label: 'RUT', placeholder: '12.345.678-9' },
  { name: 'telefono', label: 'Teléfono', type: 'tel' },
  { name: 'correo', label: 'Correo electrónico', type: 'email' },
]

export function EnfermerasTable({ initialData, search, onCreate, onUpdate, onToggle, onDelete }: Props) {
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
      onDelete={onDelete}
      entityLabel="enfermera"
      createLabel="Nueva enfermera"
    />
  )
}

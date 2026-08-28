'use client'

import { useMemo } from 'react'
import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import { StatusDot } from './ui/status-dot'
import type { NurseRow } from '@/lib/actions/enfermeras'
import { formatRut } from '@/lib/rut'

type ComunaOption = { id: number; nombre: string }

type Props = {
  initialData: { rows: NurseRow[]; total: number }
  comunas: ComunaOption[]
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
      <span style={{ color: row.original.rut ? 'inherit' : 'var(--color-fg-muted)' }}>
        {row.original.rut ? formatRut(row.original.rut) : '—'}
      </span>
    ),
  },
  {
    id: 'telefono',
    header: 'Teléfono',
    cell: ({ row }) => (
      <span style={{ color: row.original.telefono ? 'inherit' : 'var(--color-fg-muted)' }}>
        {row.original.telefono ?? '—'}
      </span>
    ),
  },
  {
    id: 'correo',
    header: 'Correo',
    enableSorting: true,
    cell: ({ row }) => (
      <span style={{ color: row.original.correo ? 'inherit' : 'var(--color-fg-muted)' }}>
        {row.original.correo ?? '—'}
      </span>
    ),
  },
  {
    id: 'porcentajePago',
    header: '% Pago',
    cell: ({ row }) => <span>{row.original.porcentajePago}%</span>,
  },
  {
    id: 'comunaResidencia',
    header: 'Comuna',
    cell: ({ row }) => (
      <span style={{ color: row.original.comunaResidencia ? 'inherit' : 'var(--color-fg-muted)' }}>
        {row.original.comunaResidencia ?? '—'}
      </span>
    ),
  },
  {
    id: 'activo',
    header: 'Estado',
    cell: ({ row }) => (
      <StatusDot active={row.original.activo}>{row.original.activo ? 'Activa' : 'Inactiva'}</StatusDot>
    ),
  },
]

const filters: FilterDef[] = [
  { key: 'nombre', label: 'Buscar', type: 'text', placeholder: 'Nombre o apellido…' },
  { key: 'mostrarInactivas', label: 'Mostrar inactivas', type: 'checkbox' },
]

export function EnfermerasTable({ initialData, comunas, search, onCreate, onUpdate, onToggle, onDelete }: Props) {
  const formFields: FormFieldDef[] = useMemo(() => [
    { name: 'nombres', label: 'Nombres', required: true },
    { name: 'apellidoPaterno', label: 'Apellido paterno', required: true },
    { name: 'apellidoMaterno', label: 'Apellido materno' },
    { name: 'rut', label: 'RUT', placeholder: '12.345.678-9' },
    { name: 'telefono', label: 'Teléfono', type: 'tel' },
    { name: 'correo', label: 'Correo electrónico', type: 'email' },
    { name: 'porcentajePago', label: '% Pago', type: 'number', placeholder: '67.5' },
    {
      name: 'idComunaResidencia',
      label: 'Comuna de residencia',
      type: 'select-single',
      placeholder: 'Buscar comuna…',
      options: comunas.map((c) => ({ value: String(c.id), label: c.nombre })),
    },
  ], [comunas])

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

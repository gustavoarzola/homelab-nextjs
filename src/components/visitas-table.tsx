'use client'

import { DataTable, type ColumnDef, type FilterDef, type SearchParams, type Result } from './data-table'
import { Badge } from './ui/badge'
import { formatDateTime } from '@/lib/format'
import type { VisitaRow } from '@/lib/actions/visitas'
import { ESTADO_VISITA_STYLES } from '@/lib/estado-colors'

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: ColumnDef<VisitaRow>[] = [
  {
    id: 'id',
    accessorKey: 'id',
    header: 'ID',
    enableSorting: false,
    cell: ({ row }) => row.original.id,
  },
  {
    id: 'fecha',
    accessorKey: 'fecha',
    header: 'Fecha',
    enableSorting: true,
    cell: ({ row }) => formatDateTime(row.original.fecha, row.original.hora),
  },
  {
    id: 'paciente',
    accessorKey: 'paciente',
    header: 'Paciente',
    enableSorting: true,
    cell: ({ row }) => (
      <span style={{ color: row.original.paciente ? 'inherit' : 'var(--color-fg-muted)' }}>
        {row.original.paciente ?? '—'}
      </span>
    ),
  },
  {
    id: 'estado',
    accessorKey: 'estado',
    header: 'Estado',
    enableSorting: true,
    cell: ({ row }) => {
      const cfg = ESTADO_VISITA_STYLES[row.original.estado]
      return <Badge badgeClass={cfg?.badgeClass ?? 'is-cancelada'}>{cfg?.label ?? row.original.estado}</Badge>
    },
  },
  {
    id: 'enfermera',
    header: 'Enfermera',
    cell: ({ row }) => (
      <span style={{ color: row.original.enfermera ? 'inherit' : 'var(--color-fg-muted)' }}>
        {row.original.enfermera ?? '—'}
      </span>
    ),
  },
  {
    id: 'costo',
    accessorKey: 'costo',
    header: 'Costo',
    enableSorting: true,
    cell: ({ row }) => <span className="hl-tnum block text-right">${row.original.costo.toLocaleString('es-CL')}</span>,
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
  },
]

// ─── Filters ──────────────────────────────────────────────────────────────────

function getFilters(enfermeras: { id: number; nombre: string }[]): FilterDef[] {
  return [
    {
      key: 'buscar',
      label: 'Buscar',
      type: 'text',
      placeholder: 'Nombre o apellido del paciente…',
    },
    {
      key: 'estado',
      label: 'Estado',
      type: 'select-single',
      options: [
        { value: '', label: '— Todos —' },
        { value: 'programada',   label: 'Programada' },
        { value: 'confirmada',   label: 'Confirmada' },
        { value: 'realizada',    label: 'Realizada' },
        { value: 'completada',   label: 'Completada' },
        { value: 'no_realizada', label: 'No realizada' },
        { value: 'cancelada',    label: 'Cancelada' },
      ],
    },
    {
      key: 'enfermera',
      label: 'Enfermera',
      type: 'select-single',
      options: [
        { value: '', label: '— Todas —' },
        ...enfermeras.map((e) => ({ value: String(e.id), label: e.nombre })),
      ],
    },
    {
      key: 'fecha',
      label: 'Período',
      type: 'date-range',
      keyFrom: 'fechaInicio',
      keyTo: 'fechaFin',
    },
  ]
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  initialData: { rows: VisitaRow[]; total: number }
  search: (params: SearchParams) => Promise<{ rows: VisitaRow[]; total: number }>
  onDelete: (id: number) => Promise<Result>
  enfermeras: { id: number; nombre: string }[]
}

export function VisitasTable({ initialData, search, onDelete, enfermeras }: Props) {
  const filters = getFilters(enfermeras)

  return (
    <DataTable<VisitaRow>
      initialData={initialData}
      columns={columns}
      filters={filters}
      formFields={[]}
      search={search}
      onDelete={onDelete}
      entityLabel="visita"
      createHref="/pacientes"
      createLabel="Nueva visita"
      getEditHref={(row) => `/visitas/${row.id}`}
      exportHref="/api/visitas/export"
    />
  )
}

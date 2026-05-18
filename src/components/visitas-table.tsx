'use client'

import { DataTable, type ColumnDef, type FilterDef, type SearchParams, type Result } from './data-table'
import { formatDateTime } from '@/lib/format'
import type { VisitaRow } from '@/lib/actions/visitas'

// ─── Estado badge ─────────────────────────────────────────────────────────────

const ESTADO_STYLES: Record<string, React.CSSProperties> = {
  creada:       { backgroundColor: 'oklch(0.7 0.1 250 / 15%)',         color: 'oklch(0.35 0.1 250)' },
  confirmada:   { backgroundColor: 'oklch(0.7 0.15 60 / 15%)',         color: 'oklch(0.40 0.15 60)' },
  realizada:    { backgroundColor: 'oklch(0.6 0.118 184.704 / 12%)',   color: 'oklch(0.45 0.118 184.704)' },
  cancelada:    { backgroundColor: 'var(--muted)',                     color: 'var(--muted-foreground)' },
  no_realizada: { backgroundColor: 'oklch(0.65 0.15 30 / 15%)',        color: 'oklch(0.45 0.15 30)' },
}
const ESTADO_LABELS: Record<string, string> = {
  creada: 'Creada', confirmada: 'Confirmada', realizada: 'Realizada', cancelada: 'Cancelada', no_realizada: 'No realizada',
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: ColumnDef<VisitaRow>[] = [
  {
    id: 'fecha',
    header: 'Fecha',
    enableSorting: true,
    cell: ({ row }) => formatDateTime(row.original.fecha, row.original.hora),
  },
  {
    id: 'paciente',
    header: 'Paciente',
    enableSorting: true,
    cell: ({ row }) => (
      <span style={{ color: row.original.paciente ? 'inherit' : 'var(--muted-foreground)' }}>
        {row.original.paciente ?? '—'}
      </span>
    ),
  },
  {
    id: 'estado',
    header: 'Estado',
    enableSorting: true,
    cell: ({ row }) => (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={ESTADO_STYLES[row.original.estado] ?? {}}
      >
        {ESTADO_LABELS[row.original.estado] ?? row.original.estado}
      </span>
    ),
  },
  {
    id: 'enfermera',
    header: 'Enfermera',
    cell: ({ row }) => (
      <span style={{ color: row.original.enfermera ? 'inherit' : 'var(--muted-foreground)' }}>
        {row.original.enfermera ?? '—'}
      </span>
    ),
  },
  {
    id: 'costo',
    header: 'Costo',
    enableSorting: true,
    cell: ({ row }) => `$${row.original.costo.toLocaleString('es-CL')}`,
  },
  {
    id: 'pagado',
    header: 'Pago',
    enableSorting: false,
    cell: ({ row }) => row.original.estado === 'realizada' ? (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: row.original.pagado ? 'oklch(0.6 0.118 184.704 / 12%)' : 'oklch(0.65 0.15 30 / 15%)',
          color: row.original.pagado ? 'oklch(0.45 0.118 184.704)' : 'oklch(0.45 0.15 30)',
        }}
      >
        {row.original.pagado ? 'Pagado' : 'Pendiente'}
      </span>
    ) : null,
  },
  {
    id: 'resultados',
    header: 'Resultados',
    enableSorting: false,
    cell: ({ row }) => row.original.estado === 'realizada' ? (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: row.original.resultadosEnviados ? 'oklch(0.6 0.118 184.704 / 12%)' : 'oklch(0.7 0.15 60 / 15%)',
          color: row.original.resultadosEnviados ? 'oklch(0.45 0.118 184.704)' : 'oklch(0.40 0.15 60)',
        }}
      >
        {row.original.resultadosEnviados ? 'Enviados' : 'Pendientes'}
      </span>
    ) : null,
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
        { value: 'creada',       label: 'Creada' },
        { value: 'confirmada',   label: 'Confirmada' },
        { value: 'realizada',    label: 'Realizada' },
        { value: 'cancelada',    label: 'Cancelada' },
        { value: 'no_realizada', label: 'No realizada' },
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
    {
      key: 'pendientePago',
      label: 'Pago pendiente',
      type: 'checkbox',
    },
    {
      key: 'resultadosPendientes',
      label: 'Resultados pendientes',
      type: 'checkbox',
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
    />
  )
}

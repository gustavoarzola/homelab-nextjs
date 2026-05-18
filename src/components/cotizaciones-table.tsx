'use client'

import { DataTable, type ColumnDef, type FilterDef, type SearchParams } from './data-table'
import type { CotizacionRow } from '@/lib/actions/cotizaciones'
import { formatDate } from '@/lib/format'

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  convertida: 'Convertida',
}

const ESTADO_STYLES: Record<string, { bg: string; color: string }> = {
  borrador:   { bg: 'oklch(0.65 0.08 250 / 15%)', color: 'oklch(0.45 0.08 250)' },
  enviada:    { bg: 'oklch(0.75 0.12 60 / 15%)',  color: 'oklch(0.50 0.12 60)' },
  aceptada:   { bg: 'oklch(0.7 0.13 145 / 15%)', color: 'oklch(0.45 0.13 145)' },
  convertida: { bg: 'oklch(0.65 0.1 290 / 15%)',  color: 'oklch(0.40 0.1 290)' },
}

const columns: ColumnDef<CotizacionRow>[] = [
  {
    id: 'fecha',
    header: 'Fecha',
    enableSorting: true,
    cell: ({ row }) => (
      <span className="tabular-nums text-sm">{formatDate(row.original.fecha)}</span>
    ),
  },
  {
    id: 'paciente',
    header: 'Paciente',
    enableSorting: true,
    cell: ({ row }) => (
      <span className="text-sm">{row.original.paciente ?? '—'}</span>
    ),
  },
  {
    id: 'destinatario',
    header: 'Destinatario',
    cell: ({ row }) => (
      <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        {row.original.destinatario ?? '—'}
      </span>
    ),
  },
  {
    id: 'estado',
    header: 'Estado',
    enableSorting: true,
    cell: ({ row }) => {
      const style = ESTADO_STYLES[row.original.estado] ?? { bg: 'oklch(0.65 0.08 250 / 15%)', color: 'oklch(0.45 0.08 250)' }
      return (
        <span
          className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {ESTADO_LABELS[row.original.estado] ?? row.original.estado}
        </span>
      )
    },
  },
  {
    id: 'total',
    header: 'Total',
    enableSorting: true,
    cell: ({ row }) => (
      <span className="tabular-nums text-sm font-medium">
        {row.original.total > 0
          ? `$${row.original.total.toLocaleString('es-CL')}`
          : <span style={{ color: 'var(--muted-foreground)' }}>—</span>
        }
      </span>
    ),
  },
]

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'aceptada', label: 'Aceptada' },
  { value: 'convertida', label: 'Convertida' },
]

const filters: FilterDef[] = [
  { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Paciente, destinatario…' },
  { key: 'estado', label: 'Estado', type: 'select-single', options: ESTADO_OPTIONS },
]

type Props = {
  initialData: { rows: CotizacionRow[]; total: number }
  search: (params: SearchParams) => Promise<{ rows: CotizacionRow[]; total: number }>
}

export function CotizacionesTable({ initialData, search }: Props) {
  return (
    <DataTable
      initialData={initialData}
      columns={columns}
      filters={filters}
      formFields={[]}
      search={search}
      createHref="/cotizaciones/nueva"
      getEditHref={(id) => `/cotizaciones/${id}`}
      entityLabel="cotización"
      createLabel="Nueva cotización"
    />
  )
}

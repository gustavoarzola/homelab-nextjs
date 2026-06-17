'use client'

import { DataTable, type ColumnDef, type FilterDef, type SearchParams } from './data-table'
import type { CotizacionRow } from '@/lib/actions/cotizaciones'
import { formatDate } from '@/lib/format'
import { Printer, Stethoscope } from 'lucide-react'
import { ESTADO_COTIZACION_STYLES } from '@/lib/estado-colors'

const columns: ColumnDef<CotizacionRow>[] = [
  {
    id: 'id',
    header: 'N°',
    cell: ({ row }) => (
      <span className="tabular-nums text-sm font-mono" style={{ color: 'var(--muted-foreground)' }}>
        COT-{String(row.original.id).padStart(5, '0')}
      </span>
    ),
  },
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
      const cfg = ESTADO_COTIZACION_STYLES[row.original.estado]
      return (
        <span
          className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: cfg ? cfg.bg : 'var(--destructive)',
            color: cfg ? cfg.color : 'white',
          }}
        >
          {cfg ? cfg.label : `Inválido: ${row.original.estado}`}
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
  { value: 'creada', label: 'Creada' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'aceptada', label: 'Aceptada' },
  { value: 'rechazada', label: 'Rechazada' },
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
      getEditHref={(row) => `/cotizaciones/${row.id}`}
      entityLabel="cotización"
      createLabel="Nueva cotización"
      extraRowActions={(row) => (
        <>
          {row.idVisita && (
            <a
              href={`/visitas/${row.idVisita}`}
              title="Ver visita"
              className="rounded p-1.5 transition-opacity hover:opacity-80"
              style={{ color: 'oklch(0.45 0.13 145)' }}
            >
              <Stethoscope className="h-4 w-4" />
            </a>
          )}
          <a
            href={`/api/cotizacion-standalone/${row.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Imprimir cotización"
            className="rounded p-1.5 transition-opacity hover:opacity-80"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Printer className="h-4 w-4" />
          </a>
        </>
      )}
    />
  )
}

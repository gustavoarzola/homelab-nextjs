'use client'

import { DataTable, type ColumnDef, type FilterDef, type SearchParams } from './data-table'
import { Badge } from './ui/badge'
import { Chip } from './ui/chip'
import { Button } from './ui/button'
import type { CotizacionRow } from '@/lib/actions/cotizaciones'
import { formatDate } from '@/lib/format'
import { Printer, Stethoscope } from 'lucide-react'
import { ESTADO_COTIZACION_STYLES } from '@/lib/estado-colors'

const columns: ColumnDef<CotizacionRow>[] = [
  {
    id: 'id',
    header: 'N°',
    cell: ({ row }) => <Chip>COT-{String(row.original.id).padStart(5, '0')}</Chip>,
  },
  {
    id: 'fecha',
    header: 'Fecha',
    enableSorting: true,
    cell: ({ row }) => (
      <span className="hl-tnum">{formatDate(row.original.fecha)}</span>
    ),
  },
  {
    id: 'paciente',
    header: 'Paciente',
    enableSorting: true,
    cell: ({ row }) => <span>{row.original.paciente ?? '—'}</span>,
  },
  {
    id: 'destinatario',
    header: 'Destinatario',
    cell: ({ row }) => (
      <span style={{ color: 'var(--color-fg-muted)' }}>
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
      return cfg
        ? <Badge badgeClass={cfg.badgeClass}>{cfg.label}</Badge>
        : <Badge badgeClass="is-cot-rechazada">Inválido: {row.original.estado}</Badge>
    },
  },
  {
    id: 'total',
    header: 'Total',
    enableSorting: true,
    cell: ({ row }) => (
      <span className="hl-tnum block text-right" style={{ fontWeight: 500 }}>
        {row.original.total > 0
          ? `$${row.original.total.toLocaleString('es-CL')}`
          : <span style={{ color: 'var(--color-fg-muted)' }}>—</span>
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
            <Button variant="ghost" size="icon" asChild>
              <a href={`/visitas/${row.idVisita}`} title="Ver visita" style={{ color: 'var(--ok-fg)' }}>
                <Stethoscope />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon" asChild>
            <a href={`/api/cotizacion-standalone/${row.id}`} target="_blank" rel="noopener noreferrer" title="Imprimir cotización">
              <Printer />
            </a>
          </Button>
        </>
      )}
    />
  )
}

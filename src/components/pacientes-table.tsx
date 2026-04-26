'use client'

import Link from 'next/link'
import { Calendar, ClipboardList } from 'lucide-react'
import { DataTable, type ColumnDef, type SearchParams, type Result } from '@/components/data-table'
import type { PacienteRow } from '@/lib/actions/pacientes'
import { formatNombre } from '@/lib/paciente'
import { formatRut } from '@/lib/rut'

type Props = {
  initialData: { rows: PacienteRow[]; total: number }
  previsiones: { id: number; nombre: string }[]
  search: (params: SearchParams) => Promise<{ rows: PacienteRow[]; total: number }>
  onDelete: (id: number) => Promise<Result>
}

const columns: ColumnDef<PacienteRow>[] = [
  {
    id: 'apellidoPaterno',
    accessorFn: (row) => formatNombre(row),
    header: 'Nombre',
    enableSorting: true,
    cell: ({ row }) => formatNombre(row.original) || '—',
  },
  {
    id: 'identificador',
    accessorKey: 'identificador',
    header: 'Identificador',
    enableSorting: true,
    cell: ({ row }) => {
      const identificador = row.original.identificador
      if (!identificador) return '—'
      return formatRut(identificador)
    },
  },
  {
    id: 'telefono',
    accessorKey: 'telefono',
    header: 'Teléfono',
    enableSorting: false,
    cell: ({ row }) => row.original.telefono ?? '—',
  },
  {
    id: 'prevision',
    accessorKey: 'prevision',
    header: 'Previsión',
    enableSorting: false,
    cell: ({ row }) => row.original.prevision ?? '—',
  },
  {
    id: 'comuna',
    accessorKey: 'comuna',
    header: 'Comuna',
    enableSorting: false,
    cell: ({ row }) => row.original.comuna ?? '—',
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
  },
]

export function PacientesTable({ initialData, previsiones, search, onDelete }: Props) {
  const previsionOptions = [
    { value: '', label: '— Todas —' },
    ...previsiones.map((p) => ({ value: String(p.id), label: p.nombre })),
  ]

  return (
    <DataTable<PacienteRow>
      initialData={initialData}
      columns={columns}
      filters={[
        {
          key: 'buscar',
          label: 'Buscar',
          type: 'text',
          placeholder: 'Nombre, apellido o identificador...',
        },
        {
          key: 'idPrevision',
          label: 'Previsión',
          type: 'select-single',
          options: previsionOptions,
        },
      ]}
      formFields={[]}
      search={search}
      onDelete={onDelete}
      extraRowActions={(row) => (
        <>
          <Link
            href={`/pacientes/${row.id}/historial`}
            title="Historial de atenciones"
            className="rounded p-1.5 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ClipboardList className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/visitas/nueva?pacienteId=${row.id}`}
            title="Nueva visita"
            className="rounded p-1.5 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Calendar className="h-3.5 w-3.5" />
          </Link>
        </>
      )}
      entityLabel="paciente"
      createLabel="Nuevo paciente"
      createHref="/pacientes/nuevo"
      getEditHref={(id) => `/pacientes/${id}`}
    />
  )
}

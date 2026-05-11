'use client'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import type { ExamenRow } from '@/lib/actions/catalogos'
import { EXAM_GRUPO_LABELS, EXAM_GRUPOS, type ExamGrupo } from '@/lib/exam-grupos'

type Props = {
  initialData: { rows: ExamenRow[]; total: number }
  search: (params: SearchParams) => Promise<{ rows: ExamenRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

const columns: ColumnDef<ExamenRow>[] = [
  {
    id: 'nombre',
    header: 'Nombre',
    enableSorting: true,
    cell: ({ row }) => <span>{row.original.nombre}</span>,
  },
  {
    id: 'codigo',
    header: 'Código',
    enableSorting: true,
    cell: ({ row }) => (
      <span className="font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
        {row.original.codigo}
      </span>
    ),
  },
  {
    id: 'grupoExamen',
    header: 'Grupo',
    cell: ({ row }) => (
      <span>{EXAM_GRUPO_LABELS[row.original.grupoExamen as ExamGrupo] ?? row.original.grupoExamen}</span>
    ),
  },
  {
    id: 'precio',
    header: 'Precio',
    cell: ({ row }) => (
      <span className="tabular-nums">${row.original.precio.toLocaleString('es-CL')}</span>
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
        {row.original.activo ? 'Activo' : 'Inactivo'}
      </span>
    ),
  },
]

const filters: FilterDef[] = [
  { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Nombre o código…' },
  { key: 'mostrarInactivos', label: 'Mostrar inactivos', type: 'checkbox' },
]

const formFields: FormFieldDef[] = [
  { name: 'nombre', label: 'Nombre', required: true },
  { name: 'codigo', label: 'Código', required: true, placeholder: 'ej: EXA-001' },
  {
    name: 'grupoExamen',
    label: 'Grupo',
    required: true,
    type: 'select',
    options: EXAM_GRUPOS.map((g) => ({ value: g, label: EXAM_GRUPO_LABELS[g] })),
  },
  { name: 'precio', label: 'Precio', required: true, type: 'number' },
]

export function ExamenesTable({ initialData, search, onCreate, onUpdate, onToggle }: Props) {
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
      entityLabel="examen"
      createLabel="Nuevo examen"
    />
  )
}

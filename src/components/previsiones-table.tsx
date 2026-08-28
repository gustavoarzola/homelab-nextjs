'use client'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import { StatusDot } from './ui/status-dot'
import type { PrevisionRow } from '@/lib/actions/catalogos'
import { PREVISION_CATEGORIA_LABELS, PREVISION_CATEGORIA_OPTIONS, type PrevisionCategoria } from '@/lib/previsiones'

type Props = {
  initialData: { rows: PrevisionRow[]; total: number }
  search: (params: SearchParams) => Promise<{ rows: PrevisionRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

function formatCategoriaLabel(categoria: string): string {
  const normalized = categoria.trim()
  if (!normalized) return categoria
  const label = PREVISION_CATEGORIA_LABELS[normalized as PrevisionCategoria]
  if (label) return label
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const columns: ColumnDef<PrevisionRow>[] = [
  {
    id: 'nombre',
    header: 'Nombre',
    enableSorting: true,
    cell: ({ row }) => <span>{row.original.nombre}</span>,
  },
  {
    id: 'categoria',
    header: 'Categoría',
    cell: ({ row }) => {
      const cat = row.original.categoria
      if (!cat) return <span style={{ color: 'var(--color-fg-muted)' }}>—</span>
      return <span>{formatCategoriaLabel(cat)}</span>
    },
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
  { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Nombre…' },
  {
    key: 'categoria',
    label: 'Categoría',
    type: 'select-single',
    options: [{ value: '', label: '— Todas —' }, ...PREVISION_CATEGORIA_OPTIONS],
  },
  { key: 'mostrarInactivos', label: 'Mostrar inactivas', type: 'checkbox' },
]

const formFields: FormFieldDef[] = [
  { name: 'nombre', label: 'Nombre', required: true },
  { name: 'categoria', label: 'Categoría', type: 'select-single', required: true, options: PREVISION_CATEGORIA_OPTIONS },
]

export function PrevisionesTable({ initialData, search, onCreate, onUpdate, onToggle }: Props) {
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
      entityLabel="previsión"
      createLabel="Nueva previsión"
    />
  )
}

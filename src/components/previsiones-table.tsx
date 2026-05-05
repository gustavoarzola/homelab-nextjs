'use client'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type Result, type SearchParams } from './data-table'
import type { PrevisionRow } from '@/lib/actions/catalogos'

type Props = {
  initialData: { rows: PrevisionRow[]; total: number }
  categorias: string[]
  search: (params: SearchParams) => Promise<{ rows: PrevisionRow[]; total: number }>
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

function formatCategoriaLabel(categoria: string): string {
  const normalized = categoria.trim()
  if (!normalized) return categoria
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
      if (!cat) return <span style={{ color: 'var(--muted-foreground)' }}>—</span>
      return <span style={{ color: 'var(--foreground)' }}>{formatCategoriaLabel(cat)}</span>
    },
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

export function PrevisionesTable({ initialData, categorias, search, onCreate, onUpdate, onToggle }: Props) {
  const categoriaOptions = categorias.map((categoria) => ({
    value: categoria,
    label: formatCategoriaLabel(categoria),
  }))

  const filters: FilterDef[] = [
    { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Nombre…' },
    {
      key: 'categoria',
      label: 'Categoría',
      type: 'select-single',
      options: [{ value: '', label: '— Todas —' }, ...categoriaOptions],
    },
    { key: 'mostrarInactivos', label: 'Mostrar inactivas', type: 'checkbox' },
  ]

  const formFields: FormFieldDef[] = [
    { name: 'nombre', label: 'Nombre', required: true },
    { name: 'categoria', label: 'Categoría', type: 'select-single', required: true, options: categoriaOptions },
  ]

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

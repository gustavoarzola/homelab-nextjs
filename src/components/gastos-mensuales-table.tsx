'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'

import { DataTable, type ColumnDef, type FilterDef, type FormFieldDef, type SearchParams } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import {
  copiarGastosMesAnterior,
  createGastoMensual,
  deleteGastoMensual,
  searchGastosMensuales,
  updateGastoMensual,
  type GastoMensualRow,
} from '@/lib/actions/gastos-mensuales'
import { EXAM_GRUPOS, EXAM_GRUPO_LABELS } from '@/lib/exam-grupos'
import { GASTO_CATEGORIA_META, GASTO_CATEGORIA_OPTIONS, isGastoCategoria } from '@/lib/finanzas/categorias-gasto'
import { MESES, previousMonth } from '@/lib/finanzas/periodo'

const LAB_OPTIONS = [
  { value: '', label: '— Sin laboratorio —' },
  ...EXAM_GRUPOS.map((g) => ({ value: g, label: EXAM_GRUPO_LABELS[g] })),
]

const columns: ColumnDef<GastoMensualRow>[] = [
  {
    id: 'categoria',
    header: 'Categoría',
    enableSorting: true,
    cell: ({ row }) => (
      <Chip>{isGastoCategoria(row.original.categoria) ? GASTO_CATEGORIA_META[row.original.categoria].label : row.original.categoria}</Chip>
    ),
  },
  {
    id: 'descripcion',
    header: 'Descripción',
    enableSorting: true,
    cell: ({ row }) => (
      <span>
        {row.original.descripcion}
        {row.original.grupoExamen && (
          <span style={{ color: 'var(--color-fg-muted)' }}> · {EXAM_GRUPO_LABELS[row.original.grupoExamen as keyof typeof EXAM_GRUPO_LABELS] ?? row.original.grupoExamen}</span>
        )}
      </span>
    ),
  },
  {
    id: 'monto',
    header: 'Monto',
    enableSorting: true,
    cell: ({ row }) => <span className="hl-tnum block text-right">${row.original.monto.toLocaleString('es-CL')}</span>,
  },
]

const filters: FilterDef[] = [
  { key: 'buscar', label: 'Buscar', type: 'text', placeholder: 'Descripción…' },
  { key: 'categoria', label: 'Categoría', type: 'select-single', options: [{ value: '', label: '— Todas —' }, ...GASTO_CATEGORIA_OPTIONS] },
]

const formFields: FormFieldDef[] = [
  { name: 'categoria', label: 'Categoría', type: 'select-single', required: true, options: GASTO_CATEGORIA_OPTIONS },
  { name: 'descripcion', label: 'Descripción', required: true, placeholder: 'ej: Factura Imalab, Google Ads, Contador' },
  { name: 'monto', label: 'Monto', type: 'number', required: true, placeholder: '0' },
  { name: 'grupoExamen', label: 'Laboratorio (solo para costo de laboratorio)', type: 'select-single', options: LAB_OPTIONS },
]

type Props = {
  month: number
  year: number
  initialData: { rows: GastoMensualRow[]; total: number }
}

export function GastosMensualesTable({ month, year, initialData }: Props) {
  const router = useRouter()
  const [version, setVersion] = React.useState(0)
  const [copying, setCopying] = React.useState(false)
  const prev = previousMonth(year, month)

  const search = React.useCallback(
    (p: SearchParams) => searchGastosMensuales({ ...p, filters: { ...p.filters, anio: String(year), mes: String(month) } }),
    [year, month],
  )
  const withPeriodo = (fd: FormData) => {
    fd.set('anio', String(year))
    fd.set('mes', String(month))
    return fd
  }

  const copiar = async () => {
    setCopying(true)
    try {
      const res = await copiarGastosMesAnterior(month, year)
      if (!res.success) return void toast.error(res.error)
      toast.success(res.data.copiados === 0 ? 'No había gastos nuevos que copiar' : `${res.data.copiados} gastos copiados`)
      setVersion((v) => v + 1)
      router.refresh()
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
          Costos y gastos de {MESES[month - 1]} {year} que no salen de las visitas.
        </p>
        <Button variant="secondary" onClick={copiar} disabled={copying}>
          <Copy />
          Copiar de {MESES[prev.month - 1]} {prev.year}
        </Button>
      </div>
      <DataTable
        key={`${year}-${month}-${version}`}
        initialData={initialData}
        columns={columns}
        filters={filters}
        formFields={formFields}
        search={search}
        onCreate={(fd) => createGastoMensual(withPeriodo(fd))}
        onUpdate={(fd) => updateGastoMensual(withPeriodo(fd))}
        onDelete={deleteGastoMensual}
        entityLabel="gasto"
        createLabel="Nuevo gasto"
      />
    </div>
  )
}

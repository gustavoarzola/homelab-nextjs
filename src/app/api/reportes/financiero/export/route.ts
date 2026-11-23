import { requireAdmin } from '@/lib/auth-guard'
import { buildExcelWorkbook, type ExcelColumn } from '@/lib/excel/build-excel'
import { todaySantiago } from '@/lib/format'
import {
  buildResumenMensual,
  mesesEntre,
  periodoKey,
  REPORTE_FINANCIERO_COLUMNS,
  resumenColumns,
} from '@/lib/reportes/financiero'
import {
  listCategoriasCostoParaResumen,
  listCostosMensualesPeriodo,
  listVisitasReporteFinanciero,
} from '@/lib/reportes/financiero-query'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type CostoRow = { periodo: string; categoria: string; monto: number; notas: string | null }

const COSTO_COLUMNS: ExcelColumn<CostoRow>[] = [
  { header: 'Mes', accessor: (r) => r.periodo, width: 10 },
  { header: 'Categoría', accessor: (r) => r.categoria, width: 32 },
  { header: 'Monto', accessor: (r) => r.monto, width: 16, format: 'currency-clp' },
  { header: 'Notas', accessor: (r) => r.notas, width: 50, wrap: true },
]

export async function GET(request: Request) {
  await requireAdmin()

  const { searchParams } = new URL(request.url)
  const fechaInicio = searchParams.get('fechaInicio') ?? ''
  const fechaFin = searchParams.get('fechaFin') ?? ''
  const filters = {
    buscar: searchParams.get('buscar') ?? '',
    estado: searchParams.get('estado') ?? '',
    enfermera: searchParams.get('enfermera') ?? '',
    fechaInicio: DATE_RE.test(fechaInicio) ? fechaInicio : '',
    fechaFin: DATE_RE.test(fechaFin) ? fechaFin : '',
  }

  // Columnas de la hoja "Visitas" elegidas en /reportes. Vacío → todas.
  const requestedKeys = searchParams.get('columns')?.split(',').filter(Boolean) ?? []
  const columns = requestedKeys.length > 0
    ? REPORTE_FINANCIERO_COLUMNS.filter((c) => requestedKeys.includes(c.key))
    : REPORTE_FINANCIERO_COLUMNS

  const [rows, costos] = await Promise.all([
    listVisitasReporteFinanciero(filters),
    listCostosMensualesPeriodo(filters.fechaInicio || undefined, filters.fechaFin || undefined),
  ])
  const categorias = await listCategoriasCostoParaResumen([...new Set(costos.map((c) => c.categoria))])

  const meses = new Set<string>()
  if (filters.fechaInicio && filters.fechaFin) mesesEntre(filters.fechaInicio, filters.fechaFin).forEach((m) => meses.add(m))
  rows.forEach((r) => meses.add(r.fecha.slice(0, 7)))
  costos.forEach((c) => meses.add(periodoKey(c.anio, c.mes)))
  const mesesOrdenados = [...meses].sort()

  const resumen = buildResumenMensual({ rows, costos, categorias, meses: mesesOrdenados })

  const { buffer, fileName } = await buildExcelWorkbook({
    fileName: `reporte-financiero-${todaySantiago()}.xlsx`,
    sheets: [
      {
        sheetName: 'Resumen',
        columns: resumenColumns(mesesOrdenados),
        rows: resumen,
        isBold: (r) => Boolean(r.bold),
      },
      { sheetName: 'Visitas', columns, rows },
      {
        sheetName: 'Costos mensuales',
        columns: COSTO_COLUMNS,
        rows: costos.map((c) => ({ periodo: periodoKey(c.anio, c.mes), categoria: c.categoria, monto: c.monto, notas: c.notas })),
      },
    ],
  })

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}

import { requireSession } from '@/lib/auth-guard'
import { listVisitasForReport } from '@/lib/actions/visitas'
import { buildExcel } from '@/lib/excel/build-excel'
import { VISITA_REPORT_COLUMNS } from '@/lib/reportes/visitas-columns'

export async function GET(request: Request) {
  await requireSession()

  const { searchParams } = new URL(request.url)

  const filters = {
    buscar: searchParams.get('buscar') ?? '',
    estado: searchParams.get('estado') ?? '',
    enfermera: searchParams.get('enfermera') ?? '',
    fechaInicio: searchParams.get('fechaInicio') ?? '',
    fechaFin: searchParams.get('fechaFin') ?? '',
  }

  // Columnas seleccionadas por el usuario (checkboxes en /reportes). Sin
  // parámetro `columns` (o vacío) → se incluyen todas, en el orden del registro.
  const requestedKeys = searchParams.get('columns')?.split(',').filter(Boolean) ?? []
  const columns = requestedKeys.length > 0
    ? VISITA_REPORT_COLUMNS.filter((c) => requestedKeys.includes(c.key))
    : VISITA_REPORT_COLUMNS

  const rows = await listVisitasForReport(filters)
  const { buffer, fileName } = await buildExcel({ columns, rows, sheetName: 'Reporte Visitas' })

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}

import { requireSession } from '@/lib/auth-guard'
import { listVisitasForExport, type VisitaRow } from '@/lib/actions/visitas'
import { buildExcel, type ExcelColumn } from '@/lib/excel/build-excel'
import { parseDateLocal } from '@/lib/format'

const ESTADO_LABELS: Record<string, string> = {
  programada: 'Programada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  no_realizada: 'No realizada',
}

const columns: ExcelColumn<VisitaRow>[] = [
  { header: 'ID',          accessor: (r) => r.id,                                                                width: 8,  format: 'integer' },
  { header: 'Fecha',       accessor: (r) => parseDateLocal(r.fecha),                                             width: 12, format: 'date' },
  { header: 'Hora',        accessor: (r) => r.hora?.slice(0, 5) ?? null,                                        width: 8 },
  { header: 'Paciente',    accessor: (r) => r.paciente,                                                          width: 32 },
  { header: 'Estado',      accessor: (r) => ESTADO_LABELS[r.estado] ?? r.estado,                                width: 14 },
  { header: 'Enfermera',   accessor: (r) => r.enfermera,                                                         width: 28 },
  { header: 'Costo',       accessor: (r) => r.costo,                                                             width: 14, format: 'currency-clp' },
]

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

  const sortKey = searchParams.get('sortKey')
  const sortDirRaw = searchParams.get('sortDir')
  const sortDir: 'asc' | 'desc' | null =
    sortDirRaw === 'asc' || sortDirRaw === 'desc' ? sortDirRaw : null
  const sort = sortKey && sortDir ? { key: sortKey, dir: sortDir } : null

  const rows = await listVisitasForExport(filters, sort)
  const { buffer, fileName } = await buildExcel({ columns, rows, sheetName: 'Visitas' })

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}

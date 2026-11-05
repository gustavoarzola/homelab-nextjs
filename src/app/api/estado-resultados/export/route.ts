import { getEstadoResultados } from '@/lib/actions/estado-resultados'
import { requireSession } from '@/lib/auth-guard'
import { buildEstadoResultadosExcel } from '@/lib/excel/build-estado-resultados-excel'
import { parsePeriodo } from '@/lib/finanzas/periodo'

export async function GET(request: Request) {
  await requireSession()

  const { searchParams } = new URL(request.url)
  const { month, year } = parsePeriodo({
    month: searchParams.get('month') ?? undefined,
    year: searchParams.get('year') ?? undefined,
  })

  const data = await getEstadoResultados(month, year)
  const { buffer, fileName } = await buildEstadoResultadosExcel(data)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}

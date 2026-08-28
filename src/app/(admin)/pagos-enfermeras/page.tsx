import { PagosEnfermerasTable } from '@/components/pagos-enfermeras-table'
import { searchPagosEnfermerasMensual } from '@/lib/actions/pagos-enfermeras'
import { getEnfermeras } from '@/lib/actions/visitas'
import { PageHeader } from '@/components/page-header'

type Props = {
  searchParams: Promise<{ month?: string; year?: string; enfermeraId?: string }>
}

export default async function PagosEnfermerasPage({ searchParams }: Props) {
  const params = await searchParams
  const now = new Date()
  const month =
    Number(params.month) >= 1 && Number(params.month) <= 12
      ? Number(params.month)
      : now.getMonth() + 1
  const year =
    Number(params.year) >= 2000 && Number(params.year) <= 2100
      ? Number(params.year)
      : now.getFullYear()
  const enfermeraId = params.enfermeraId?.trim() || undefined

  const [{ rows }, enfermeras] = await Promise.all([
    searchPagosEnfermerasMensual({ month, year, enfermeraId }),
    getEnfermeras(),
  ])

  return (
    <>
      <PageHeader
        title="Pagos a enfermeras"
        meta="Solo visitas completadas · Base de cálculo: fee visita + procedimientos + recargos (excluye exámenes y talleres)"
      />
      <PagosEnfermerasTable
        rows={rows}
        month={month}
        year={year}
        enfermeraId={enfermeraId ?? ''}
        enfermeras={enfermeras}
      />
    </>
  )
}

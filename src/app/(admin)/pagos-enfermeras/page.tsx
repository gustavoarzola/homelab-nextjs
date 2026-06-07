import { PagosEnfermerasTable } from '@/components/pagos-enfermeras-table'
import { searchPagosEnfermerasMensual } from '@/lib/actions/pagos-enfermeras'
import { getEnfermeras } from '@/lib/actions/visitas'

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
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Pagos a enfermeras
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Base de cálculo: fee visita + procedimientos + recargos (excluye exámenes y talleres)
        </p>
      </div>
      <PagosEnfermerasTable
        rows={rows}
        month={month}
        year={year}
        enfermeraId={enfermeraId ?? ''}
        enfermeras={enfermeras}
      />
    </div>
  )
}

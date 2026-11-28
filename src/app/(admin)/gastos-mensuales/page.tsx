import { auth } from '@/auth'
import { GastosMensualesForm } from '@/components/gastos-mensuales-form'
import { PageHeader } from '@/components/page-header'
import { getGastosMensuales } from '@/lib/actions/gastos-mensuales'
import { todaySantiago } from '@/lib/format'
import { isAdmin } from '@/lib/permissions'

type Props = {
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function GastosMensualesPage({ searchParams }: Props) {
  const params = await searchParams
  const today = todaySantiago()
  const month = Number(params.month) >= 1 && Number(params.month) <= 12 ? Number(params.month) : Number(today.slice(5, 7))
  const year = Number(params.year) >= 2000 && Number(params.year) <= 2100 ? Number(params.year) : Number(today.slice(0, 4))

  const [rows, session] = await Promise.all([getGastosMensuales(year, month), auth()])

  return (
    <>
      <PageHeader
        title="Gastos mensuales"
        meta="Monto total del mes por categoría de gasto · se incluye en la hoja Resumen del reporte financiero"
      />
      <GastosMensualesForm
        key={`${year}-${month}`}
        rows={rows}
        month={month}
        year={year}
        isAdmin={isAdmin(session?.user?.role)}
      />
    </>
  )
}

import { auth } from '@/auth'
import { CostosMensualesForm } from '@/components/costos-mensuales-form'
import { PageHeader } from '@/components/page-header'
import { getCostosMensuales } from '@/lib/actions/costos-mensuales'
import { todaySantiago } from '@/lib/format'
import { isAdmin } from '@/lib/permissions'

type Props = {
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function CostosMensualesPage({ searchParams }: Props) {
  const params = await searchParams
  const today = todaySantiago()
  const month = Number(params.month) >= 1 && Number(params.month) <= 12 ? Number(params.month) : Number(today.slice(5, 7))
  const year = Number(params.year) >= 2000 && Number(params.year) <= 2100 ? Number(params.year) : Number(today.slice(0, 4))

  const [rows, session] = await Promise.all([getCostosMensuales(year, month), auth()])

  return (
    <>
      <PageHeader
        title="Costos mensuales"
        meta="Monto total del mes por categoría de costo · se incluye en la hoja Resumen del reporte financiero"
      />
      <CostosMensualesForm
        key={`${year}-${month}`}
        rows={rows}
        month={month}
        year={year}
        isAdmin={isAdmin(session?.user?.role)}
      />
    </>
  )
}

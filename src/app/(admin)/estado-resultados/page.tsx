import { EstadoResultadosView } from '@/components/estado-resultados-view'
import { GastosMensualesTable } from '@/components/gastos-mensuales-table'
import { PageHeader } from '@/components/page-header'
import { TasasRetencionCard } from '@/components/tasas-retencion-card'
import { getEstadoResultados } from '@/lib/actions/estado-resultados'
import { searchGastosMensuales } from '@/lib/actions/gastos-mensuales'
import { getTasasRetencion } from '@/lib/actions/tasas-retencion'
import { MESES, parsePeriodo } from '@/lib/finanzas/periodo'

type Props = {
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function EstadoResultadosPage({ searchParams }: Props) {
  const { month, year } = parsePeriodo(await searchParams)

  const [data, gastos, tasas] = await Promise.all([
    getEstadoResultados(month, year),
    searchGastosMensuales({ filters: { anio: String(year), mes: String(month) }, sort: null, page: 1, pageSize: 10 }),
    getTasasRetencion(),
  ])

  return (
    <>
      <PageHeader
        title="Estado de resultados"
        meta={`${MESES[month - 1]} ${year} · Solo visitas completadas · Honorarios de enfermeras por su monto bruto`}
      />
      <div className="space-y-10">
        <EstadoResultadosView data={data} />
        <section>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 8 }}>Gastos del mes</h2>
          <GastosMensualesTable month={month} year={year} initialData={gastos} />
        </section>
        <section>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 8 }}>Tasa de retención de honorarios</h2>
          <TasasRetencionCard tasas={tasas} />
        </section>
      </div>
    </>
  )
}

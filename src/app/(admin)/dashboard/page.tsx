import { auth } from '@/auth'
import { PageHeader } from '@/components/page-header'
import { DashboardFilters } from '@/components/dashboard-filters'
import { DashboardFinanceCard } from '@/components/dashboard-finance-card'
import { DashboardCobrosTable, DashboardResultadosTable } from '@/components/dashboard-pending-table'
import { DashboardRankingCard } from '@/components/dashboard-ranking-card'
import { DashboardVisitsChart } from '@/components/dashboard-visits-chart'
import { getDashboardVisitsByDay, getDashboardFinanciero } from '@/lib/actions/dashboard'

type Props = {
  searchParams: Promise<{
    month?: string
    year?: string
  }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await auth()
  const params = await searchParams
  const now = new Date()
  const month = Number(params.month) >= 1 && Number(params.month) <= 12
    ? Number(params.month)
    : now.getMonth() + 1
  const year = Number(params.year) >= 2000 && Number(params.year) <= 2100
    ? Number(params.year)
    : now.getFullYear()
  const [dashboard, financiero] = await Promise.all([
    getDashboardVisitsByDay(month, year),
    getDashboardFinanciero(month, year),
  ])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Visitas del mes"
        meta={session?.user?.name}
        actions={<DashboardFilters month={month} year={year} />}
      />

      <DashboardVisitsChart
        data={dashboard.chartData}
        monthLabel={dashboard.monthLabel}
        year={dashboard.year}
        totalVisits={dashboard.totalVisits}
        peakVisits={dashboard.peakVisits}
        peakLabel={dashboard.peakLabel}
        averageVisits={dashboard.averageVisits}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DashboardRankingCard
          title="Visitas por enfermera"
          description="Profesionales con mayor carga durante el período"
          items={dashboard.visitsByNurse}
          icon="nurse"
        />
        <DashboardRankingCard
          title="Composición de visitas"
          description="Qué se atiende en cada visita realizada del período"
          items={dashboard.visitsByComposicion}
          icon="composicion"
        />
      </div>

      {/* ── Resumen financiero ── */}
      <div>
        <p className="hl-label" style={{ marginBottom: 14 }}>Resumen financiero</p>
        <DashboardFinanceCard cobrosEnPendiente={financiero.cobrosEnPendiente} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DashboardCobrosTable
          items={financiero.cobrosPendientes}
          total={financiero.totalCobrosPendientes}
        />
        <DashboardResultadosTable
          items={financiero.resultadosPendientes}
          total={financiero.totalResultadosPendientes}
        />
      </div>
    </div>
  )
}

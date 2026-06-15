import { auth } from '@/auth'
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
    <div className="min-h-full -m-8 bg-[radial-gradient(circle_at_top_left,rgba(44,95,158,0.08),transparent_28%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-6 xl:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="relative z-20 flex flex-col gap-4 rounded-[28px] border border-black/5 bg-white/90 p-6 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.34)] backdrop-blur-sm xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--muted-foreground)' }}>
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
              Visitas del mes
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {session?.user?.name}
            </p>
          </div>
          <DashboardFilters month={month} year={year} />
        </div>

        <div className="relative z-0">
          <DashboardVisitsChart
            data={dashboard.chartData}
            monthLabel={dashboard.monthLabel}
            year={dashboard.year}
            totalVisits={dashboard.totalVisits}
            peakVisits={dashboard.peakVisits}
            peakLabel={dashboard.peakLabel}
            averageVisits={dashboard.averageVisits}
          />
        </div>

        <div className="relative z-0 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DashboardRankingCard
            title="Visitas por enfermera"
            description="Profesionales con mayor carga durante el período"
            items={dashboard.visitsByNurse}
            icon="nurse"
          />
        </div>

        {/* ── Resumen financiero ── */}
        <div className="relative z-0">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--muted-foreground)' }}>
            Resumen financiero
          </p>
          <DashboardFinanceCard
            cobrosEnPendiente={financiero.cobrosEnPendiente}
          />
        </div>

        <div className="relative z-0 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DashboardCobrosTable items={financiero.cobrosPendientes} />
          <DashboardResultadosTable items={financiero.resultadosPendientes} />
        </div>

      </div>
    </div>
  )
}

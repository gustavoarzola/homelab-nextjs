'use server'

import { and, asc, count, desc, eq, gte, lte, sql, sum } from 'drizzle-orm'

import { db } from '@/db'
import { nurses, patients, visits } from '@/db/schema'
import { requireSession } from '@/lib/auth-guard'
import { formatNombre } from '@/lib/paciente'

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`

  return { start, end, totalDays: endDate }
}

type RankingItem = {
  label: string
  visits: number
}

export async function getDashboardVisitsByDay(month: number, year: number) {
  await requireSession()

  const { start, end, totalDays } = getMonthRange(year, month)

  const rows = await db
    .select({
      fecha: visits.fecha,
      total: count(),
    })
    .from(visits)
    .where(and(gte(visits.fecha, start), lte(visits.fecha, end)))
    .groupBy(visits.fecha)
    .orderBy(asc(visits.fecha))

  const totalsByDate = new Map(rows.map((row) => [row.fecha, Number(row.total)]))
  const chartData = Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const total = totalsByDate.get(isoDate) ?? 0

    return {
      date: isoDate,
      day,
      label: `${day} de ${MONTHS[month - 1]}`,
      visits: total,
    }
  })

  const totalVisits = chartData.reduce((sum, item) => sum + item.visits, 0)
  const peakDay = chartData.reduce(
    (max, item) => (item.visits > max.visits ? item : max),
    chartData[0] ?? { day: 1, label: '', visits: 0, date: start },
  )

  const [visitsByNurseRaw] = await Promise.all([
    db
      .select({
        label: sql<string>`trim(concat(${nurses.nombres}, ' ', ${nurses.apellidoPaterno}))`,
        total: count(),
      })
      .from(visits)
      .innerJoin(nurses, sql`${visits.idEnfermera} = ${nurses.id}`)
      .where(and(gte(visits.fecha, start), lte(visits.fecha, end)))
      .groupBy(nurses.id, nurses.nombres, nurses.apellidoPaterno)
      .orderBy(desc(count()), asc(nurses.apellidoPaterno), asc(nurses.nombres))
      .limit(6),
  ])

  const visitsByNurse: RankingItem[] = visitsByNurseRaw.map((item) => ({
    label: item.label,
    visits: Number(item.total),
  }))

  return {
    chartData,
    totalVisits,
    peakVisits: peakDay.visits,
    peakLabel: peakDay.label,
    averageVisits: chartData.length ? totalVisits / chartData.length : 0,
    monthLabel: MONTHS[month - 1] ?? '',
    visitsByNurse,
    year,
    month,
  }
}

// ─── getDashboardFinanciero ───────────────────────────────────────────────────

export type CobroPendienteRow = {
  id: number
  fecha: string
  costo: number
  paciente: string | null
}

export type ResultadoPendienteRow = {
  id: number
  fecha: string
  paciente: string | null
}

export async function getDashboardFinanciero(month: number, year: number) {
  await requireSession()

  const { start, end } = getMonthRange(year, month)

  const [cobrosRaw, cobrosPendientesRaw, resultadosPendientesRaw] = await Promise.all([
    // Cobros pendientes (realizadas + no pagadas)
    db
      .select({ total: sum(visits.costo) })
      .from(visits)
      .where(
        and(
          gte(visits.fecha, start),
          lte(visits.fecha, end),
          eq(visits.estado, 'realizada'),
          eq(visits.pagado, false),
        ),
      ),

    // Lista cobros pendientes
    db
      .select({
        id: visits.id,
        fecha: visits.fecha,
        costo: visits.costo,
        pacienteNombres: patients.nombres,
        pacienteApellido: patients.apellidoPaterno,
        pacienteApellidoMaterno: patients.apellidoMaterno,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.idPaciente, patients.id))
      .where(
        and(
          gte(visits.fecha, start),
          lte(visits.fecha, end),
          eq(visits.estado, 'realizada'),
          eq(visits.pagado, false),
        ),
      )
      .orderBy(desc(visits.fecha))
      .limit(20),

    // Lista resultados pendientes
    db
      .select({
        id: visits.id,
        fecha: visits.fecha,
        pacienteNombres: patients.nombres,
        pacienteApellido: patients.apellidoPaterno,
        pacienteApellidoMaterno: patients.apellidoMaterno,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.idPaciente, patients.id))
      .where(
        and(
          gte(visits.fecha, start),
          lte(visits.fecha, end),
          eq(visits.estado, 'realizada'),
          sql`${visits.resultadosEnviadosCount} < ${visits.resultadosTotalCount}`,
        ),
      )
      .orderBy(desc(visits.fecha))
      .limit(20),
  ])

  const cobrosPendientes: CobroPendienteRow[] = cobrosPendientesRaw.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    costo: r.costo,
    paciente:
      formatNombre({
        nombres: r.pacienteNombres,
        apellidoPaterno: r.pacienteApellido,
        apellidoMaterno: r.pacienteApellidoMaterno,
      }) || null,
  }))

  const resultadosPendientes: ResultadoPendienteRow[] = resultadosPendientesRaw.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    paciente:
      formatNombre({
        nombres: r.pacienteNombres,
        apellidoPaterno: r.pacienteApellido,
        apellidoMaterno: r.pacienteApellidoMaterno,
      }) || null,
  }))

  return {
    cobrosEnPendiente: Number(cobrosRaw[0]?.total ?? 0),
    cobrosPendientes,
    resultadosPendientes,
  }
}

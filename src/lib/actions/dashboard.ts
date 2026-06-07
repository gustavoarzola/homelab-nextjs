'use server'

import { and, asc, count, desc, eq, gte, lte, sql, sum } from 'drizzle-orm'

import { db } from '@/db'
import { laboratories, nurses, patients, visitExams, visitWorkshops, visits } from '@/db/schema'
import { requireSession } from '@/lib/auth-guard'
import { formatNombre } from '@/lib/paciente'
import { calcNursePayment, calcNursePaymentBase } from '@/lib/pricing/nurse-payment'

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

  const [visitsByLaboratoryRaw, visitsByNurseRaw] = await Promise.all([
    db
      .select({
        label: sql<string>`coalesce(${laboratories.nombre}, 'None')`,
        total: count(),
      })
      .from(visits)
      .leftJoin(laboratories, sql`${visits.idLaboratorio} = ${laboratories.id}`)
      .where(and(gte(visits.fecha, start), lte(visits.fecha, end)))
      .groupBy(sql`coalesce(${laboratories.nombre}, 'None')`)
      .orderBy(desc(count()), asc(sql`coalesce(${laboratories.nombre}, 'None')`)),
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

  const visitsByLaboratory: RankingItem[] = visitsByLaboratoryRaw.map((item) => ({
    label: item.label,
    visits: Number(item.total),
  }))

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
    visitsByLaboratory,
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

export type PagoEnfermeraRow = {
  label: string
  visits: number
  monto: number
}

export async function getDashboardFinanciero(month: number, year: number) {
  await requireSession()

  const { start, end } = getMonthRange(year, month)

  const [
    facturadoRow,
    cobrosRaw,
    trasladosRow,
    cobrosPendientesRaw,
    resultadosPendientesRaw,
    pagosEnfermeraRaw,
  ] = await Promise.all([
    // Total facturado (visitas realizadas)
    db
      .select({ total: sum(visits.costo) })
      .from(visits)
      .where(and(gte(visits.fecha, start), lte(visits.fecha, end), eq(visits.estado, 'realizada'))),

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

    // Costo traslados (no_realizada)
    db
      .select({ total: sum(visits.costoTraslado) })
      .from(visits)
      .where(
        and(gte(visits.fecha, start), lte(visits.fecha, end), eq(visits.estado, 'no_realizada')),
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
          eq(visits.resultadosEnviados, false),
        ),
      )
      .orderBy(desc(visits.fecha))
      .limit(20),

    // Pagos estimados a enfermeras (base = costo total − exámenes − talleres)
    (() => {
      const sqExams = db
        .select({ idVisita: visitExams.idVisita, total: sum(visitExams.precio).as('exam_total') })
        .from(visitExams)
        .groupBy(visitExams.idVisita)
        .as('sq_exams_dash')

      const sqWorkshops = db
        .select({ idVisita: visitWorkshops.idVisita, total: sum(visitWorkshops.precio).as('ws_total') })
        .from(visitWorkshops)
        .groupBy(visitWorkshops.idVisita)
        .as('sq_workshops_dash')

      return db
        .select({
          label: sql<string>`trim(concat(${nurses.nombres}, ' ', ${nurses.apellidoPaterno}))`,
          visits: count(),
          totalBase: sql<string>`SUM(${visits.costo} - COALESCE(${sqExams.total}, 0) - COALESCE(${sqWorkshops.total}, 0))`,
          porcentaje: nurses.porcentajePago,
        })
        .from(visits)
        .innerJoin(nurses, eq(visits.idEnfermera, nurses.id))
        .leftJoin(sqExams, eq(visits.id, sqExams.idVisita))
        .leftJoin(sqWorkshops, eq(visits.id, sqWorkshops.idVisita))
        .where(
          and(gte(visits.fecha, start), lte(visits.fecha, end), eq(visits.estado, 'realizada')),
        )
        .groupBy(nurses.id, nurses.nombres, nurses.apellidoPaterno, nurses.porcentajePago)
        .orderBy(desc(sql`SUM(${visits.costo} - COALESCE(${sqExams.total}, 0) - COALESCE(${sqWorkshops.total}, 0))`))
    })(),
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

  const pagosEnfermeras: PagoEnfermeraRow[] = pagosEnfermeraRaw.map((r) => ({
    label: r.label,
    visits: Number(r.visits),
    monto: calcNursePayment(Number(r.totalBase ?? 0), Number(r.porcentaje ?? 67.5)),
  }))

  return {
    totalFacturado: Number(facturadoRow[0]?.total ?? 0),
    cobrosEnPendiente: Number(cobrosRaw[0]?.total ?? 0),
    costoTraslados: Number(trasladosRow[0]?.total ?? 0),
    cobrosPendientes,
    resultadosPendientes,
    pagosEnfermeras,
  }
}

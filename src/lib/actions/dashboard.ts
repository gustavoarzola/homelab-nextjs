'use server'

import { and, asc, count, desc, eq, gte, inArray, lte, sql, sum } from 'drizzle-orm'
import { union } from 'drizzle-orm/pg-core'

import { db } from '@/db'
import {
  exams,
  nurses,
  patients,
  procedures,
  visitExamResults,
  visitExams,
  visitIsapreExams,
  visitProcedures,
  visits,
  visitWorkshops,
} from '@/db/schema'
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
  value: number
}

// Una visita "efectiva" es la que realmente ocurrió; `completada` es el estado
// final posterior a `realizada` (ver ciclo de vida de visitas).
const ESTADOS_VISITA_EFECTIVA = ['realizada', 'completada']

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

  // Ítems atendidos: se cuentan solo los de visitas efectivamente realizadas.
  const visitasEfectivas = and(
    gte(visits.fecha, start),
    lte(visits.fecha, end),
    inArray(visits.estado, ESTADOS_VISITA_EFECTIVA),
  )

  // Exámenes: unión deduplicada de regulares (examenes_visitas) + isapre
  // (examenes_isapre_visitas), mismo criterio que resultadosPendientesBase().
  const examenesDeVisita = union(
    db.select({ idVisita: visitExams.idVisita, idExamen: visitExams.idExamen }).from(visitExams),
    db.select({ idVisita: visitIsapreExams.idVisita, idExamen: visitIsapreExams.idExamen }).from(visitIsapreExams),
  ).as('examenes_de_visita')

  const [visitsByNurseRaw, examenesRows, procsRows, talleresRows] = await Promise.all([
    db
      .select({
        label: sql<string>`trim(concat(${nurses.nombres}, ' ', ${nurses.apellidoPaterno}))`,
        total: count(),
      })
      .from(visits)
      .innerJoin(nurses, sql`${visits.idEnfermera} = ${nurses.id}`)
      .where(and(gte(visits.fecha, start), lte(visits.fecha, end)))
      .groupBy(nurses.id, nurses.nombres, nurses.apellidoPaterno)
      .orderBy(desc(count()), asc(nurses.apellidoPaterno), asc(nurses.nombres)),

    db
      .select({ total: count() })
      .from(examenesDeVisita)
      .innerJoin(visits, eq(examenesDeVisita.idVisita, visits.id))
      .where(visitasEfectivas),

    db
      .select({
        curaciones: sql<number>`count(*) filter (where ${procedures.categoria} = 'curaciones')`,
        otros: sql<number>`count(*) filter (where ${procedures.categoria} <> 'curaciones')`,
      })
      .from(visitProcedures)
      .innerJoin(visits, eq(visitProcedures.idVisita, visits.id))
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(visitasEfectivas),

    db
      .select({ total: count() })
      .from(visitWorkshops)
      .innerJoin(visits, eq(visitWorkshops.idVisita, visits.id))
      .where(visitasEfectivas),
  ])

  const visitsByNurse: RankingItem[] = visitsByNurseRaw.map((item) => ({
    label: item.label,
    value: Number(item.total),
  }))

  const procsRow = procsRows[0]
  const itemsAtendidosRaw: RankingItem[] = [
    { label: 'Exámenes', value: Number(examenesRows[0]?.total ?? 0) },
    { label: 'Curaciones', value: Number(procsRow?.curaciones ?? 0) },
    { label: 'Otros procedimientos', value: Number(procsRow?.otros ?? 0) },
    { label: 'Talleres', value: Number(talleresRows[0]?.total ?? 0) },
  ]
  // Si el mes no tiene ningún ítem atendido, devolver [] para que la card
  // muestre su EmptyState en vez de 4 barras al mínimo con valor 0.
  const itemsAtendidos = itemsAtendidosRaw.some((item) => item.value > 0) ? itemsAtendidosRaw : []

  return {
    chartData,
    totalVisits,
    peakVisits: peakDay.visits,
    peakLabel: peakDay.label,
    averageVisits: chartData.length ? totalVisits / chartData.length : 0,
    monthLabel: MONTHS[month - 1] ?? '',
    visitsByNurse,
    itemsAtendidos,
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
  idVisita: number
  idExamen: number
  fecha: string
  paciente: string | null
  examenNombre: string
  examenCodigo: string
  examenGrupo: string
}

const LIMITE_QUICKVIEW = 20

export async function getDashboardFinanciero(month: number, year: number) {
  await requireSession()

  const { start, end } = getMonthRange(year, month)

  // Cobros pendientes: visitas realizadas del mes sin pago registrado.
  const cobrosWhere = and(
    gte(visits.fecha, start),
    lte(visits.fecha, end),
    eq(visits.estado, 'realizada'),
    eq(visits.pagado, false),
  )

  // Resultado pendiente = par (visita, examen) de una visita realizada del mes sin fila
  // `enviado = true` en `examenes_visitas_resultados` (las filas solo existen tras guardar
  // un envío). Los exámenes de una visita son la unión —deduplicada— de los regulares y
  // los de isapre, que viven en tablas puente distintas pero apuntan al mismo catálogo.
  // Factory: cada llamada devuelve un builder nuevo (los de Drizzle son mutables al
  // encadenar `.orderBy`/`.limit`, así que no se puede compartir la instancia).
  function resultadosPendientesBase() {
    const examenesDeVisita = union(
      db.select({ idVisita: visitExams.idVisita, idExamen: visitExams.idExamen }).from(visitExams),
      db.select({ idVisita: visitIsapreExams.idVisita, idExamen: visitIsapreExams.idExamen }).from(visitIsapreExams),
    ).as('examenes_de_visita')

    return db
      .select({
        idVisita: examenesDeVisita.idVisita,
        idExamen: examenesDeVisita.idExamen,
        fecha: visits.fecha,
        examenNombre: exams.nombre,
        examenCodigo: exams.codigo,
        examenGrupo: exams.grupoExamen,
        pacienteNombres: patients.nombres,
        pacienteApellido: patients.apellidoPaterno,
        pacienteApellidoMaterno: patients.apellidoMaterno,
      })
      .from(examenesDeVisita)
      .innerJoin(visits, eq(examenesDeVisita.idVisita, visits.id))
      .innerJoin(exams, eq(examenesDeVisita.idExamen, exams.id))
      .leftJoin(patients, eq(visits.idPaciente, patients.id))
      .leftJoin(
        visitExamResults,
        and(
          eq(visitExamResults.idVisita, examenesDeVisita.idVisita),
          eq(visitExamResults.idExamen, examenesDeVisita.idExamen),
        ),
      )
      .where(
        and(
          gte(visits.fecha, start),
          lte(visits.fecha, end),
          eq(visits.estado, 'realizada'),
          sql`${visitExamResults.enviado} is not true`,
        ),
      )
  }

  const [cobrosRaw, totalCobrosRaw, cobrosPendientesRaw, resultadosPendientesRaw, totalResultadosRaw] =
    await Promise.all([
      // Total $ en pendiente de cobro
      db.select({ total: sum(visits.costo) }).from(visits).where(cobrosWhere),

      // Total de visitas con cobro pendiente (para el subtítulo del quickview)
      db.select({ total: count() }).from(visits).where(cobrosWhere),

      // Lista cobros pendientes (primeras N, 1 fila por visita)
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
        .where(cobrosWhere)
        .orderBy(desc(visits.fecha))
        .limit(LIMITE_QUICKVIEW),

      // Lista resultados pendientes (primeras N, 1 fila por examen)
      resultadosPendientesBase().orderBy(desc(visits.fecha), asc(exams.nombre)).limit(LIMITE_QUICKVIEW),

      // Total de exámenes con resultado pendiente (para el subtítulo del quickview)
      db.select({ total: count() }).from(resultadosPendientesBase().as('resultados_pendientes')),
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
    idVisita: r.idVisita,
    idExamen: r.idExamen,
    fecha: r.fecha,
    examenNombre: r.examenNombre,
    examenCodigo: r.examenCodigo,
    examenGrupo: r.examenGrupo,
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
    totalCobrosPendientes: Number(totalCobrosRaw[0]?.total ?? 0),
    resultadosPendientes,
    totalResultadosPendientes: Number(totalResultadosRaw[0]?.total ?? 0),
  }
}

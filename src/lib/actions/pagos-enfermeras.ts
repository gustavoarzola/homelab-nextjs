'use server'

import { and, asc, count, desc, eq, gte, lte, sql, sum } from 'drizzle-orm'

import { db } from '@/db'
import { nurses, patients, visitExams, visitProcedures, visits, visitSurcharges, visitWorkshops } from '@/db/schema'
import { requireSession } from '@/lib/auth-guard'
import { formatNombre } from '@/lib/paciente'
import { calcNursePayment, calcNursePaymentBase } from '@/lib/pricing/nurse-payment'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PagoEnfermeraResumenRow = {
  enfermeraId: number
  enfermera: string
  cantidadVisitas: number
  montoVisitas: number    // fee visita (costo - exams - procs - workshops - surcharges)
  montoProcs: number      // procedimientos
  montoRecargos: number   // recargos
  base: number            // costo - exams - workshops
  porcentaje: number
  pagoEstimado: number
}

type Params = {
  month: number
  year: number
  enfermeraId?: string
}

// ─── searchPagosEnfermerasMensual ─────────────────────────────────────────────

export async function searchPagosEnfermerasMensual(
  params: Params,
): Promise<{ rows: PagoEnfermeraResumenRow[] }> {
  await requireSession()

  const { month, year, enfermeraId } = params

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`

  const conditions = [
    eq(visits.estado, 'realizada'),
    gte(visits.fecha, start),
    lte(visits.fecha, end),
  ]
  if (enfermeraId) conditions.push(eq(visits.idEnfermera, Number(enfermeraId)))

  const sqExams = db
    .select({ idVisita: visitExams.idVisita, total: sum(visitExams.precio).as('exam_total') })
    .from(visitExams)
    .groupBy(visitExams.idVisita)
    .as('sq_exams')

  const sqProcs = db
    .select({ idVisita: visitProcedures.idVisita, total: sum(visitProcedures.precio).as('proc_total') })
    .from(visitProcedures)
    .groupBy(visitProcedures.idVisita)
    .as('sq_procs')

  const sqWorkshops = db
    .select({ idVisita: visitWorkshops.idVisita, total: sum(visitWorkshops.precio).as('ws_total') })
    .from(visitWorkshops)
    .groupBy(visitWorkshops.idVisita)
    .as('sq_workshops')

  const sqSurcharges = db
    .select({ idVisita: visitSurcharges.idVisita, total: sum(visitSurcharges.precio).as('sc_total') })
    .from(visitSurcharges)
    .groupBy(visitSurcharges.idVisita)
    .as('sq_surcharges')

  const rowsRaw = await db
    .select({
      enfermeraId: nurses.id,
      enfermera: sql<string>`trim(concat(${nurses.nombres}, ' ', ${nurses.apellidoPaterno}))`,
      cantidadVisitas: count(),
      sumCosto: sql<string>`SUM(${visits.costo})`,
      sumExams: sql<string>`SUM(COALESCE(${sqExams.total}, 0))`,
      sumProcs: sql<string>`SUM(COALESCE(${sqProcs.total}, 0))`,
      sumWorkshops: sql<string>`SUM(COALESCE(${sqWorkshops.total}, 0))`,
      sumSurcharges: sql<string>`SUM(COALESCE(${sqSurcharges.total}, 0))`,
      porcentaje: nurses.porcentajePago,
    })
    .from(visits)
    .innerJoin(nurses, eq(visits.idEnfermera, nurses.id))
    .leftJoin(sqExams, eq(visits.id, sqExams.idVisita))
    .leftJoin(sqProcs, eq(visits.id, sqProcs.idVisita))
    .leftJoin(sqWorkshops, eq(visits.id, sqWorkshops.idVisita))
    .leftJoin(sqSurcharges, eq(visits.id, sqSurcharges.idVisita))
    .where(and(...conditions))
    .groupBy(nurses.id, nurses.nombres, nurses.apellidoPaterno, nurses.porcentajePago)
    .orderBy(asc(nurses.apellidoPaterno), asc(nurses.nombres))

  const rows: PagoEnfermeraResumenRow[] = rowsRaw.map((r) => {
    const costo = Number(r.sumCosto)
    const examSum = Number(r.sumExams)
    const procSum = Number(r.sumProcs)
    const workshopSum = Number(r.sumWorkshops)
    const surchargeSum = Number(r.sumSurcharges)
    const base = calcNursePaymentBase(costo, examSum, workshopSum)
    const porcentaje = Number(r.porcentaje ?? 67.5)
    const montoVisitas = Math.max(0, costo - examSum - procSum - workshopSum - surchargeSum)

    return {
      enfermeraId: r.enfermeraId,
      enfermera: r.enfermera,
      cantidadVisitas: Number(r.cantidadVisitas),
      montoVisitas,
      montoProcs: procSum,
      montoRecargos: surchargeSum,
      base,
      porcentaje,
      pagoEstimado: calcNursePayment(base, porcentaje),
    }
  })

  return { rows }
}

// ─── getPagoEnfermeraDetalle ──────────────────────────────────────────────────

export type PagoVisitaDetalleRow = {
  id: number
  fecha: string
  hora: string | null
  paciente: string | null
  feeVisita: number
  procedimientos: number
  recargos: number
  base: number
  porcentaje: number
  pagoEstimado: number
}

export type PagoEnfermeraDetalle = {
  enfermeraId: number
  enfermera: string
  porcentaje: number
  cantidadVisitas: number
  baseTotal: number
  pagoTotal: number
  rows: PagoVisitaDetalleRow[]
}

export async function getPagoEnfermeraDetalle(
  enfermeraId: number,
  month: number,
  year: number,
): Promise<PagoEnfermeraDetalle | null> {
  await requireSession()

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`

  const sqExams = db
    .select({ idVisita: visitExams.idVisita, total: sum(visitExams.precio).as('exam_total') })
    .from(visitExams)
    .groupBy(visitExams.idVisita)
    .as('sq_exams_det')

  const sqProcs = db
    .select({ idVisita: visitProcedures.idVisita, total: sum(visitProcedures.precio).as('proc_total') })
    .from(visitProcedures)
    .groupBy(visitProcedures.idVisita)
    .as('sq_procs_det')

  const sqWorkshops = db
    .select({ idVisita: visitWorkshops.idVisita, total: sum(visitWorkshops.precio).as('ws_total') })
    .from(visitWorkshops)
    .groupBy(visitWorkshops.idVisita)
    .as('sq_workshops_det')

  const sqSurcharges = db
    .select({ idVisita: visitSurcharges.idVisita, total: sum(visitSurcharges.precio).as('sc_total') })
    .from(visitSurcharges)
    .groupBy(visitSurcharges.idVisita)
    .as('sq_surcharges_det')

  const [rowsRaw, nurseRow] = await Promise.all([
    db
      .select({
        id: visits.id,
        fecha: visits.fecha,
        hora: visits.hora,
        pacienteNombres: patients.nombres,
        pacienteApellido: patients.apellidoPaterno,
        pacienteApellidoMaterno: patients.apellidoMaterno,
        costo: visits.costo,
        examSum: sql<string>`COALESCE(${sqExams.total}, 0)`,
        procSum: sql<string>`COALESCE(${sqProcs.total}, 0)`,
        workshopSum: sql<string>`COALESCE(${sqWorkshops.total}, 0)`,
        surchargeSum: sql<string>`COALESCE(${sqSurcharges.total}, 0)`,
        porcentaje: nurses.porcentajePago,
      })
      .from(visits)
      .innerJoin(nurses, eq(visits.idEnfermera, nurses.id))
      .leftJoin(patients, eq(visits.idPaciente, patients.id))
      .leftJoin(sqExams, eq(visits.id, sqExams.idVisita))
      .leftJoin(sqProcs, eq(visits.id, sqProcs.idVisita))
      .leftJoin(sqWorkshops, eq(visits.id, sqWorkshops.idVisita))
      .leftJoin(sqSurcharges, eq(visits.id, sqSurcharges.idVisita))
      .where(
        and(
          eq(visits.idEnfermera, enfermeraId),
          eq(visits.estado, 'realizada'),
          gte(visits.fecha, start),
          lte(visits.fecha, end),
        ),
      )
      .orderBy(desc(visits.fecha), asc(visits.hora)),

    db
      .select({
        nombre: sql<string>`trim(concat(${nurses.nombres}, ' ', ${nurses.apellidoPaterno}))`,
        porcentaje: nurses.porcentajePago,
      })
      .from(nurses)
      .where(eq(nurses.id, enfermeraId))
      .limit(1),
  ])

  if (!nurseRow[0]) return null

  const porcentaje = Number(nurseRow[0].porcentaje ?? 67.5)

  const rows: PagoVisitaDetalleRow[] = rowsRaw.map((r) => {
    const costo = Number(r.costo)
    const examSum = Number(r.examSum)
    const procSum = Number(r.procSum)
    const workshopSum = Number(r.workshopSum)
    const surchargeSum = Number(r.surchargeSum)
    const base = calcNursePaymentBase(costo, examSum, workshopSum)
    const feeVisita = Math.max(0, costo - examSum - procSum - workshopSum - surchargeSum)

    return {
      id: r.id,
      fecha: r.fecha,
      hora: r.hora,
      paciente:
        formatNombre({
          nombres: r.pacienteNombres,
          apellidoPaterno: r.pacienteApellido,
          apellidoMaterno: r.pacienteApellidoMaterno,
        }) || null,
      feeVisita,
      procedimientos: procSum,
      recargos: surchargeSum,
      base,
      porcentaje,
      pagoEstimado: calcNursePayment(base, porcentaje),
    }
  })

  const baseTotal = rows.reduce((s, r) => s + r.base, 0)

  return {
    enfermeraId,
    enfermera: nurseRow[0].nombre,
    porcentaje,
    cantidadVisitas: rows.length,
    baseTotal,
    pagoTotal: calcNursePayment(baseTotal, porcentaje),
    rows,
  }
}

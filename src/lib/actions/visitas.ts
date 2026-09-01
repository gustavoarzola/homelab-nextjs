'use server'

import { z } from 'zod'
import { db } from '@/db'
import { contactOrigins, visits, visitProcedures, visitExams, visitIsapreExams, visitWorkshops, visitSurcharges, visitExamResults, workshops, patients, patientPhones, nurses, procedures, exams, healthInsurances, addresses, elderlyResidences, surchargeTypes } from '@/db/schema'
import { eq, ne, count, and, or, ilike, gte, lte, asc, desc, SQL, sql, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getTiposRecargosForSelect } from './catalogos'
import type { SearchParams, Result } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'
import { withQuery, withAction, ActionError, type ActionResult } from '@/lib/with-action'
import { formatNombre } from '@/lib/paciente'
import { actualizarCostoVisitaPersistida, resolverPrecioVisitaEnfermeria } from '@/lib/pricing/visitas'
import { calcNursePaymentBreakdown, DEFAULT_PORCENTAJE_PAGO } from '@/lib/pricing/nurse-payment'
import type { VisitaFormPricingContext } from '@/lib/pricing/visita-preview'
import { parseFormDataWithArrays, fields } from '@/lib/validation'

// ─── getEnfermeras ────────────────────────────────────────────────────────────

export async function getEnfermeras(): Promise<{ id: number; nombre: string }[]> {
  return withQuery(async () => {
    const rows = await db
      .select({ id: nurses.id, nombres: nurses.nombres, apellidoPaterno: nurses.apellidoPaterno })
      .from(nurses)
      .where(eq(nurses.activo, true))
      .orderBy(asc(nurses.apellidoPaterno))
    return rows.map((r) => ({ id: r.id, nombre: formatNombre(r) }))
  })
}

// ─── getTiposRecargos ──────────────────────────────────────────────────────────

export async function getTiposRecargos(): Promise<{ id: number; label: string; precio: number }[]> {
  return getTiposRecargosForSelect()
}

// ─── Detail type ──────────────────────────────────────────────────────────────

export type VisitaDetalle = {
  id: number
  fecha: string
  hora: string | null
  estado: string
  costo: number
  montoInsumos: number
  descuentoTipo: 'monto' | 'porcentaje'
  descuentoValor: number
  montoDescuento: number
  montoVisitaOriginal: number
  descuentoAfectaPagoEnfermera: boolean
  montoDescuentoProcedimientos: number
  descuentoProcedimientosAfectaPagoEnfermera: boolean
  idPaciente: number | null
  idEnfermera: number | null
  numeroBoleta: string
  tipoDocumento: string
  numeroAtencion: number | null
  idOrigenContacto: number | null
  informacionAdicional: string
  pagado: boolean
  metodoPago: string | null
  fechaPago: string | null
  resultadosEnviadosCount: number
  resultadosTotalCount: number
  costoTraslado: number
  conceptoNoRealizada: string | null
  motivoCancelacion: string | null
  cobraVisita: boolean
  keyOrdenMedica: string | null
  procedureIds: number[]
  procedurePrices: { idProcedimiento: number; precio: number; descuento: number }[]
  examIds: number[]
  examPrices: { idExamen: number; precio: number }[]
  tallerIds: number[]
  tallerPrices: { idTaller: number; precio: number }[]
  surchargeIds: number[]
  surchargePrices: { idTipoRecargo: number; precio: number }[]
  isapreExams: { idExamen: number; valorCompleto: number; valorPagar: number; idPrevision: number | null }[]
}

// ─── Lifecycle detail type ─────────────────────────────────────────────────────

export type VisitaLifecycleDetalle = {
  id: number
  fecha: string
  hora: string | null
  estado: string
  costo: number
  montoInsumos: number
  cobraVisita: boolean
  descuentoTipo: 'monto' | 'porcentaje'
  descuentoValor: number
  montoDescuento: number
  montoVisitaOriginal: number
  descuentoAfectaPagoEnfermera: boolean
  montoDescuentoProcedimientos: number
  descuentoProcedimientosAfectaPagoEnfermera: boolean
  informacionAdicional: string
  origenContacto: string | null
  idPaciente: number | null
  pacienteNombre: string | null
  pacienteIdentificador: string | null
  pacientePrevision: string | null
  pacienteTelefonos: string[]
  pacienteDireccion: string | null
  idEnfermera: number | null
  enfermeraNombre: string | null
  procedimientos: { id: number; nombre: string; codigo: string | null; precio: number; descuento: number }[]
  examenes: { id: number; nombre: string; codigo: string; grupoExamen: string; precio: number }[]
  isapreExams: { id: number; nombre: string; codigo: string | null; valorCompleto: number; valorPagar: number }[]
  talleres: { id: number; nombre: string; precio: number }[]
  surcharges: { id: number; tipoNombre: string; precio: number }[]
  precioVisita: number | null
  tipoDocumento: string
  numeroBoleta: string
  numeroAtencion: number | null
  pagado: boolean
  metodoPago: string | null
  fechaPago: string | null
  examenResultados: { idExamen: number; enviado: boolean; fechaEnvio: string | null }[]
  resultadosEnviadosCount: number
  resultadosTotalCount: number
  costoTraslado: number
  conceptoNoRealizada: string | null
  motivoCancelacion: string | null
}

// ─── Row type ─────────────────────────────────────────────────────────────────

export type VisitaRow = {
  id: number
  activo: boolean      // false when cancelada → renders at 50% opacity
  fecha: string        // YYYY-MM-DD
  hora: string | null
  estado: string
  costo: number
  idPaciente: number | null
  paciente: string | null
  enfermera: string | null
}

// ─── Visitas query helpers (internal) ─────────────────────────────────────────

function buildVisitasWhere(filters: SearchParams['filters']): SQL | undefined {
  const buscar = (filters.buscar as string | undefined)?.trim()
  const estado = (filters.estado as string | undefined)?.trim()
  const enfermeraId = (filters.enfermera as string | undefined)?.trim()
  const fechaInicio = (filters.fechaInicio as string | undefined)?.trim()
  const fechaFin = (filters.fechaFin as string | undefined)?.trim()

  const conditions: SQL[] = []
  if (buscar) {
    const normalized = buscar.replace(/[\.\-\s]/g, '').toUpperCase()
    const fullName = sql`(${patients.nombres} || ' ' || ${patients.apellidoPaterno} || ' ' || COALESCE(${patients.apellidoMaterno}, ''))`
    conditions.push(
      or(
        sql`unaccent(${fullName}) ILIKE unaccent(${'%' + buscar + '%'})`,
        ilike(patients.identificador, `%${normalized}%`),
      )!,
    )
  }
  if (estado) {
    const estados = estado.split(',').map((e) => e.trim()).filter(Boolean)
    conditions.push(estados.length > 1 ? inArray(visits.estado, estados) : eq(visits.estado, estados[0]!))
  }
  if (enfermeraId) {
    const enfermeraIds = enfermeraId.split(',').map((e) => Number(e.trim())).filter(Boolean)
    conditions.push(enfermeraIds.length > 1 ? inArray(visits.idEnfermera, enfermeraIds) : eq(visits.idEnfermera, enfermeraIds[0]!))
  }
  if (fechaInicio) conditions.push(gte(visits.fecha, fechaInicio))
  if (fechaFin) conditions.push(lte(visits.fecha, fechaFin))

  return conditions.length ? and(...conditions) : undefined
}

function buildVisitasOrder(sort: SearchParams['sort']): SQL {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortCols: Record<string, any> = {
    fecha: visits.fecha,
    paciente: patients.apellidoPaterno,
    estado: visits.estado,
    costo: visits.costo,
  }
  const sortCol = (sort?.key && sortCols[sort.key]) ?? visits.fecha
  return sort?.dir === 'asc' ? asc(sortCol) : desc(sortCol)
}

const visitaRowSelect = {
  id: visits.id,
  fecha: visits.fecha,
  hora: visits.hora,
  estado: visits.estado,
  costo: visits.costo,
  idPaciente: visits.idPaciente,
  pacienteNombres: patients.nombres,
  pacienteApellido: patients.apellidoPaterno,
  pacienteApellidoMaterno: patients.apellidoMaterno,
  enfermeraNombres: nurses.nombres,
  enfermeraApellido: nurses.apellidoPaterno,
  enfermeraApellidoMaterno: nurses.apellidoMaterno,
}

type VisitaRawRow = {
  id: number
  fecha: string
  hora: string | null
  estado: string
  costo: number
  idPaciente: number | null
  pacienteNombres: string | null
  pacienteApellido: string | null
  pacienteApellidoMaterno: string | null
  enfermeraNombres: string | null
  enfermeraApellido: string | null
  enfermeraApellidoMaterno: string | null
}

function mapVisitaRow(r: VisitaRawRow): VisitaRow {
  return {
    id: r.id,
    activo: !['cancelada', 'no_realizada'].includes(r.estado),
    fecha: r.fecha,
    hora: r.hora,
    estado: r.estado,
    costo: r.costo,
    idPaciente: r.idPaciente,
    paciente: formatNombre({
      nombres: r.pacienteNombres,
      apellidoPaterno: r.pacienteApellido,
      apellidoMaterno: r.pacienteApellidoMaterno,
    }) || null,
    enfermera: formatNombre({
      nombres: r.enfermeraNombres,
      apellidoPaterno: r.enfermeraApellido,
      apellidoMaterno: r.enfermeraApellidoMaterno,
    }) || null,
  }
}

// ─── searchVisitas ────────────────────────────────────────────────────────────

export async function searchVisitas(
  params: SearchParams,
): Promise<{ rows: VisitaRow[]; total: number }> {
  return withQuery(async () => {
  const { filters, sort, page, pageSize } = params
  const where = buildVisitasWhere(filters)
  const order = buildVisitasOrder(sort)

  const [countRow] = await db
    .select({ total: count() })
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .where(where)

  const rawRows = await db
    .select(visitaRowSelect)
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .leftJoin(nurses, eq(visits.idEnfermera, nurses.id))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { rows: rawRows.map(mapVisitaRow), total: Number(countRow?.total ?? 0) }
  })
}

// ─── listVisitasForExport ─────────────────────────────────────────────────────

export async function listVisitasForExport(
  filters: SearchParams['filters'],
  sort: SearchParams['sort'],
): Promise<VisitaRow[]> {
  return withQuery(async () => {
    const where = buildVisitasWhere(filters)
    const order = buildVisitasOrder(sort)
    const rawRows = await db
      .select(visitaRowSelect)
      .from(visits)
      .leftJoin(patients, eq(visits.idPaciente, patients.id))
      .leftJoin(nurses, eq(visits.idEnfermera, nurses.id))
      .where(where)
      .orderBy(order)
    return rawRows.map(mapVisitaRow)
  })
}


// ─── listVisitasForReport ─────────────────────────────────────────────────────

export type VisitaReportRow = {
  id: number
  fecha: string
  estado: string
  paciente: string | null
  rut: string | null
  comuna: string | null
  enfermera: string | null
  origenContacto: string | null
  procedimientos: string   // nombres separados por '\n'
  subtotalProcedimientos: number
  examenes: string         // nombres separados por '\n'
  talleres: string         // nombres separados por '\n'
  subtotalTalleres: number
  recargos: string         // nombres separados por '\n'
  subtotalRecargos: number
  metodoPago: string | null
  montoVisita: number
  montoDescuento: number
  descuentoAfectaPagoEnfermera: boolean
  montoDescuentoProcedimientos: number
  descuentoProcedimientosAfectaPagoEnfermera: boolean
  subtotalExamenes: number
  montoInsumos: number
  totalBoleta: number
  pagado: boolean
  fechaPago: string | null
  pagoEnfermera: number
  hogar: string | null
  isapre: string | null
  /** Suma de exámenes regulares con grupoExamen 'imalab' o 'imalab fonasa 3' (subconjunto de subtotalExamenes). */
  imedFonasa: number
  /** Suma de valorCompleto de exámenes isapre — solo referencia, no es lo que paga el paciente. */
  imedIsapreTotal: number
  /** Suma de valorPagar de exámenes isapre — lo que realmente cobra el paciente por ese laboratorio. */
  imedIsapreBono: number
}

// Grupos de examenes.grupoExamen que se pagan por la vía Fonasa/Imalab (ver src/lib/exam-grupos.ts).
const IMED_FONASA_GRUPOS = ['imalab', 'imalab fonasa 3']

/**
 * Reporte financiero por visita (usado por /reportes). A diferencia de
 * `listVisitasForExport`, incluye los campos de cobro/previsión que pidió el
 * cliente y agrega nombres de procedimientos/exámenes en una sola celda
 * (separados por salto de línea) en vez de traerlos como filas aparte.
 */
export async function listVisitasForReport(
  filters: SearchParams['filters'],
): Promise<VisitaReportRow[]> {
  return withQuery(async () => {
    const where = buildVisitasWhere(filters)

    const baseRows = await db
      .select({
        id: visits.id,
        fecha: visits.fecha,
        estado: visits.estado,
        origenContacto: contactOrigins.nombre,
        metodoPago: visits.metodoPago,
        montoVisita: visits.montoVisitaOriginal,
        montoDescuento: visits.montoDescuento,
        descuentoAfectaPagoEnfermera: visits.descuentoAfectaPagoEnfermera,
        montoDescuentoProcedimientos: visits.montoDescuentoProcedimientos,
        descuentoProcedimientosAfectaPagoEnfermera: visits.descuentoProcedimientosAfectaPagoEnfermera,
        montoInsumos: visits.montoInsumos,
        totalBoleta: visits.costo,
        pagado: visits.pagado,
        fechaPago: visits.fechaPago,
        pacienteNombres: patients.nombres,
        pacienteApellidoPaterno: patients.apellidoPaterno,
        pacienteApellidoMaterno: patients.apellidoMaterno,
        rut: patients.identificador,
        comuna: addresses.areaAdministrativa3,
        hogar: elderlyResidences.nombre,
        isapre: healthInsurances.nombre,
        enfermeraNombres: nurses.nombres,
        enfermeraApellidoPaterno: nurses.apellidoPaterno,
        enfermeraApellidoMaterno: nurses.apellidoMaterno,
        porcentajePago: nurses.porcentajePago,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.idPaciente, patients.id))
      .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
      .leftJoin(elderlyResidences, eq(patients.idResidenciaAdulto, elderlyResidences.id))
      .leftJoin(healthInsurances, eq(patients.idCompaniaSeguro, healthInsurances.id))
      .leftJoin(nurses, eq(visits.idEnfermera, nurses.id))
      .leftJoin(contactOrigins, eq(visits.idOrigenContacto, contactOrigins.id))
      .where(where)
      .orderBy(buildVisitasOrder({ key: 'fecha', dir: 'asc' }))

    if (baseRows.length === 0) return []

    const ids = baseRows.map((r) => r.id)

    const [procRows, examRows, isapreExamRows, workshopRows, surchargeRows] = await Promise.all([
      db
        .select({ idVisita: visitProcedures.idVisita, nombre: procedures.nombre, precio: visitProcedures.precio })
        .from(visitProcedures)
        .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
        .where(inArray(visitProcedures.idVisita, ids)),
      db
        .select({ idVisita: visitExams.idVisita, nombre: exams.nombre, precio: visitExams.precio, grupoExamen: exams.grupoExamen })
        .from(visitExams)
        .innerJoin(exams, eq(visitExams.idExamen, exams.id))
        .where(inArray(visitExams.idVisita, ids)),
      db
        .select({ idVisita: visitIsapreExams.idVisita, nombre: exams.nombre, valorPagar: visitIsapreExams.valorPagar, valorCompleto: visitIsapreExams.valorCompleto })
        .from(visitIsapreExams)
        .innerJoin(exams, eq(visitIsapreExams.idExamen, exams.id))
        .where(inArray(visitIsapreExams.idVisita, ids)),
      db
        .select({ idVisita: visitWorkshops.idVisita, nombre: workshops.nombre, precio: visitWorkshops.precio })
        .from(visitWorkshops)
        .innerJoin(workshops, eq(visitWorkshops.idTaller, workshops.id))
        .where(inArray(visitWorkshops.idVisita, ids)),
      db
        .select({ idVisita: visitSurcharges.idVisita, nombre: surchargeTypes.nombre, precio: visitSurcharges.precio })
        .from(visitSurcharges)
        .innerJoin(surchargeTypes, eq(visitSurcharges.idTipoRecargo, surchargeTypes.id))
        .where(inArray(visitSurcharges.idVisita, ids)),
    ])

    const procNamesByVisita = new Map<number, string[]>()
    const procSubtotalByVisita = new Map<number, number>()
    for (const p of procRows) {
      const arr = procNamesByVisita.get(p.idVisita) ?? []
      arr.push(p.nombre)
      procNamesByVisita.set(p.idVisita, arr)
      procSubtotalByVisita.set(p.idVisita, (procSubtotalByVisita.get(p.idVisita) ?? 0) + p.precio)
    }

    const workshopNamesByVisita = new Map<number, string[]>()
    const workshopSubtotalByVisita = new Map<number, number>()
    for (const w of workshopRows) {
      const arr = workshopNamesByVisita.get(w.idVisita) ?? []
      arr.push(w.nombre)
      workshopNamesByVisita.set(w.idVisita, arr)
      workshopSubtotalByVisita.set(w.idVisita, (workshopSubtotalByVisita.get(w.idVisita) ?? 0) + w.precio)
    }

    const surchargeNamesByVisita = new Map<number, string[]>()
    const surchargeSubtotalByVisita = new Map<number, number>()
    for (const s of surchargeRows) {
      const arr = surchargeNamesByVisita.get(s.idVisita) ?? []
      arr.push(s.nombre)
      surchargeNamesByVisita.set(s.idVisita, arr)
      surchargeSubtotalByVisita.set(s.idVisita, (surchargeSubtotalByVisita.get(s.idVisita) ?? 0) + s.precio)
    }

    const examNamesByVisita = new Map<number, string[]>()
    const examSubtotalByVisita = new Map<number, number>()
    const imedFonasaByVisita = new Map<number, number>()
    const imedIsapreTotalByVisita = new Map<number, number>()
    const imedIsapreBonoByVisita = new Map<number, number>()
    for (const e of examRows) {
      const arr = examNamesByVisita.get(e.idVisita) ?? []
      arr.push(e.nombre)
      examNamesByVisita.set(e.idVisita, arr)
      examSubtotalByVisita.set(e.idVisita, (examSubtotalByVisita.get(e.idVisita) ?? 0) + e.precio)
      if (IMED_FONASA_GRUPOS.includes(e.grupoExamen)) {
        imedFonasaByVisita.set(e.idVisita, (imedFonasaByVisita.get(e.idVisita) ?? 0) + e.precio)
      }
    }
    for (const e of isapreExamRows) {
      const arr = examNamesByVisita.get(e.idVisita) ?? []
      arr.push(e.nombre)
      examNamesByVisita.set(e.idVisita, arr)
      imedIsapreTotalByVisita.set(e.idVisita, (imedIsapreTotalByVisita.get(e.idVisita) ?? 0) + e.valorCompleto)
      imedIsapreBonoByVisita.set(e.idVisita, (imedIsapreBonoByVisita.get(e.idVisita) ?? 0) + e.valorPagar)
    }

    return baseRows.map((r) => {
      const subtotalExamenes = examSubtotalByVisita.get(r.id) ?? 0
      const subtotalTalleres = workshopSubtotalByVisita.get(r.id) ?? 0

      // Exámenes (regulares e isapre), talleres e insumos no entran al pago de
      // la enfermera: la base es fee de visita + procedimientos + recargos.
      const porcentajePago = Number(r.porcentajePago ?? DEFAULT_PORCENTAJE_PAGO)
      const pagoEnfermera = calcNursePaymentBreakdown({
        procSum: procSubtotalByVisita.get(r.id) ?? 0,
        surchargeSum: surchargeSubtotalByVisita.get(r.id) ?? 0,
        montoVisitaOriginal: r.montoVisita,
        montoDescuento: r.montoDescuento,
        descuentoAfectaPagoEnfermera: r.descuentoAfectaPagoEnfermera,
        montoDescuentoProcedimientos: r.montoDescuentoProcedimientos,
        descuentoProcedimientosAfectaPagoEnfermera: r.descuentoProcedimientosAfectaPagoEnfermera,
        porcentaje: porcentajePago,
      }).pago

      return {
        id: r.id,
        fecha: r.fecha,
        estado: r.estado,
        paciente: formatNombre({
          nombres: r.pacienteNombres,
          apellidoPaterno: r.pacienteApellidoPaterno,
          apellidoMaterno: r.pacienteApellidoMaterno,
        }) || null,
        rut: r.rut,
        comuna: r.comuna,
        enfermera: r.enfermeraNombres
          ? formatNombre({
              nombres: r.enfermeraNombres,
              apellidoPaterno: r.enfermeraApellidoPaterno,
              apellidoMaterno: r.enfermeraApellidoMaterno,
            }) || null
          : null,
        origenContacto: r.origenContacto,
        procedimientos: (procNamesByVisita.get(r.id) ?? []).join('\n'),
        subtotalProcedimientos: procSubtotalByVisita.get(r.id) ?? 0,
        examenes: (examNamesByVisita.get(r.id) ?? []).join('\n'),
        talleres: (workshopNamesByVisita.get(r.id) ?? []).join('\n'),
        subtotalTalleres,
        recargos: (surchargeNamesByVisita.get(r.id) ?? []).join('\n'),
        subtotalRecargos: surchargeSubtotalByVisita.get(r.id) ?? 0,
        metodoPago: r.metodoPago,
        montoVisita: r.montoVisita,
        montoDescuento: r.montoDescuento,
        descuentoAfectaPagoEnfermera: r.descuentoAfectaPagoEnfermera,
        montoDescuentoProcedimientos: r.montoDescuentoProcedimientos,
        descuentoProcedimientosAfectaPagoEnfermera: r.descuentoProcedimientosAfectaPagoEnfermera,
        subtotalExamenes,
        montoInsumos: r.montoInsumos,
        totalBoleta: r.totalBoleta,
        pagado: r.pagado,
        fechaPago: r.fechaPago,
        pagoEnfermera: r.enfermeraNombres ? pagoEnfermera : 0,
        hogar: r.hogar,
        isapre: r.isapre,
        imedFonasa: imedFonasaByVisita.get(r.id) ?? 0,
        imedIsapreTotal: imedIsapreTotalByVisita.get(r.id) ?? 0,
        imedIsapreBono: imedIsapreBonoByVisita.get(r.id) ?? 0,
      }
    })
  })
}

// ─── getVisitaFormPricingContext ─────────────────────────────────────────────

export async function getVisitaFormPricingContext(
  idPaciente: number,
  examIds: number[],
): Promise<VisitaFormPricingContext> {
  return withQuery(async () => {
  const uniqueExamIds = [...new Set(examIds.filter(Boolean))]

  // Fetch exam prices and patient's commune in parallel
  const [examPriceRows, pacienteRow] = await Promise.all([
    uniqueExamIds.length > 0
      ? db.select({ id: exams.id, precio: exams.precio }).from(exams).where(inArray(exams.id, uniqueExamIds))
      : Promise.resolve([] as { id: number; precio: number }[]),
    db
      .select({ comuna: addresses.areaAdministrativa3 })
      .from(patients)
      .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
      .where(eq(patients.id, idPaciente))
      .then((r) => r[0] ?? null),
  ])

  const comuna = pacienteRow?.comuna ?? null
  const { precio: nursingVisitPrice, comunaEncontrada } = await resolverPrecioVisitaEnfermeria(db, comuna)

  return {
    examPrices: uniqueExamIds.map((idExamen) => ({
      idExamen,
      precioActual: examPriceRows.find((r) => r.id === idExamen)?.precio ?? 0,
    })),
    nursingVisitPrice,
    comunaPaciente: comuna,
    comunaEncontrada,
  }
  })
}

// ─── getVisita ────────────────────────────────────────────────────────────────

export async function getVisita(id: number): Promise<VisitaDetalle | null> {
  return withQuery(async () => {
  const [visit] = await db.select().from(visits).where(eq(visits.id, id))
  if (!visit) return null

  const [procs, exams_, isapre_, talleres_, surcharges_] = await Promise.all([
    db.select({ idProcedimiento: visitProcedures.idProcedimiento, precio: visitProcedures.precio, descuento: visitProcedures.descuento }).from(visitProcedures).where(eq(visitProcedures.idVisita, id)),
    db.select({ idExamen: visitExams.idExamen, precio: visitExams.precio }).from(visitExams).where(eq(visitExams.idVisita, id)),
    db.select({ idExamen: visitIsapreExams.idExamen, valorCompleto: visitIsapreExams.valorCompleto, valorPagar: visitIsapreExams.valorPagar, idPrevision: visitIsapreExams.idPrevision }).from(visitIsapreExams).where(eq(visitIsapreExams.idVisita, id)),
    db.select({ idTaller: visitWorkshops.idTaller, precio: visitWorkshops.precio }).from(visitWorkshops).where(eq(visitWorkshops.idVisita, id)),
    db.select({ idTipoRecargo: visitSurcharges.idTipoRecargo, precio: visitSurcharges.precio }).from(visitSurcharges).where(eq(visitSurcharges.idVisita, id)),
  ])

  return {
    id: visit.id,
    fecha: visit.fecha,
    hora: visit.hora ?? null,
    estado: visit.estado,
    costo: visit.costo,
    montoInsumos: visit.montoInsumos,
    descuentoTipo: visit.descuentoTipo as 'monto' | 'porcentaje',
    descuentoValor: visit.descuentoValor,
    montoDescuento: visit.montoDescuento,
    montoVisitaOriginal: visit.montoVisitaOriginal,
    descuentoAfectaPagoEnfermera: visit.descuentoAfectaPagoEnfermera,
    montoDescuentoProcedimientos: visit.montoDescuentoProcedimientos,
    descuentoProcedimientosAfectaPagoEnfermera: visit.descuentoProcedimientosAfectaPagoEnfermera,
    idPaciente: visit.idPaciente ?? null,
    idEnfermera: visit.idEnfermera ?? null,
    numeroBoleta: visit.numeroBoleta ?? '',
    tipoDocumento: visit.tipoDocumento ?? '',
    numeroAtencion: visit.numeroAtencion ?? null,
    idOrigenContacto: visit.idOrigenContacto ?? null,
    informacionAdicional: visit.informacionAdicional ?? '',
    pagado: visit.pagado,
    metodoPago: visit.metodoPago ?? null,
    fechaPago: visit.fechaPago ?? null,
    resultadosEnviadosCount: visit.resultadosEnviadosCount,
    resultadosTotalCount: visit.resultadosTotalCount,
    costoTraslado: visit.costoTraslado,
    conceptoNoRealizada: visit.conceptoNoRealizada ?? null,
    motivoCancelacion: visit.motivoCancelacion ?? null,
    cobraVisita: visit.cobraVisita,
    keyOrdenMedica: visit.keyOrdenMedica ?? null,
    procedureIds: procs.map((p) => p.idProcedimiento),
    procedurePrices: procs.map((p) => ({ idProcedimiento: p.idProcedimiento, precio: p.precio, descuento: p.descuento })),
    examIds: exams_.map((e) => e.idExamen),
    examPrices: exams_.map((e) => ({ idExamen: e.idExamen, precio: e.precio })),
    isapreExams: isapre_.map((e) => ({ idExamen: e.idExamen, valorCompleto: e.valorCompleto, valorPagar: e.valorPagar, idPrevision: e.idPrevision })),
    tallerIds: talleres_.map((t) => t.idTaller),
    tallerPrices: talleres_.map((t) => ({ idTaller: t.idTaller, precio: t.precio })),
    surchargeIds: surcharges_.map((s) => s.idTipoRecargo),
    surchargePrices: surcharges_.map((s) => ({ idTipoRecargo: s.idTipoRecargo, precio: s.precio })),
  }
  })
}

// ─── getVisitaLifecycle ───────────────────────────────────────────────────────

export async function getVisitaLifecycle(id: number): Promise<VisitaLifecycleDetalle | null> {
  return withQuery(async () => {
    await requireSession()
    const [visit] = await db.select().from(visits).where(eq(visits.id, id))
    if (!visit) return null

    const [procs, exams_, isapre_, talleres_, surcharges_, examResults_] = await Promise.all([
      db.select({ idProcedimiento: visitProcedures.idProcedimiento, precio: visitProcedures.precio, descuento: visitProcedures.descuento }).from(visitProcedures).where(eq(visitProcedures.idVisita, id)),
      db.select({ idExamen: visitExams.idExamen, precio: visitExams.precio }).from(visitExams).where(eq(visitExams.idVisita, id)),
      db.select({ idExamen: visitIsapreExams.idExamen, valorCompleto: visitIsapreExams.valorCompleto, valorPagar: visitIsapreExams.valorPagar }).from(visitIsapreExams).where(eq(visitIsapreExams.idVisita, id)),
      db.select({ idTaller: visitWorkshops.idTaller, precio: visitWorkshops.precio }).from(visitWorkshops).where(eq(visitWorkshops.idVisita, id)),
      db.select({ idTipoRecargo: visitSurcharges.idTipoRecargo, precio: visitSurcharges.precio }).from(visitSurcharges).where(eq(visitSurcharges.idVisita, id)),
      db.select({ idExamen: visitExamResults.idExamen, enviado: visitExamResults.enviado, fechaEnvio: visitExamResults.fechaEnvio }).from(visitExamResults).where(eq(visitExamResults.idVisita, id)),
    ])

    // Resolve names for procedures, exams, talleres, surcharges
    const procIds = procs.map((p) => p.idProcedimiento)
    const examIds = exams_.map((e) => e.idExamen)
    const isapreExamIds = isapre_.map((e) => e.idExamen)
    const tallerIds = talleres_.map((t) => t.idTaller)
    const surchargeIds = surcharges_.map((s) => s.idTipoRecargo)
    const allExamIds = [...new Set([...examIds, ...isapreExamIds])]

    const [procMeta, examMeta, tallerMeta, surchargeMeta, patientRow, nurseRow, origenRow] = await Promise.all([
      procIds.length > 0 ? db.select({ id: procedures.id, nombre: procedures.nombre, codigo: procedures.codigo }).from(procedures).where(inArray(procedures.id, procIds)) : [],
      allExamIds.length > 0 ? db.select({ id: exams.id, nombre: exams.nombre, codigo: exams.codigo, grupoExamen: exams.grupoExamen }).from(exams).where(inArray(exams.id, allExamIds)) : [],
      tallerIds.length > 0 ? db.select({ id: workshops.id, nombre: workshops.nombre }).from(workshops).where(inArray(workshops.id, tallerIds)) : [],
      surchargeIds.length > 0 ? db.select({ id: surchargeTypes.id, nombre: surchargeTypes.nombre }).from(surchargeTypes).where(inArray(surchargeTypes.id, surchargeIds)) : [],
      visit.idPaciente
        ? db.select({
            nombres: patients.nombres,
            apellidoPaterno: patients.apellidoPaterno,
            apellidoMaterno: patients.apellidoMaterno,
            identificador: patients.identificador,
            idCompaniaSeguro: patients.idCompaniaSeguro,
            idDireccion: patients.idDireccion,
          }).from(patients).where(eq(patients.id, visit.idPaciente)).then((r) => r[0] ?? null)
        : Promise.resolve(null),
      visit.idEnfermera
        ? db.select({ nombres: nurses.nombres, apellidoPaterno: nurses.apellidoPaterno, apellidoMaterno: nurses.apellidoMaterno }).from(nurses).where(eq(nurses.id, visit.idEnfermera)).then((r) => r[0] ?? null)
        : Promise.resolve(null),
      visit.idOrigenContacto
        ? db.select({ nombre: contactOrigins.nombre }).from(contactOrigins).where(eq(contactOrigins.id, visit.idOrigenContacto)).then((r) => r[0] ?? null)
        : Promise.resolve(null),
    ])

    // Fetch patient address, phones, and prevision in parallel if patient exists
    const [addressRow, telefonosRows, previsionRow] = await Promise.all([
      patientRow?.idDireccion
        ? db.select({ areaAdministrativa3: addresses.areaAdministrativa3, calle: addresses.calle, numero: addresses.numero }).from(addresses).where(eq(addresses.id, patientRow.idDireccion)).then((r) => r[0] ?? null)
        : Promise.resolve(null),
      visit.idPaciente
        ? db.select({ telefono: patientPhones.telefono }).from(patientPhones).where(eq(patientPhones.idPaciente, visit.idPaciente))
        : Promise.resolve([]),
      patientRow?.idCompaniaSeguro
        ? db.select({ nombre: healthInsurances.nombre }).from(healthInsurances).where(eq(healthInsurances.id, patientRow.idCompaniaSeguro)).then((r) => r[0] ?? null)
        : Promise.resolve(null),
    ])

    // Commune-based nursing visit price
    const { precio: precioVisita } = await resolverPrecioVisitaEnfermeria(db, addressRow?.areaAdministrativa3 ?? null)

    const procMetaMap = new Map((procMeta as { id: number; nombre: string; codigo: string | null }[]).map((p) => [p.id, p]))
    const examMetaMap = new Map((examMeta as { id: number; nombre: string; codigo: string; grupoExamen: string }[]).map((e) => [e.id, e]))
    const tallerMetaMap = new Map((tallerMeta as { id: number; nombre: string }[]).map((t) => [t.id, t]))
    const surchargeMetaMap = new Map((surchargeMeta as { id: number; nombre: string }[]).map((s) => [s.id, s]))

    const direccionStr = addressRow
      ? [addressRow.calle, addressRow.numero, addressRow.areaAdministrativa3].filter(Boolean).join(', ')
      : null

    return {
      id: visit.id,
      fecha: visit.fecha,
      hora: visit.hora ?? null,
      estado: visit.estado,
      costo: visit.costo,
      montoInsumos: visit.montoInsumos,
      cobraVisita: visit.cobraVisita,
      descuentoTipo: visit.descuentoTipo as 'monto' | 'porcentaje',
      descuentoValor: visit.descuentoValor,
      montoDescuento: visit.montoDescuento,
      montoVisitaOriginal: visit.montoVisitaOriginal,
      descuentoAfectaPagoEnfermera: visit.descuentoAfectaPagoEnfermera,
      montoDescuentoProcedimientos: visit.montoDescuentoProcedimientos,
      descuentoProcedimientosAfectaPagoEnfermera: visit.descuentoProcedimientosAfectaPagoEnfermera,
      informacionAdicional: visit.informacionAdicional ?? '',
      origenContacto: origenRow?.nombre ?? null,
      idPaciente: visit.idPaciente ?? null,
      pacienteNombre: patientRow ? formatNombre({ nombres: patientRow.nombres, apellidoPaterno: patientRow.apellidoPaterno, apellidoMaterno: patientRow.apellidoMaterno }) || null : null,
      pacienteIdentificador: patientRow?.identificador ?? null,
      pacientePrevision: previsionRow?.nombre ?? null,
      pacienteTelefonos: (telefonosRows as { telefono: string }[]).map((t) => t.telefono),
      pacienteDireccion: direccionStr,
      idEnfermera: visit.idEnfermera ?? null,
      enfermeraNombre: nurseRow ? formatNombre({ nombres: nurseRow.nombres, apellidoPaterno: nurseRow.apellidoPaterno, apellidoMaterno: nurseRow.apellidoMaterno }) || null : null,
      procedimientos: procs.map((p) => { const m = procMetaMap.get(p.idProcedimiento); return { id: p.idProcedimiento, nombre: m?.nombre ?? '—', codigo: m?.codigo ?? null, precio: p.precio, descuento: p.descuento } }),
      examenes: exams_.map((e) => { const m = examMetaMap.get(e.idExamen); return { id: e.idExamen, nombre: m?.nombre ?? '—', codigo: m?.codigo ?? '', grupoExamen: m?.grupoExamen ?? '', precio: e.precio } }),
      isapreExams: isapre_.map((e) => { const m = examMetaMap.get(e.idExamen); return { id: e.idExamen, nombre: m?.nombre ?? '—', codigo: m?.codigo ?? null, valorCompleto: e.valorCompleto, valorPagar: e.valorPagar } }),
      talleres: talleres_.map((t) => { const m = tallerMetaMap.get(t.idTaller); return { id: t.idTaller, nombre: m?.nombre ?? '—', precio: t.precio } }),
      surcharges: surcharges_.map((s) => { const m = surchargeMetaMap.get(s.idTipoRecargo); return { id: s.idTipoRecargo, tipoNombre: m?.nombre ?? '—', precio: s.precio } }),
      precioVisita,
      tipoDocumento: visit.tipoDocumento ?? '',
      numeroBoleta: visit.numeroBoleta ?? '',
      numeroAtencion: visit.numeroAtencion ?? null,
      pagado: visit.pagado,
      metodoPago: visit.metodoPago ?? null,
      fechaPago: visit.fechaPago ?? null,
      examenResultados: examResults_.map((r) => ({ idExamen: r.idExamen, enviado: r.enviado, fechaEnvio: r.fechaEnvio ?? null })),
      resultadosEnviadosCount: visit.resultadosEnviadosCount,
      resultadosTotalCount: visit.resultadosTotalCount,
      costoTraslado: visit.costoTraslado,
      conceptoNoRealizada: visit.conceptoNoRealizada ?? null,
      motivoCancelacion: visit.motivoCancelacion ?? null,
    }
  })
}

// ─── deleteVisita ─────────────────────────────────────────────────────────────

export async function deleteVisita(id: number): Promise<ActionResult> {
  return withAction('Error al eliminar la visita', async () => {
    await db.delete(visits).where(eq(visits.id, id))
    revalidatePath('/visitas')
  })
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const visitaSharedFields = {
  fecha: fields.fechaRequerida,
  hora: fields.nullableStr,
  idEnfermera: fields.nullableId,
  idOrigenContacto: fields.nullableId,
  informacionAdicional: z.string().trim().optional().default(''),
  cobraVisita: fields.bool,
  montoInsumos: fields.montoInsumos,
  descuentoTipo: fields.descuentoTipo,
  descuentoValor: fields.descuentoValor,
  descuentoAfectaPagoEnfermera: fields.bool,
  descuentoProcedimientosAfectaPagoEnfermera: fields.bool,
  procedure_ids: fields.ids,
  exam_ids: fields.ids,
  taller_ids: fields.ids,
  surcharge_ids: fields.ids,
}

const visitaCreateSchema = z.object({
  idPaciente: z.coerce.number().int().positive('Paciente requerido'),
  ...visitaSharedFields,
})

const visitaUpdateSchema = z.object({
  id: fields.id,
  keyOrdenMedica: fields.nullableStr,
  ...visitaSharedFields,
})

// ─── updateVisita ─────────────────────────────────────────────────────────────

export async function updateVisita(
  fd: FormData,
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  await requireSession()

  const parsed = parseFormDataWithArrays(visitaUpdateSchema, fd, ['procedure_ids', 'exam_ids', 'taller_ids', 'surcharge_ids'])
  if (!parsed.success) return parsed

  const {
    id, fecha, hora, idEnfermera,
    idOrigenContacto, informacionAdicional, cobraVisita, montoInsumos,
    descuentoTipo, descuentoValor, descuentoAfectaPagoEnfermera,
    descuentoProcedimientosAfectaPagoEnfermera,
    keyOrdenMedica,
    procedure_ids: procedureIds, exam_ids: examIds, taller_ids: tallerIds, surcharge_ids: surchargeIds,
  } = parsed.data

  const descuentoValorFinal = cobraVisita ? descuentoValor : 0

  // Guard: cannot edit completed or terminal states
  const [current] = await db.select({ estado: visits.estado }).from(visits).where(eq(visits.id, id))
  if (!current) return { success: false, error: 'Visita no encontrada' }
  if (['completada', 'cancelada', 'no_realizada'].includes(current.estado)) {
    return { success: false, error: `No se puede editar una visita en estado ${current.estado}` }
  }

  const tallerPrices = tallerIds.map((idTaller) => ({
    idTaller,
    precio: Number(fd.get(`taller_precio_${idTaller}`)) || 0,
  }))

  const isapreExamIds = fd.getAll('isapre_exam_ids').map((v) => Number(v)).filter(Boolean)
  const isaprePrevisionId = fd.get('isapre_prevision_id') ? Number(fd.get('isapre_prevision_id')) : null
  const isapreExamData = isapreExamIds.map((examId) => ({
    idExamen: examId,
    valorCompleto: Number(fd.get(`isapre_exam_valor_${examId}`)) || 0,
    valorPagar: Number(fd.get(`isapre_exam_valor_pagar_${examId}`)) || 0,
    idPrevision: isaprePrevisionId,
  }))

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(visits)
        .set({
          fecha, hora, idEnfermera, idOrigenContacto, informacionAdicional, cobraVisita, montoInsumos,
          descuentoTipo, descuentoValor: descuentoValorFinal, descuentoAfectaPagoEnfermera,
          descuentoProcedimientosAfectaPagoEnfermera,
          keyOrdenMedica, updatedAt: new Date(),
        })
        .where(eq(visits.id, id))

      // Preserve stored prices for existing items before deleting.
      const existingProcs = await tx
        .select({ idProcedimiento: visitProcedures.idProcedimiento, precio: visitProcedures.precio, descuento: visitProcedures.descuento })
        .from(visitProcedures)
        .where(eq(visitProcedures.idVisita, id))
      const existingExams = await tx
        .select({ idExamen: visitExams.idExamen, precio: visitExams.precio })
        .from(visitExams)
        .where(eq(visitExams.idVisita, id))
      const storedPriceMap = new Map(existingProcs.map((p) => [p.idProcedimiento, p.precio]))
      const storedDiscountMap = new Map(existingProcs.map((p) => [p.idProcedimiento, p.descuento]))
      const storedExamPriceMap = new Map(existingExams.map((e) => [e.idExamen, e.precio]))

      // Fetch catalog prices for newly added procedures
      const newProcIds = procedureIds.filter((pid) => !storedPriceMap.has(pid))
      let catalogPriceMap = new Map<number, number>()
      if (newProcIds.length > 0) {
        const catalogPrices = await tx
          .select({ id: procedures.id, precio: procedures.precio })
          .from(procedures)
          .where(inArray(procedures.id, newProcIds))
        catalogPriceMap = new Map(catalogPrices.map((p) => [p.id, p.precio]))
      }

      // Load existing surcharge prices before deleting
      const existingSurcharges = await tx
        .select({ idTipoRecargo: visitSurcharges.idTipoRecargo, precio: visitSurcharges.precio })
        .from(visitSurcharges)
        .where(eq(visitSurcharges.idVisita, id))
      const storedSurchargePriceMap = new Map(existingSurcharges.map((s) => [s.idTipoRecargo, s.precio]))

      await tx.delete(visitProcedures).where(eq(visitProcedures.idVisita, id))
      await tx.delete(visitExams).where(eq(visitExams.idVisita, id))
      await tx.delete(visitIsapreExams).where(eq(visitIsapreExams.idVisita, id))
      await tx.delete(visitWorkshops).where(eq(visitWorkshops.idVisita, id))
      await tx.delete(visitSurcharges).where(eq(visitSurcharges.idVisita, id))

      if (procedureIds.length > 0) {
        await tx.insert(visitProcedures).values(
          procedureIds.map((idProcedimiento) => {
            const descuentoRaw = fd.get(`procedimiento_descuento_${idProcedimiento}`)
            const descuento = descuentoRaw !== null
              ? Math.max(0, Number(descuentoRaw) || 0)
              : (storedDiscountMap.get(idProcedimiento) ?? 0)
            return {
              idProcedimiento,
              idVisita: id,
              precio: storedPriceMap.get(idProcedimiento) ?? catalogPriceMap.get(idProcedimiento) ?? 0,
              descuento,
            }
          }),
        )
      }
      if (examIds.length > 0) {
        const newExamIds = examIds.filter((id) => !storedExamPriceMap.has(id))
        let catalogExamPriceMap = new Map<number, number>()
        if (newExamIds.length > 0) {
          const catalogExamPrices = await tx
            .select({ id: exams.id, precio: exams.precio })
            .from(exams)
            .where(inArray(exams.id, newExamIds))
          catalogExamPriceMap = new Map(catalogExamPrices.map((r) => [r.id, r.precio]))
        }

        const examValues = examIds.map((idExamen) => ({
          idExamen,
          idVisita: id,
          precio: storedExamPriceMap.get(idExamen) ?? catalogExamPriceMap.get(idExamen) ?? 0,
        }))
        await tx.insert(visitExams).values(examValues)
      }

      if (isapreExamData.length > 0) {
        await tx.insert(visitIsapreExams).values(
          isapreExamData.map((e) => ({ ...e, idVisita: id })),
        )
      }

      if (tallerPrices.length > 0) {
        await tx.insert(visitWorkshops).values(
          tallerPrices.map(({ idTaller, precio }) => ({ idTaller, idVisita: id, precio })),
        )
      }

      if (surchargeIds.length > 0) {
        const newSurchargeIds = surchargeIds.filter((sid) => !storedSurchargePriceMap.has(sid))
        let catalogSurchargePriceMap = new Map<number, number>()
        if (newSurchargeIds.length > 0) {
          const catalogPrices = await tx
            .select({ id: surchargeTypes.id, precio: surchargeTypes.precio })
            .from(surchargeTypes)
            .where(inArray(surchargeTypes.id, newSurchargeIds))
          catalogSurchargePriceMap = new Map(catalogPrices.map((r) => [r.id, r.precio]))
        }
        await tx.insert(visitSurcharges).values(
          surchargeIds.map((sid) => ({
            idTipoRecargo: sid,
            idVisita: id,
            precio: storedSurchargePriceMap.get(sid) ?? catalogSurchargePriceMap.get(sid) ?? 0,
          })),
        )
      }

      await actualizarCostoVisitaPersistida(id, tx)

      await tx
        .update(visits)
        .set({ resultadosTotalCount: examIds.length + isapreExamData.length })
        .where(eq(visits.id, id))
    })

    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
    return { success: true, id }
  } catch (err) {
    console.error('[updateVisita] error:', err)
    // Drizzle wraps the PG error in err.cause
    return { success: false, error: 'Error al actualizar la visita' }
  }
}

// ─── createVisita ─────────────────────────────────────────────────────────────

export async function createVisita(
  fd: FormData,
): Promise<ActionResult<{ id: number }>> {
  return withAction('Error al crear la visita', async () => {
  const parsed = parseFormDataWithArrays(visitaCreateSchema, fd, ['procedure_ids', 'exam_ids', 'taller_ids', 'surcharge_ids'])
  if (!parsed.success) throw new ActionError(parsed.error)

  const {
    idPaciente, fecha, hora, idEnfermera,
    idOrigenContacto, informacionAdicional, cobraVisita, montoInsumos,
    descuentoTipo, descuentoValor, descuentoAfectaPagoEnfermera,
    descuentoProcedimientosAfectaPagoEnfermera,
    procedure_ids: procedureIds, exam_ids: examIds, taller_ids: tallerIds, surcharge_ids: surchargeIds,
  } = parsed.data

  const descuentoValorFinal = cobraVisita ? descuentoValor : 0

  const tallerPrices = tallerIds.map((idTaller) => ({
    idTaller,
    precio: Number(fd.get(`taller_precio_${idTaller}`)) || 0,
  }))

  const isapreExamIds = fd.getAll('isapre_exam_ids').map((v) => Number(v)).filter(Boolean)
  const isaprePrevisionId = fd.get('isapre_prevision_id') ? Number(fd.get('isapre_prevision_id')) : null
  const isapreExamData = isapreExamIds.map((examId) => ({
    idExamen: examId,
    valorCompleto: Number(fd.get(`isapre_exam_valor_${examId}`)) || 0,
    valorPagar: Number(fd.get(`isapre_exam_valor_pagar_${examId}`)) || 0,
    idPrevision: isaprePrevisionId,
  }))

  const visitId = await db.transaction(async (tx) => {
    const [visit] = await tx
      .insert(visits)
      .values({
        fecha, hora, estado: 'programada', costo: 0,
        idPaciente, idEnfermera,
        idOrigenContacto, informacionAdicional,
        pagado: false, costoTraslado: 0,
        cobraVisita, montoInsumos,
        descuentoTipo, descuentoValor: descuentoValorFinal, descuentoAfectaPagoEnfermera,
        descuentoProcedimientosAfectaPagoEnfermera,
        })
        .returning()

      const id = visit!.id

      if (procedureIds.length > 0) {
        const catalogPrices = await tx
          .select({ id: procedures.id, precio: procedures.precio })
          .from(procedures)
          .where(inArray(procedures.id, procedureIds))
        const priceMap = new Map(catalogPrices.map((p) => [p.id, p.precio]))
        await tx.insert(visitProcedures).values(
          procedureIds.map((idProcedimiento) => ({
            idProcedimiento,
            idVisita: id,
            precio: priceMap.get(idProcedimiento) ?? 0,
            descuento: Math.max(0, Number(fd.get(`procedimiento_descuento_${idProcedimiento}`)) || 0),
          })),
        )
      }

      if (examIds.length > 0) {
        const examCatalogPrices = await tx
          .select({ id: exams.id, precio: exams.precio })
          .from(exams)
          .where(inArray(exams.id, examIds))
        const examPriceMap = new Map(examCatalogPrices.map((r) => [r.id, r.precio]))
        const examPriceValues = examIds.map((idExamen) => ({
          idExamen,
          idVisita: id,
          precio: examPriceMap.get(idExamen) ?? 0,
        }))
        await tx.insert(visitExams).values(examPriceValues)
      }

      if (isapreExamData.length > 0) {
        await tx.insert(visitIsapreExams).values(
          isapreExamData.map((e) => ({ ...e, idVisita: id })),
        )
      }

      if (tallerPrices.length > 0) {
        await tx.insert(visitWorkshops).values(
          tallerPrices.map(({ idTaller, precio }) => ({ idTaller, idVisita: id, precio })),
        )
      }

      if (surchargeIds.length > 0) {
        const catalogPrices = await tx
          .select({ id: surchargeTypes.id, precio: surchargeTypes.precio })
          .from(surchargeTypes)
          .where(inArray(surchargeTypes.id, surchargeIds))
        const surchargePriceMap = new Map(catalogPrices.map((r) => [r.id, r.precio]))
        await tx.insert(visitSurcharges).values(
          surchargeIds.map((sid) => ({
            idTipoRecargo: sid,
            idVisita: id,
            precio: surchargePriceMap.get(sid) ?? 0,
          })),
        )
      }

      await actualizarCostoVisitaPersistida(id, tx)

      if (examIds.length > 0 || isapreExamData.length > 0) {
        await tx
          .update(visits)
          .set({ resultadosTotalCount: examIds.length + isapreExamData.length })
          .where(eq(visits.id, id))
      }

      return id
    })

  revalidatePath('/visitas')
  return { id: visitId }
  })
}

// ─── actualizarPrecioExamenVisita ─────────────────────────────────────────────

export async function actualizarPrecioExamenVisita(
  idVisita: number,
  idExamen: number,
): Promise<ActionResult> {
  return withAction('Error al actualizar precio', async () => {
    const [exam] = await db.select({ precio: exams.precio }).from(exams).where(eq(exams.id, idExamen))
    if (!exam) throw new ActionError('Examen no encontrado')
    await db.transaction(async (tx) => {
      await tx
        .update(visitExams)
        .set({ precio: exam.precio })
        .where(and(eq(visitExams.idVisita, idVisita), eq(visitExams.idExamen, idExamen)))
      await actualizarCostoVisitaPersistida(idVisita, tx)
    })
    revalidatePath(`/visitas/${idVisita}`)
  })
}

// ─── actualizarPrecioProcedimientoVisita ──────────────────────────────────────

export async function actualizarPrecioProcedimientoVisita(
  idVisita: number,
  idProcedimiento: number,
): Promise<ActionResult> {
  return withAction('Error al actualizar precio', async () => {
    const [proc] = await db
      .select({ precio: procedures.precio })
      .from(procedures)
      .where(eq(procedures.id, idProcedimiento))
    if (!proc) throw new ActionError('Procedimiento no encontrado')
    await db.transaction(async (tx) => {
      await tx
        .update(visitProcedures)
        .set({ precio: proc.precio })
        .where(and(eq(visitProcedures.idVisita, idVisita), eq(visitProcedures.idProcedimiento, idProcedimiento)))
      await actualizarCostoVisitaPersistida(idVisita, tx)
    })
    revalidatePath(`/visitas/${idVisita}`)
  })
}

// ─── confirmarVisita ──────────────────────────────────────────────────────────

export async function confirmarVisita(id: number): Promise<ActionResult> {
  return withAction('Error al confirmar la visita', async () => {
    await requireSession()
    const [visit] = await db.select({ estado: visits.estado }).from(visits).where(eq(visits.id, id))
    if (!visit) throw new ActionError('Visita no encontrada')
    if (visit.estado !== 'programada') throw new ActionError('Solo se puede confirmar una visita programada')
    await db.update(visits).set({ estado: 'confirmada', updatedAt: new Date() }).where(eq(visits.id, id))
    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
  })
}

// ─── marcarRealizada ──────────────────────────────────────────────────────────

export async function marcarRealizada(id: number): Promise<ActionResult> {
  return withAction('Error al marcar como realizada', async () => {
    await requireSession()
    const [visit] = await db.select({ estado: visits.estado, idEnfermera: visits.idEnfermera }).from(visits).where(eq(visits.id, id))
    if (!visit) throw new ActionError('Visita no encontrada')
    if (visit.estado !== 'confirmada') throw new ActionError('Solo se puede marcar como realizada una visita confirmada')
    if (visit.idEnfermera === null) throw new ActionError('Para marcar esta visita como realizada, primero asigna una enfermera')
    const expectedExamIds = await getExamenesEsperados(id)
    await db.update(visits).set({ estado: 'realizada', resultadosTotalCount: expectedExamIds.length, updatedAt: new Date() }).where(eq(visits.id, id))
    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
  })
}

// ─── marcarNoRealizada ────────────────────────────────────────────────────────

export async function marcarNoRealizada(id: number, costo: number, concepto: string): Promise<ActionResult> {
  return withAction('Error al marcar como no realizada', async () => {
    await requireSession()
    const [visit] = await db.select({ estado: visits.estado }).from(visits).where(eq(visits.id, id))
    if (!visit) throw new ActionError('Visita no encontrada')
    if (visit.estado !== 'confirmada') throw new ActionError('Solo se puede marcar como no realizada una visita confirmada')
    await db.update(visits)
      .set({ estado: 'no_realizada', costoTraslado: Math.max(0, Math.round(costo)), conceptoNoRealizada: concepto.trim() || null, updatedAt: new Date() })
      .where(eq(visits.id, id))
    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
  })
}

// ─── cancelarVisita ───────────────────────────────────────────────────────────

export async function cancelarVisita(id: number, motivo: string): Promise<ActionResult> {
  return withAction('Error al cancelar la visita', async () => {
    await requireSession()
    if (!motivo.trim()) throw new ActionError('El motivo de cancelación es requerido')
    const [visit] = await db.select({ estado: visits.estado }).from(visits).where(eq(visits.id, id))
    if (!visit) throw new ActionError('Visita no encontrada')
    if (!['programada', 'confirmada'].includes(visit.estado)) throw new ActionError('Solo se puede cancelar una visita programada o confirmada')
    await db.update(visits)
      .set({ estado: 'cancelada', motivoCancelacion: motivo.trim(), updatedAt: new Date() })
      .where(eq(visits.id, id))
    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
  })
}

// ─── Helpers de cierre de visita (compartidos entre guardado parcial y completarVisita) ────

async function getVisitaRealizada(id: number): Promise<void> {
  const [visit] = await db.select({ estado: visits.estado }).from(visits).where(eq(visits.id, id))
  if (!visit) throw new ActionError('Visita no encontrada')
  if (visit.estado !== 'realizada') throw new ActionError('Solo se puede completar una visita realizada')
}

async function assertDocumentoUnico(id: number, tipoDocumento: 'boleta' | 'factura', numeroBoleta: string): Promise<void> {
  const [duplicateDocument] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(
      eq(visits.numeroBoleta, numeroBoleta),
      eq(visits.tipoDocumento, tipoDocumento),
      ne(visits.id, id),
    ))
    .limit(1)
  if (duplicateDocument) {
    const label = tipoDocumento === 'factura' ? 'factura' : 'boleta'
    throw new ActionError(`Ya existe una ${label} con el número ${numeroBoleta}`)
  }
}

async function assertAtencionUnica(id: number, numeroAtencion: number): Promise<void> {
  if (!Number.isInteger(numeroAtencion) || numeroAtencion < 1 || numeroAtencion > 2147483647) {
    throw new ActionError('N° de atención inválido')
  }
  const [duplicateAttention] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.numeroAtencion, numeroAtencion), ne(visits.id, id)))
    .limit(1)
  if (duplicateAttention) {
    throw new ActionError(`Ya existe una visita con el N° de atención ${numeroAtencion}`)
  }
}

async function getExamenesEsperados(id: number): Promise<number[]> {
  const [stdExams, isapreExams] = await Promise.all([
    db.select({ idExamen: visitExams.idExamen }).from(visitExams).where(eq(visitExams.idVisita, id)),
    db.select({ idExamen: visitIsapreExams.idExamen }).from(visitIsapreExams).where(eq(visitIsapreExams.idVisita, id)),
  ])
  return [...new Set([...stdExams, ...isapreExams].map((ex) => ex.idExamen))]
}

// tx: transacción de Drizzle. Sin tipo compartido entre Neon (Vercel) y postgres.js (local) — mismo
// patrón que `PricingDb` en src/lib/pricing/visitas.ts.
async function upsertExamResults(
  tx: any,
  idVisita: number,
  items: { idExamen: number; enviado: boolean; fechaEnvio: string | null }[],
): Promise<{ enviados: number; total: number }> {
  for (const item of items) {
    await tx
      .insert(visitExamResults)
      .values({ idVisita, idExamen: item.idExamen, enviado: item.enviado, fechaEnvio: item.fechaEnvio, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [visitExamResults.idVisita, visitExamResults.idExamen],
        set: { enviado: item.enviado, fechaEnvio: item.fechaEnvio, updatedAt: new Date() },
      })
  }

  // Deduplicado por idExamen: un mismo examen puede estar en la tabla regular y en la de
  // isapre, y `visitExamResults` es único por (visita, examen). Contar sin deduplicar
  // dejaría `enviados < total` para siempre. Mismo criterio que `getExamenesEsperados`.
  const [stdExams, isapreExams] = await Promise.all([
    tx.select({ idExamen: visitExams.idExamen }).from(visitExams).where(eq(visitExams.idVisita, idVisita)),
    tx.select({ idExamen: visitIsapreExams.idExamen }).from(visitIsapreExams).where(eq(visitIsapreExams.idVisita, idVisita)),
  ])
  const total = new Set([...stdExams, ...isapreExams].map((ex: { idExamen: number }) => ex.idExamen)).size

  const [resultRows] = await tx.select({ c: count() }).from(visitExamResults).where(and(eq(visitExamResults.idVisita, idVisita), eq(visitExamResults.enviado, true)))
  const enviados = Number(resultRows?.c ?? 0)

  await tx.update(visits).set({ resultadosEnviadosCount: enviados, resultadosTotalCount: total, updatedAt: new Date() }).where(eq(visits.id, idVisita))

  return { enviados, total }
}

// ─── guardarFacturacionVisita ──────────────────────────────────────────────────

export type FacturacionVisitaData = {
  tipoDocumento: 'boleta' | 'factura'
  numeroBoleta: string
  numeroAtencion?: number | null
}

export async function guardarFacturacionVisita(id: number, data: FacturacionVisitaData): Promise<ActionResult> {
  return withAction('Error al guardar la facturación', async () => {
    await requireSession()
    await getVisitaRealizada(id)

    const numeroBoleta = data.numeroBoleta.trim()
    if (numeroBoleta) {
      await assertDocumentoUnico(id, data.tipoDocumento, numeroBoleta)
    }
    if (data.numeroAtencion !== null && data.numeroAtencion !== undefined) {
      await assertAtencionUnica(id, data.numeroAtencion)
    }

    await db.update(visits).set({
      tipoDocumento: data.tipoDocumento,
      numeroBoleta,
      numeroAtencion: data.numeroAtencion ?? null,
      updatedAt: new Date(),
    }).where(eq(visits.id, id))

    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
  })
}

// ─── guardarPagoVisita ──────────────────────────────────────────────────────────

export type PagoVisitaData = {
  pagado: boolean
  metodoPago?: string | null
  fechaPago?: string | null
}

export async function guardarPagoVisita(id: number, data: PagoVisitaData): Promise<ActionResult> {
  return withAction('Error al guardar el pago', async () => {
    await requireSession()
    await getVisitaRealizada(id)

    if (data.pagado && data.fechaPago && !/^\d{4}-\d{2}-\d{2}$/.test(data.fechaPago)) {
      throw new ActionError('Formato de fecha de pago inválido')
    }

    await db.update(visits).set({
      pagado: data.pagado,
      metodoPago: data.pagado ? (data.metodoPago ?? null) : null,
      fechaPago: data.pagado ? (data.fechaPago ?? null) : null,
      updatedAt: new Date(),
    }).where(eq(visits.id, id))

    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
  })
}

// ─── guardarEnvioExamenesVisita ─────────────────────────────────────────────────

export type EnvioExamenVisitaItem = { idExamen: number; enviado: boolean; fechaEnvio: string | null }

export async function guardarEnvioExamenesVisita(id: number, examenes: EnvioExamenVisitaItem[]): Promise<ActionResult> {
  return withAction('Error al guardar el envío de exámenes', async () => {
    await requireSession()
    await getVisitaRealizada(id)

    const expectedExamIds = await getExamenesEsperados(id)
    for (const ex of examenes) {
      if (!ex.idExamen || !expectedExamIds.includes(ex.idExamen)) {
        throw new ActionError('Uno de los exámenes enviados no pertenece a esta visita')
      }
      if (ex.fechaEnvio && !/^\d{4}-\d{2}-\d{2}$/.test(ex.fechaEnvio)) {
        throw new ActionError('Formato de fecha de envío inválido')
      }
    }

    await db.transaction(async (tx) => {
      await upsertExamResults(tx, id, examenes)
    })

    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
  })
}

// ─── completarVisita ──────────────────────────────────────────────────────────

export type CompletarVisitaData = {
  tipoDocumento: 'boleta' | 'factura'
  numeroBoleta: string
  numeroAtencion?: number | null
  pagado: boolean
  metodoPago?: string | null
  fechaPago?: string | null
  examenes: { idExamen: number; fechaEnvio: string }[]
}

export async function completarVisita(id: number, data: CompletarVisitaData): Promise<ActionResult> {
  return withAction('Error al completar la visita', async () => {
    await requireSession()
    await getVisitaRealizada(id)
    if (!data.tipoDocumento || !data.numeroBoleta.trim()) throw new ActionError('Tipo de documento y N° boleta/factura son requeridos')
    if (!data.pagado) throw new ActionError('La visita debe estar marcada como pagada para completarla')
    if (!data.metodoPago) throw new ActionError('Método de pago requerido para completar la visita')
    if (!data.fechaPago) throw new ActionError('Fecha de pago requerida para completar la visita')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fechaPago)) throw new ActionError('Formato de fecha de pago inválido')
    if (data.numeroAtencion !== null && data.numeroAtencion !== undefined) {
      await assertAtencionUnica(id, data.numeroAtencion)
    }

    const numeroBoleta = data.numeroBoleta.trim()
    await assertDocumentoUnico(id, data.tipoDocumento, numeroBoleta)

    const submittedExams = new Map<number, string>()
    for (const ex of data.examenes) {
      if (!ex.idExamen) throw new ActionError('Examen inválido en el envío de resultados')
      if (!ex.fechaEnvio) throw new ActionError('Fecha de envío requerida para todos los exámenes')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ex.fechaEnvio)) throw new ActionError('Formato de fecha de envío inválido')
      submittedExams.set(ex.idExamen, ex.fechaEnvio)
    }

    const expectedExamIds = await getExamenesEsperados(id)

    for (const idExamen of submittedExams.keys()) {
      if (!expectedExamIds.includes(idExamen)) throw new ActionError('Uno de los exámenes enviados no pertenece a esta visita')
    }

    const missingExamIds = expectedExamIds.filter((idExamen) => !submittedExams.has(idExamen))
    if (missingExamIds.length > 0) {
      throw new ActionError(`Falta registrar el envío de ${missingExamIds.length} examen${missingExamIds.length === 1 ? '' : 'es'}`)
    }

    const examenesCompletos = expectedExamIds.map((idExamen) => ({
      idExamen,
      enviado: true,
      fechaEnvio: submittedExams.get(idExamen)!,
    }))

    await db.transaction(async (tx) => {
      await upsertExamResults(tx, id, examenesCompletos)

      await tx.update(visits).set({
        estado: 'completada',
        tipoDocumento: data.tipoDocumento,
        numeroBoleta,
        numeroAtencion: data.numeroAtencion ?? null,
        pagado: data.pagado,
        metodoPago: data.pagado ? (data.metodoPago ?? null) : null,
        fechaPago: data.pagado ? (data.fechaPago ?? null) : null,
        updatedAt: new Date(),
      }).where(eq(visits.id, id))
    })

    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
  })
}

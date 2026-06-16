'use server'

import { z } from 'zod'
import { db } from '@/db'
import { contactOrigins, visits, visitProcedures, visitExams, visitIsapreExams, visitWorkshops, visitSurcharges, visitExamResults, workshops, patients, patientPhones, nurses, procedures, exams, healthInsurances, addresses, nursingVisitPrices, surchargeTypes } from '@/db/schema'
import { eq, count, and, or, ilike, gte, lte, asc, desc, SQL, sql, inArray, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getTiposRecargosForSelect } from './catalogos'
import type { SearchParams, Result } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'
import { withQuery, withAction, ActionError, type ActionResult } from '@/lib/with-action'
import { formatNombre } from '@/lib/paciente'
import { actualizarCostoVisitaPersistida } from '@/lib/pricing/visitas'
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
  idPaciente: number | null
  idEnfermera: number | null
  numeroBoleta: string
  tipoDocumento: string
  numeroAtencion: number | null
  origenContacto: string | null
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
  procedurePrices: { idProcedimiento: number; precio: number }[]
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
  cobraVisita: boolean
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
  procedimientos: { id: number; nombre: string; codigo: string | null; precio: number }[]
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
  if (estado) conditions.push(eq(visits.estado, estado))
  if (enfermeraId) conditions.push(eq(visits.idEnfermera, Number(enfermeraId)))
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

  // Look up commune-specific price, fall back to base price
  let nursingVisitPrice: number | null = null
  if (comuna) {
    const [comunaRow] = await db
      .select({ precio: nursingVisitPrices.precio })
      .from(nursingVisitPrices)
      .where(and(eq(nursingVisitPrices.comuna, comuna), eq(nursingVisitPrices.activo, true)))
      .limit(1)
    if (comunaRow) nursingVisitPrice = comunaRow.precio
  }
  if (nursingVisitPrice === null) {
    const [baseRow] = await db
      .select({ precio: nursingVisitPrices.precio })
      .from(nursingVisitPrices)
      .where(and(isNull(nursingVisitPrices.comuna), eq(nursingVisitPrices.activo, true)))
      .limit(1)
    nursingVisitPrice = baseRow?.precio ?? null
  }

  return {
    examPrices: uniqueExamIds.map((idExamen) => ({
      idExamen,
      precioActual: examPriceRows.find((r) => r.id === idExamen)?.precio ?? 0,
    })),
    nursingVisitPrice,
  }
  })
}

// ─── getVisita ────────────────────────────────────────────────────────────────

export async function getVisita(id: number): Promise<VisitaDetalle | null> {
  return withQuery(async () => {
  const [visit] = await db.select().from(visits).where(eq(visits.id, id))
  if (!visit) return null

  const [procs, exams_, isapre_, talleres_, surcharges_] = await Promise.all([
    db.select({ idProcedimiento: visitProcedures.idProcedimiento, precio: visitProcedures.precio }).from(visitProcedures).where(eq(visitProcedures.idVisita, id)),
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
    idPaciente: visit.idPaciente ?? null,
    idEnfermera: visit.idEnfermera ?? null,
    numeroBoleta: visit.numeroBoleta ?? '',
    tipoDocumento: visit.tipoDocumento ?? '',
    numeroAtencion: visit.numeroAtencion ?? null,
    origenContacto: visit.origenContacto ?? null,
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
    procedurePrices: procs.map((p) => ({ idProcedimiento: p.idProcedimiento, precio: p.precio })),
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
      db.select({ idProcedimiento: visitProcedures.idProcedimiento, precio: visitProcedures.precio }).from(visitProcedures).where(eq(visitProcedures.idVisita, id)),
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

    const [procMeta, examMeta, tallerMeta, surchargeMeta, patientRow, nurseRow] = await Promise.all([
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
    let precioVisita: number | null = null
    if (addressRow?.areaAdministrativa3) {
      const [comunaRow] = await db.select({ precio: nursingVisitPrices.precio }).from(nursingVisitPrices).where(and(eq(nursingVisitPrices.comuna, addressRow.areaAdministrativa3), eq(nursingVisitPrices.activo, true))).limit(1)
      if (comunaRow) precioVisita = comunaRow.precio
    }
    if (precioVisita === null) {
      const [baseRow] = await db.select({ precio: nursingVisitPrices.precio }).from(nursingVisitPrices).where(and(isNull(nursingVisitPrices.comuna), eq(nursingVisitPrices.activo, true))).limit(1)
      precioVisita = baseRow?.precio ?? null
    }

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
      cobraVisita: visit.cobraVisita,
      informacionAdicional: visit.informacionAdicional ?? '',
      origenContacto: visit.origenContacto ?? null,
      idPaciente: visit.idPaciente ?? null,
      pacienteNombre: patientRow ? formatNombre({ nombres: patientRow.nombres, apellidoPaterno: patientRow.apellidoPaterno, apellidoMaterno: patientRow.apellidoMaterno }) || null : null,
      pacienteIdentificador: patientRow?.identificador ?? null,
      pacientePrevision: previsionRow?.nombre ?? null,
      pacienteTelefonos: (telefonosRows as { telefono: string }[]).map((t) => t.telefono),
      pacienteDireccion: direccionStr,
      idEnfermera: visit.idEnfermera ?? null,
      enfermeraNombre: nurseRow ? formatNombre({ nombres: nurseRow.nombres, apellidoPaterno: nurseRow.apellidoPaterno, apellidoMaterno: nurseRow.apellidoMaterno }) || null : null,
      procedimientos: procs.map((p) => { const m = procMetaMap.get(p.idProcedimiento); return { id: p.idProcedimiento, nombre: m?.nombre ?? '—', codigo: m?.codigo ?? null, precio: p.precio } }),
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

// ─── searchOrigenesContacto ───────────────────────────────────────────────────

export async function searchOrigenesContacto(): Promise<{ id: number; nombre: string }[]> {
  return withQuery(() =>
    db
      .select({ id: contactOrigins.id, nombre: contactOrigins.nombre })
      .from(contactOrigins)
      .where(eq(contactOrigins.activo, true))
      .orderBy(asc(contactOrigins.nombre)),
  )
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const visitaSharedFields = {
  fecha: fields.fechaRequerida,
  hora: fields.nullableStr,
  idEnfermera: fields.nullableId,
  origenContacto: fields.nullableStr,
  informacionAdicional: z.string().trim().optional().default(''),
  cobraVisita: fields.bool,
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
    origenContacto, informacionAdicional, cobraVisita,
    keyOrdenMedica,
    procedure_ids: procedureIds, exam_ids: examIds, taller_ids: tallerIds, surcharge_ids: surchargeIds,
  } = parsed.data

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
        .set({ fecha, hora, idEnfermera, origenContacto, informacionAdicional, cobraVisita, keyOrdenMedica, updatedAt: new Date() })
        .where(eq(visits.id, id))

      // Preserve stored prices for existing items before deleting.
      const existingProcs = await tx
        .select({ idProcedimiento: visitProcedures.idProcedimiento, precio: visitProcedures.precio })
        .from(visitProcedures)
        .where(eq(visitProcedures.idVisita, id))
      const existingExams = await tx
        .select({ idExamen: visitExams.idExamen, precio: visitExams.precio })
        .from(visitExams)
        .where(eq(visitExams.idVisita, id))
      const storedPriceMap = new Map(existingProcs.map((p) => [p.idProcedimiento, p.precio]))
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
          procedureIds.map((idProcedimiento) => ({
            idProcedimiento,
            idVisita: id,
            precio: storedPriceMap.get(idProcedimiento) ?? catalogPriceMap.get(idProcedimiento) ?? 0,
          })),
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
    origenContacto, informacionAdicional, cobraVisita,
    procedure_ids: procedureIds, exam_ids: examIds, taller_ids: tallerIds, surcharge_ids: surchargeIds,
  } = parsed.data

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
        origenContacto, informacionAdicional,
        pagado: false, costoTraslado: 0,
        cobraVisita,
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
    await db.update(visits).set({ estado: 'realizada', updatedAt: new Date() }).where(eq(visits.id, id))
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
    const [visit] = await db.select({ estado: visits.estado }).from(visits).where(eq(visits.id, id))
    if (!visit) throw new ActionError('Visita no encontrada')
    if (visit.estado !== 'realizada') throw new ActionError('Solo se puede completar una visita realizada')
    if (!data.tipoDocumento || !data.numeroBoleta.trim()) throw new ActionError('Tipo de documento y N° boleta/factura son requeridos')
    if (!data.pagado) throw new ActionError('La visita debe estar marcada como pagada para completarla')
    if (!data.metodoPago) throw new ActionError('Método de pago requerido para completar la visita')
    if (!data.fechaPago) throw new ActionError('Fecha de pago requerida para completar la visita')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fechaPago)) throw new ActionError('Formato de fecha de pago inválido')

    const submittedExams = new Map<number, string>()
    for (const ex of data.examenes) {
      if (!ex.idExamen) throw new ActionError('Examen inválido en el envío de resultados')
      if (!ex.fechaEnvio) throw new ActionError('Fecha de envío requerida para todos los exámenes')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ex.fechaEnvio)) throw new ActionError('Formato de fecha de envío inválido')
      submittedExams.set(ex.idExamen, ex.fechaEnvio)
    }

    const [stdExams, isapreExams] = await Promise.all([
      db.select({ idExamen: visitExams.idExamen }).from(visitExams).where(eq(visitExams.idVisita, id)),
      db.select({ idExamen: visitIsapreExams.idExamen }).from(visitIsapreExams).where(eq(visitIsapreExams.idVisita, id)),
    ])
    const expectedExamIds = [...new Set([...stdExams, ...isapreExams].map((ex) => ex.idExamen))]

    for (const idExamen of submittedExams.keys()) {
      if (!expectedExamIds.includes(idExamen)) throw new ActionError('Uno de los exámenes enviados no pertenece a esta visita')
    }

    const missingExamIds = expectedExamIds.filter((idExamen) => !submittedExams.has(idExamen))
    if (missingExamIds.length > 0) {
      throw new ActionError(`Falta registrar el envío de ${missingExamIds.length} examen${missingExamIds.length === 1 ? '' : 'es'}`)
    }

    const examenesCompletos = expectedExamIds.map((idExamen) => ({
      idExamen,
      fechaEnvio: submittedExams.get(idExamen)!,
    }))

    await db.transaction(async (tx) => {
      for (const ex of examenesCompletos) {
        await tx
          .insert(visitExamResults)
          .values({ idVisita: id, idExamen: ex.idExamen, enviado: true, fechaEnvio: ex.fechaEnvio, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: [visitExamResults.idVisita, visitExamResults.idExamen],
            set: { enviado: true, fechaEnvio: ex.fechaEnvio, updatedAt: new Date() },
          })
      }

      const [stdCount] = await tx.select({ c: count() }).from(visitExams).where(eq(visitExams.idVisita, id))
      const [isCount] = await tx.select({ c: count() }).from(visitIsapreExams).where(eq(visitIsapreExams.idVisita, id))
      const total = Number(stdCount?.c ?? 0) + Number(isCount?.c ?? 0)

      await tx.update(visits).set({
        estado: 'completada',
        tipoDocumento: data.tipoDocumento,
        numeroBoleta: data.numeroBoleta.trim(),
        numeroAtencion: data.numeroAtencion ?? null,
        pagado: data.pagado,
        metodoPago: data.pagado ? (data.metodoPago ?? null) : null,
        fechaPago: data.pagado ? (data.fechaPago ?? null) : null,
        resultadosEnviadosCount: examenesCompletos.length,
        resultadosTotalCount: total,
        updatedAt: new Date(),
      }).where(eq(visits.id, id))
    })

    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
  })
}

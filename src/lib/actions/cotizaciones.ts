'use server'

import { z } from 'zod'
import { db } from '@/db'
import {
  quotations,
  quotationExams,
  quotationIsapreExams,
  quotationProcedures,
  quotationWorkshops,
  quotationSurcharges,
  patients,
  procedures,
  exams,
  workshops,
  surchargeTypes,
  addresses,
  visits,
  visitProcedures,
  visitExams,
  visitIsapreExams,
  visitWorkshops,
  visitSurcharges,
  nursingVisitPrices,
} from '@/db/schema'
import { eq, and, or, ilike, asc, desc, SQL, sql, isNull, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { SearchParams } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'
import { formatNombre } from '@/lib/paciente'
import { getPrecioVisitaEnfermeria } from '@/lib/pricing/visitas'
import { resolverMontoDescuento } from '@/lib/pricing/descuento'
import { parseFormDataWithArrays, fields } from '@/lib/validation'
import { withQuery, withAction, ActionError, type ActionResult } from '@/lib/with-action'

// ─── Types ────────────────────────────────────────────────────────────────

export type CotizacionDetalle = {
  id: number
  estado: string
  idPaciente: number | null
  nombreDestinatario: string | null
  emailDestinatario: string | null
  telefonoDestinatario: string | null
  identificacionDestinatario: string | null
  comuna: string | null
  cobraVisita: boolean
  total: number
  montoInsumos: number
  descuentoTipo: 'monto' | 'porcentaje'
  descuentoValor: number
  montoDescuento: number
  montoVisitaOriginal: number
  descuentoAfectaPagoEnfermera: boolean
  idVisita: number | null
  notas: string | null
  motivoRechazo: string | null
  fechaEnvio: Date | null
  examIds: number[]
  examPrices: { idExamen: number; precio: number }[]
  procedureIds: number[]
  procedurePrices: { idProcedimiento: number; precio: number }[]
  tallerIds: number[]
  tallerPrices: { idTaller: number; precio: number }[]
  surchargeIds: number[]
  surchargePrices: { idTipoRecargo: number; precio: number }[]
  isapreExams: { idExamen: number; valorCompleto: number; valorPagar: number; idPrevision: number | null }[]
}

export type CotizacionVista = {
  id: number
  estado: string
  idPaciente: number | null
  pacienteNombre: string | null
  nombreDestinatario: string | null
  emailDestinatario: string | null
  telefonoDestinatario: string | null
  identificacionDestinatario: string | null
  comuna: string | null
  cobraVisita: boolean
  precioVisita: number
  total: number
  montoInsumos: number
  descuentoTipo: 'monto' | 'porcentaje'
  descuentoValor: number
  montoDescuento: number
  montoVisitaOriginal: number
  descuentoAfectaPagoEnfermera: boolean
  idVisita: number | null
  notas: string | null
  motivoRechazo: string | null
  fechaEnvio: Date | null
  createdAt: Date
  updatedAt: Date
  procedimientos: { id: number; nombre: string; codigo: string | null; precio: number }[]
  examenes: { id: number; nombre: string; codigo: string | null; precio: number }[]
  isapreExams: { id: number; nombre: string; codigo: string | null; valorCompleto: number; valorPagar: number; idPrevision: number | null }[]
  talleres: { id: number; nombre: string; codigo: string | null; precio: number }[]
  surcharges: { id: number; tipoNombre: string; precio: number }[]
}

export type CotizacionRow = {
  id: number
  fecha: string
  estado: string
  paciente: string | null
  destinatario: string | null
  total: number
  idVisita: number | null
}

// ─── getCotizacion ────────────────────────────────────────────────────────

export async function getCotizacion(id: number): Promise<CotizacionDetalle | null> {
  return withQuery(async () => {
  const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id))
  if (!quotation) return null

  const [exams_, isapre_, procs, talleres_, surcharges_] = await Promise.all([
    db
      .select({ idExamen: quotationExams.idExamen, precio: quotationExams.precio })
      .from(quotationExams)
      .where(eq(quotationExams.idCotizacion, id)),
    db
      .select({ idExamen: quotationIsapreExams.idExamen, valorCompleto: quotationIsapreExams.valorCompleto, valorPagar: quotationIsapreExams.valorPagar, idPrevision: quotationIsapreExams.idPrevision })
      .from(quotationIsapreExams)
      .where(eq(quotationIsapreExams.idCotizacion, id)),
    db
      .select({ idProcedimiento: quotationProcedures.idProcedimiento, precio: quotationProcedures.precio })
      .from(quotationProcedures)
      .where(eq(quotationProcedures.idCotizacion, id)),
    db
      .select({ idTaller: quotationWorkshops.idTaller, precio: quotationWorkshops.precio })
      .from(quotationWorkshops)
      .where(eq(quotationWorkshops.idCotizacion, id)),
    db
      .select({ idTipoRecargo: quotationSurcharges.idTipoRecargo, precio: quotationSurcharges.precio })
      .from(quotationSurcharges)
      .where(eq(quotationSurcharges.idCotizacion, id)),
  ])

  return {
    id: quotation.id,
    estado: quotation.estado,
    idPaciente: quotation.idPaciente ?? null,
    nombreDestinatario: quotation.nombreDestinatario ?? null,
    emailDestinatario: quotation.emailDestinatario ?? null,
    telefonoDestinatario: quotation.telefonoDestinatario ?? null,
    identificacionDestinatario: quotation.identificacionDestinatario ?? null,
    comuna: quotation.comuna ?? null,
    cobraVisita: quotation.cobraVisita,
    total: quotation.total ?? 0,
    montoInsumos: quotation.montoInsumos,
    descuentoTipo: quotation.descuentoTipo as 'monto' | 'porcentaje',
    descuentoValor: quotation.descuentoValor,
    montoDescuento: quotation.montoDescuento,
    montoVisitaOriginal: quotation.montoVisitaOriginal,
    descuentoAfectaPagoEnfermera: quotation.descuentoAfectaPagoEnfermera,
    idVisita: quotation.idVisita ?? null,
    notas: quotation.notas ?? null,
    motivoRechazo: quotation.motivoRechazo ?? null,
    fechaEnvio: quotation.fechaEnvio ?? null,
    examIds: exams_.map((e) => e.idExamen),
    examPrices: exams_.map((e) => ({ idExamen: e.idExamen, precio: e.precio })),
    isapreExams: isapre_.map((e) => ({ idExamen: e.idExamen, valorCompleto: e.valorCompleto, valorPagar: e.valorPagar, idPrevision: e.idPrevision })),
    procedureIds: procs.map((p) => p.idProcedimiento),
    procedurePrices: procs.map((p) => ({ idProcedimiento: p.idProcedimiento, precio: p.precio })),
    tallerIds: talleres_.map((t) => t.idTaller),
    tallerPrices: talleres_.map((t) => ({ idTaller: t.idTaller, precio: t.precio })),
    surchargeIds: surcharges_.map((s) => s.idTipoRecargo),
    surchargePrices: surcharges_.map((s) => ({ idTipoRecargo: s.idTipoRecargo, precio: s.precio })),
  }
  })
}

// ─── getCotizacionVista ───────────────────────────────────────────────────

export async function getCotizacionVista(id: number): Promise<CotizacionVista | null> {
  return withQuery(async () => {
  const [quotation] = await db
    .select({
      id: quotations.id,
      estado: quotations.estado,
      idPaciente: quotations.idPaciente,
      nombreDestinatario: quotations.nombreDestinatario,
      emailDestinatario: quotations.emailDestinatario,
      telefonoDestinatario: quotations.telefonoDestinatario,
      identificacionDestinatario: quotations.identificacionDestinatario,
      comuna: quotations.comuna,
      cobraVisita: quotations.cobraVisita,
      total: quotations.total,
      montoInsumos: quotations.montoInsumos,
      descuentoTipo: quotations.descuentoTipo,
      descuentoValor: quotations.descuentoValor,
      montoDescuento: quotations.montoDescuento,
      montoVisitaOriginal: quotations.montoVisitaOriginal,
      descuentoAfectaPagoEnfermera: quotations.descuentoAfectaPagoEnfermera,
      idVisita: quotations.idVisita,
      notas: quotations.notas,
      motivoRechazo: quotations.motivoRechazo,
      fechaEnvio: quotations.fechaEnvio,
      createdAt: quotations.createdAt,
      updatedAt: quotations.updatedAt,
      pacienteNombres: patients.nombres,
      pacienteApellido: patients.apellidoPaterno,
      pacienteApellidoMaterno: patients.apellidoMaterno,
    })
    .from(quotations)
    .leftJoin(patients, eq(quotations.idPaciente, patients.id))
    .where(eq(quotations.id, id))

  if (!quotation) return null

  const [procs, exams_, isapre_, talleres_, surcharges_] = await Promise.all([
    db
      .select({
        id: quotationProcedures.idProcedimiento,
        nombre: quotationProcedures.descripcion,
        codigo: quotationProcedures.codigo,
        precio: quotationProcedures.precio,
      })
      .from(quotationProcedures)
      .where(eq(quotationProcedures.idCotizacion, id)),
    db
      .select({
        id: quotationExams.idExamen,
        nombre: quotationExams.descripcion,
        codigo: quotationExams.codigo,
        precio: quotationExams.precio,
      })
      .from(quotationExams)
      .where(eq(quotationExams.idCotizacion, id)),
    db
      .select({
        id: quotationIsapreExams.idExamen,
        nombre: quotationIsapreExams.descripcion,
        codigo: quotationIsapreExams.codigo,
        valorCompleto: quotationIsapreExams.valorCompleto,
        valorPagar: quotationIsapreExams.valorPagar,
        idPrevision: quotationIsapreExams.idPrevision,
      })
      .from(quotationIsapreExams)
      .where(eq(quotationIsapreExams.idCotizacion, id)),
    db
      .select({
        id: quotationWorkshops.idTaller,
        nombre: quotationWorkshops.descripcion,
        codigo: quotationWorkshops.codigo,
        precio: quotationWorkshops.precio,
      })
      .from(quotationWorkshops)
      .where(eq(quotationWorkshops.idCotizacion, id)),
    db
      .select({
        id: quotationSurcharges.idTipoRecargo,
        tipoNombre: surchargeTypes.nombre,
        precio: quotationSurcharges.precio,
      })
      .from(quotationSurcharges)
      .innerJoin(surchargeTypes, eq(quotationSurcharges.idTipoRecargo, surchargeTypes.id))
      .where(eq(quotationSurcharges.idCotizacion, id)),
  ])

  const precioVisita = quotation.cobraVisita && quotation.comuna
    ? (await getPrecioVisitaEnfermeria(db, quotation.comuna)) ?? 0
    : 0

  const pacienteNombre = quotation.pacienteNombres
    ? formatNombre({ nombres: quotation.pacienteNombres, apellidoPaterno: quotation.pacienteApellido, apellidoMaterno: quotation.pacienteApellidoMaterno })
    : null

  return {
    id: quotation.id,
    estado: quotation.estado,
    idPaciente: quotation.idPaciente ?? null,
    pacienteNombre,
    nombreDestinatario: quotation.nombreDestinatario ?? null,
    emailDestinatario: quotation.emailDestinatario ?? null,
    telefonoDestinatario: quotation.telefonoDestinatario ?? null,
    identificacionDestinatario: quotation.identificacionDestinatario ?? null,
    comuna: quotation.comuna ?? null,
    cobraVisita: quotation.cobraVisita,
    precioVisita,
    total: quotation.total ?? 0,
    montoInsumos: quotation.montoInsumos,
    descuentoTipo: quotation.descuentoTipo as 'monto' | 'porcentaje',
    descuentoValor: quotation.descuentoValor,
    montoDescuento: quotation.montoDescuento,
    montoVisitaOriginal: quotation.montoVisitaOriginal,
    descuentoAfectaPagoEnfermera: quotation.descuentoAfectaPagoEnfermera,
    idVisita: quotation.idVisita ?? null,
    notas: quotation.notas ?? null,
    motivoRechazo: quotation.motivoRechazo ?? null,
    fechaEnvio: quotation.fechaEnvio ?? null,
    createdAt: quotation.createdAt,
    updatedAt: quotation.updatedAt,
    procedimientos: procs,
    examenes: exams_,
    isapreExams: isapre_,
    talleres: talleres_,
    surcharges: surcharges_,
  }
  })
}

// ─── searchCotizaciones ───────────────────────────────────────────────────

export async function searchCotizaciones(
  params: SearchParams,
): Promise<{ rows: CotizacionRow[]; total: number }> {
  return withQuery(async () => {
  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const estado = (filters.estado as string | undefined)?.trim()

  const conditions: SQL[] = []
  if (buscar) {
    const normalized = buscar.replace(/[\.\-\s]/g, '').toUpperCase()
    const orConditions = [
      sql`unaccent(${patients.nombres} || ' ' || ${patients.apellidoPaterno} || ' ' || COALESCE(${patients.apellidoMaterno}, '')) ILIKE unaccent(${'%' + buscar + '%'})`,
      sql`${quotations.nombreDestinatario} ILIKE ${'%' + buscar + '%'}`,
      sql`${quotations.emailDestinatario} ILIKE ${'%' + buscar + '%'}`,
    ]
    const orCondition = or(...orConditions)
    if (orCondition) conditions.push(orCondition)
  }
  if (estado && estado !== 'todas') {
    conditions.push(eq(quotations.estado, estado))
  }

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(quotations)
    .leftJoin(patients, eq(quotations.idPaciente, patients.id))
    .where(and(...conditions))
    .then((r) => r[0]?.count ?? 0)

  const sortCols: Record<string, any> = {
    paciente: patients.apellidoPaterno,
    estado: quotations.estado,
    total: quotations.total,
    fecha: quotations.createdAt,
  }

  const sortCol = (sort?.key && sortCols[sort.key]) ?? quotations.createdAt
  const orderClause = sort?.dir === 'asc' ? asc(sortCol) : desc(sortCol)

  const rows = await db
    .select({
      id: quotations.id,
      createdAt: quotations.createdAt,
      estado: quotations.estado,
      pacienteNombre: patients.nombres,
      pacienteApellido: patients.apellidoPaterno,
      destinatario: quotations.nombreDestinatario,
      total: quotations.total,
      idVisita: quotations.idVisita,
    })
    .from(quotations)
    .leftJoin(patients, eq(quotations.idPaciente, patients.id))
    .where(and(...conditions))
    .orderBy(orderClause)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    rows: rows.map((r) => ({
      id: r.id,
      fecha: (r.createdAt.toISOString().split('T')[0]) || '',
      estado: r.estado,
      paciente: r.pacienteNombre ? formatNombre({ nombres: r.pacienteNombre, apellidoPaterno: r.pacienteApellido || '' }) : null,
      destinatario: r.destinatario,
      total: r.total ?? 0,
      idVisita: r.idVisita ?? null,
    })),
    total: countResult,
  }
  })
}

// ─── Schemas ──────────────────────────────────────────────────────────────

const cotizacionInputSchema = z.object({
  idPaciente: fields.nullableId,
  nombreDestinatario: fields.nullableStr,
  emailDestinatario: z
    .string()
    .trim()
    .pipe(
      z.union([
        z.literal(''),
        z.string().email('Email inválido'),
      ])
    )
    .optional()
    .transform((v) => v && v !== '' ? v : null),
  telefonoDestinatario: fields.nullableStr,
  identificacionDestinatario: fields.nullableStr,
  comuna: z.string().trim().min(1, 'Comuna requerida'),
  cobraVisita: fields.bool,
  montoInsumos: fields.montoInsumos,
  descuentoTipo: fields.descuentoTipo,
  descuentoValor: fields.descuentoValor,
  descuentoAfectaPagoEnfermera: fields.bool,
  notas: fields.nullableStr,
  procedure_ids: fields.ids,
  exam_ids: fields.ids,
  taller_ids: fields.ids,
  surcharge_ids: fields.ids,
})

const cotizacionCreateSchema = cotizacionInputSchema
const cotizacionUpdateSchema = cotizacionInputSchema.extend({ id: fields.id })

// ─── createCotizacion ──────────────────────────────────────────────────────

export async function createCotizacion(
  fd: FormData,
): Promise<ActionResult<{ id: number }>> {
  return withAction('Error al crear cotización', async () => {
  const parsed = parseFormDataWithArrays(cotizacionCreateSchema, fd, ['procedure_ids', 'exam_ids', 'taller_ids', 'surcharge_ids'])
  if (!parsed.success) throw new ActionError(parsed.error)

  const {
    idPaciente, nombreDestinatario, emailDestinatario, telefonoDestinatario,
    identificacionDestinatario, comuna, cobraVisita, montoInsumos,
    descuentoTipo, descuentoValor, descuentoAfectaPagoEnfermera,
    notas,
    procedure_ids: procedureIds, exam_ids: examIds, taller_ids: tallerIds, surcharge_ids: surchargeIds,
  } = parsed.data

  const descuentoValorFinal = cobraVisita ? descuentoValor : 0

  const tallerPrecioMap: Record<number, number> = {}
  for (const id of tallerIds) {
    tallerPrecioMap[id] = parseInt(fd.get(`taller_precio_${id}`) as string) || 0
  }

  const isapreExamIds = fd.getAll('isapre_exam_ids').map((v) => Number(v)).filter(Boolean)
  const isaprePrevisionId = fd.get('isapre_prevision_id') ? Number(fd.get('isapre_prevision_id')) : null
  const isapreExamData = isapreExamIds.map((examId) => ({
    idExamen: examId,
    valorCompleto: Number(fd.get(`isapre_exam_valor_${examId}`)) || 0,
    valorPagar: Number(fd.get(`isapre_exam_valor_pagar_${examId}`)) || 0,
    idPrevision: isaprePrevisionId,
  }))

  // Calculate total
  let total = 0

  // Get procedure prices
  if (procedureIds.length > 0) {
    const procs = await db
      .select({ precio: procedures.precio })
        .from(procedures)
        .where(inArray(procedures.id, procedureIds))
        .catch(() => [])

      total += procs.reduce((sum, p) => sum + p.precio, 0)
    }

    // Get exam prices
    if (examIds.length > 0) {
      const examRows = await db
        .select({ precio: exams.precio })
        .from(exams)
        .where(inArray(exams.id, examIds))
        .catch(() => [])

      total += examRows.reduce((sum, e) => sum + e.precio, 0)
    }

    // Add isapre exam copago to total
    total += isapreExamData.reduce((sum, e) => sum + e.valorPagar, 0)

    // Add taller prices (free-form per cotizacion)
    total += Object.values(tallerPrecioMap).reduce((sum, p) => sum + p, 0)

    // Add nursing visit price if requested
    let visitPrice = 0
    let montoVisitaOriginal = 0
    let montoDescuento = 0
    if (cobraVisita) {
      montoVisitaOriginal = (await getPrecioVisitaEnfermeria(db, comuna)) ?? 0
      montoDescuento = resolverMontoDescuento(montoVisitaOriginal, descuentoTipo, descuentoValorFinal)
      visitPrice = Math.max(0, montoVisitaOriginal - montoDescuento)
      total += visitPrice
    }

    // Get surcharge prices and add to total
    let surchargeItems: { id: number; precio: number }[] = []
    if (surchargeIds.length > 0) {
      surchargeItems = await db
        .select({ id: surchargeTypes.id, precio: surchargeTypes.precio })
        .from(surchargeTypes)
        .where(inArray(surchargeTypes.id, surchargeIds))
        .catch(() => [])
      total += surchargeItems.reduce((sum, s) => sum + s.precio, 0)
    }

    // Add monto de insumos to total (excluded from nurse payment calc)
    total += montoInsumos

    // Create quotation
    const inserted = await db
      .insert(quotations)
      .values({
        estado: 'creada',
        idPaciente,
        nombreDestinatario,
        emailDestinatario,
        telefonoDestinatario,
        identificacionDestinatario,
        comuna,
        cobraVisita,
        total,
        montoInsumos,
        descuentoTipo,
        descuentoValor: descuentoValorFinal,
        montoDescuento,
        montoVisitaOriginal,
        descuentoAfectaPagoEnfermera,
        notas,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (!inserted || !Array.isArray(inserted) || inserted.length === 0) {
      throw new ActionError('Error al crear la cotización')
    }

    const cotizacionId = inserted[0]!.id

    // Insert procedure items
    if (procedureIds.length > 0) {
      const procItems = await db
        .select({
          id: procedures.id,
          nombre: procedures.nombre,
          codigo: procedures.codigo,
          precio: procedures.precio,
        })
        .from(procedures)
        .where(inArray(procedures.id, procedureIds))

      await db.insert(quotationProcedures).values(
        procItems.map((p) => ({
          idCotizacion: cotizacionId,
          idProcedimiento: p.id,
          descripcion: p.nombre,
          codigo: p.codigo,
          precio: p.precio,
          createdAt: new Date(),
        })),
      )
    }

    // Insert exam items
    if (examIds.length > 0) {
      const examItems = await db
        .select({
          id: exams.id,
          nombre: exams.nombre,
          codigo: exams.codigo,
          precio: exams.precio,
        })
        .from(exams)
        .where(inArray(exams.id, examIds))

      await db.insert(quotationExams).values(
        examItems.map((e) => ({
          idCotizacion: cotizacionId,
          idExamen: e.id,
          descripcion: e.nombre,
          codigo: e.codigo,
          precio: e.precio,
          createdAt: new Date(),
        })),
      )
    }

    // Insert isapre exam items
    if (isapreExamData.length > 0) {
      const isapreExamCatalog = await db
        .select({ id: exams.id, nombre: exams.nombre, codigo: exams.codigo })
        .from(exams)
        .where(inArray(exams.id, isapreExamData.map((e) => e.idExamen)))

      const catalogMap = new Map(isapreExamCatalog.map((e) => [e.id, e]))
      await db.insert(quotationIsapreExams).values(
        isapreExamData.map((e) => ({
          idCotizacion: cotizacionId,
          idExamen: e.idExamen,
          descripcion: catalogMap.get(e.idExamen)?.nombre ?? '',
          codigo: catalogMap.get(e.idExamen)?.codigo ?? null,
          valorCompleto: e.valorCompleto,
          valorPagar: e.valorPagar,
          idPrevision: e.idPrevision,
          createdAt: new Date(),
        })),
      )
    }

    // Insert taller items
    if (tallerIds.length > 0) {
      const tallerItems = await db
        .select({ id: workshops.id, nombre: workshops.nombre, codigo: workshops.codigo })
        .from(workshops)
        .where(inArray(workshops.id, tallerIds))

      await db.insert(quotationWorkshops).values(
        tallerItems.map((t) => ({
          idCotizacion: cotizacionId,
          idTaller: t.id,
          descripcion: t.nombre,
          codigo: t.codigo,
          precio: tallerPrecioMap[t.id] ?? 0,
          createdAt: new Date(),
        })),
      )
    }

    // Insert surcharge items
    if (surchargeItems.length > 0) {
      await db.insert(quotationSurcharges).values(
        surchargeItems.map((s) => ({
          idCotizacion: cotizacionId,
          idTipoRecargo: s.id,
          precio: s.precio,
          createdAt: new Date(),
        })),
      )
    }

    revalidatePath('/cotizaciones')
    return { id: cotizacionId }
  })
}

// ─── updateCotizacion ──────────────────────────────────────────────────────

export async function updateCotizacion(
  fd: FormData,
): Promise<ActionResult<{ id: number }>> {
  return withAction('Error al actualizar cotización', async () => {
  const parsed = parseFormDataWithArrays(cotizacionUpdateSchema, fd, ['procedure_ids', 'exam_ids', 'taller_ids', 'surcharge_ids'])
  if (!parsed.success) throw new ActionError(parsed.error)

  const { id: parsedId } = parsed.data
  const [existing] = await db.select({ estado: quotations.estado }).from(quotations).where(eq(quotations.id, parsedId))
  if (existing?.estado !== 'creada') {
    throw new ActionError('Solo se pueden editar cotizaciones en estado creada')
  }

  const {
    id, idPaciente, nombreDestinatario, emailDestinatario, telefonoDestinatario,
    identificacionDestinatario, comuna, cobraVisita, montoInsumos,
    descuentoTipo, descuentoValor, descuentoAfectaPagoEnfermera,
    notas,
    procedure_ids: procedureIds, exam_ids: examIds, taller_ids: tallerIds, surcharge_ids: surchargeIds,
  } = parsed.data

  const descuentoValorFinal = cobraVisita ? descuentoValor : 0

  const tallerPrecioMap: Record<number, number> = {}
  for (const tid of tallerIds) {
    tallerPrecioMap[tid] = parseInt(fd.get(`taller_precio_${tid}`) as string) || 0
  }

  const isapreExamIds = fd.getAll('isapre_exam_ids').map((v) => Number(v)).filter(Boolean)
  const isaprePrevisionId = fd.get('isapre_prevision_id') ? Number(fd.get('isapre_prevision_id')) : null
  const isapreExamData = isapreExamIds.map((examId) => ({
    idExamen: examId,
    valorCompleto: Number(fd.get(`isapre_exam_valor_${examId}`)) || 0,
    valorPagar: Number(fd.get(`isapre_exam_valor_pagar_${examId}`)) || 0,
    idPrevision: isaprePrevisionId,
  }))

  // Calculate total
  let total = 0

    if (procedureIds.length > 0) {
      const procs = await db
        .select({ precio: procedures.precio })
        .from(procedures)
        .where(inArray(procedures.id, procedureIds))
        .catch(() => [])

      total += procs.reduce((sum, p) => sum + p.precio, 0)
    }

    if (examIds.length > 0) {
      const examRows = await db
        .select({ precio: exams.precio })
        .from(exams)
        .where(inArray(exams.id, examIds))
        .catch(() => [])

      total += examRows.reduce((sum, e) => sum + e.precio, 0)
    }

    // Add isapre exam copago to total
    total += isapreExamData.reduce((sum, e) => sum + e.valorPagar, 0)

    total += Object.values(tallerPrecioMap).reduce((sum, p) => sum + p, 0)

    let visitPrice = 0
    let montoVisitaOriginal = 0
    let montoDescuento = 0
    if (cobraVisita) {
      montoVisitaOriginal = (await getPrecioVisitaEnfermeria(db, comuna)) ?? 0
      montoDescuento = resolverMontoDescuento(montoVisitaOriginal, descuentoTipo, descuentoValorFinal)
      visitPrice = Math.max(0, montoVisitaOriginal - montoDescuento)
      total += visitPrice
    }

    // Get surcharge prices
    let surchargeItems: { id: number; precio: number }[] = []
    if (surchargeIds.length > 0) {
      surchargeItems = await db
        .select({ id: surchargeTypes.id, precio: surchargeTypes.precio })
        .from(surchargeTypes)
        .where(inArray(surchargeTypes.id, surchargeIds))
        .catch(() => [])
      total += surchargeItems.reduce((sum, s) => sum + s.precio, 0)
    }

    // Add monto de insumos to total (excluded from nurse payment calc)
    total += montoInsumos

    // Update quotation
    await db
      .update(quotations)
      .set({
        idPaciente,
        nombreDestinatario,
        emailDestinatario,
        telefonoDestinatario,
        identificacionDestinatario,
        comuna,
        cobraVisita,
        total,
        montoInsumos,
        descuentoTipo,
        descuentoValor: descuentoValorFinal,
        montoDescuento,
        montoVisitaOriginal,
        descuentoAfectaPagoEnfermera,
        notas,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, id))

    // Delete existing items
    await db.delete(quotationProcedures).where(eq(quotationProcedures.idCotizacion, id))
    await db.delete(quotationExams).where(eq(quotationExams.idCotizacion, id))
    await db.delete(quotationIsapreExams).where(eq(quotationIsapreExams.idCotizacion, id))
    await db.delete(quotationWorkshops).where(eq(quotationWorkshops.idCotizacion, id))
    await db.delete(quotationSurcharges).where(eq(quotationSurcharges.idCotizacion, id))

    // Insert procedure items
    if (procedureIds.length > 0) {
      const procItems = await db
        .select({
          id: procedures.id,
          nombre: procedures.nombre,
          codigo: procedures.codigo,
          precio: procedures.precio,
        })
        .from(procedures)
        .where(inArray(procedures.id, procedureIds))

      await db.insert(quotationProcedures).values(
        procItems.map((p) => ({
          idCotizacion: id,
          idProcedimiento: p.id,
          descripcion: p.nombre,
          codigo: p.codigo,
          precio: p.precio,
          createdAt: new Date(),
        })),
      )
    }

    // Insert exam items
    if (examIds.length > 0) {
      const examItems = await db
        .select({
          id: exams.id,
          nombre: exams.nombre,
          codigo: exams.codigo,
          precio: exams.precio,
        })
        .from(exams)
        .where(inArray(exams.id, examIds))

      await db.insert(quotationExams).values(
        examItems.map((e) => ({
          idCotizacion: id,
          idExamen: e.id,
          descripcion: e.nombre,
          codigo: e.codigo,
          precio: e.precio,
          createdAt: new Date(),
        })),
      )
    }

    // Insert isapre exam items
    if (isapreExamData.length > 0) {
      const isapreExamCatalog = await db
        .select({ id: exams.id, nombre: exams.nombre, codigo: exams.codigo })
        .from(exams)
        .where(inArray(exams.id, isapreExamData.map((e) => e.idExamen)))

      const catalogMap = new Map(isapreExamCatalog.map((e) => [e.id, e]))
      await db.insert(quotationIsapreExams).values(
        isapreExamData.map((e) => ({
          idCotizacion: id,
          idExamen: e.idExamen,
          descripcion: catalogMap.get(e.idExamen)?.nombre ?? '',
          codigo: catalogMap.get(e.idExamen)?.codigo ?? null,
          valorCompleto: e.valorCompleto,
          valorPagar: e.valorPagar,
          idPrevision: e.idPrevision,
          createdAt: new Date(),
        })),
      )
    }

    // Insert taller items
    if (tallerIds.length > 0) {
      const tallerItems = await db
        .select({ id: workshops.id, nombre: workshops.nombre, codigo: workshops.codigo })
        .from(workshops)
        .where(inArray(workshops.id, tallerIds))

      await db.insert(quotationWorkshops).values(
        tallerItems.map((t) => ({
          idCotizacion: id,
          idTaller: t.id,
          descripcion: t.nombre,
          codigo: t.codigo,
          precio: tallerPrecioMap[t.id] ?? 0,
          createdAt: new Date(),
        })),
      )
    }

    // Insert surcharge items
    if (surchargeItems.length > 0) {
      await db.insert(quotationSurcharges).values(
        surchargeItems.map((s) => ({
          idCotizacion: id,
          idTipoRecargo: s.id,
          precio: s.precio,
          createdAt: new Date(),
        })),
      )
    }

    revalidatePath('/cotizaciones')
    revalidatePath(`/cotizaciones/${id}`)
    return { id }
  })
}

// ─── deleteCotizacion ──────────────────────────────────────────────────────

export async function deleteCotizacion(id: number): Promise<ActionResult> {
  return withAction('Error al eliminar cotización', async () => {
    const [quotation] = await db.select({ estado: quotations.estado }).from(quotations).where(eq(quotations.id, id))
    if (quotation?.estado !== 'creada') {
      throw new ActionError('Solo se pueden eliminar cotizaciones en estado creada')
    }
    await db.delete(quotations).where(eq(quotations.id, id))
    revalidatePath('/cotizaciones')
  })
}

// ─── convertirCotizacionAVisita ────────────────────────────────────────────

export async function convertirCotizacionAVisita(
  idCotizacion: number,
  idPatient?: number,
): Promise<ActionResult<{ idVisita: number }>> {
  return withAction('Error al convertir cotización a visita', async () => {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, idCotizacion))

    if (!quotation) throw new ActionError('Cotización no encontrada')

    // Determine patient ID
    let finalIdPaciente = quotation.idPaciente
    if (!finalIdPaciente && idPatient) {
      finalIdPaciente = idPatient
    }

    if (!finalIdPaciente) throw new ActionError('Se requiere un paciente para convertir a visita')

    // Create visit
    const hoy = new Date().toISOString().split('T')[0] || '2026-01-01'
    const insertedVisits = await db
      .insert(visits)
      .values({
        fecha: hoy,
        estado: 'programada',
        costo: quotation.total ?? 0,
        montoInsumos: quotation.montoInsumos ?? 0,
        idPaciente: finalIdPaciente,
        cobraVisita: quotation.cobraVisita,
        descuentoTipo: quotation.descuentoTipo,
        descuentoValor: quotation.descuentoValor,
        montoDescuento: quotation.montoDescuento ?? 0,
        montoVisitaOriginal: quotation.montoVisitaOriginal ?? 0,
        descuentoAfectaPagoEnfermera: quotation.descuentoAfectaPagoEnfermera,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (!insertedVisits || insertedVisits.length === 0) {
      throw new ActionError('Error al crear la visita')
    }

    const visitId = insertedVisits[0]!.id

    // Copy procedures
    const procs = await db
      .select({
        idProcedimiento: quotationProcedures.idProcedimiento,
        precio: quotationProcedures.precio,
      })
      .from(quotationProcedures)
      .where(eq(quotationProcedures.idCotizacion, idCotizacion))

    if (procs.length > 0) {
      await db.insert(visitProcedures).values(
        procs.map((p) => ({
          idProcedimiento: p.idProcedimiento,
          idVisita: visitId,
          precio: p.precio,
          createdAt: new Date(),
        })),
      )
    }

    // Copy exams
    const examItems = await db
      .select({
        idExamen: quotationExams.idExamen,
        precio: quotationExams.precio,
      })
      .from(quotationExams)
      .where(eq(quotationExams.idCotizacion, idCotizacion))

    if (examItems.length > 0) {
      await db.insert(visitExams).values(
        examItems.map((e) => ({
          idExamen: e.idExamen,
          idVisita: visitId,
          precio: e.precio,
          createdAt: new Date(),
        })),
      )
    }

    // Copy isapre exams
    const isapreItems = await db
      .select({
        idExamen: quotationIsapreExams.idExamen,
        valorCompleto: quotationIsapreExams.valorCompleto,
        valorPagar: quotationIsapreExams.valorPagar,
        idPrevision: quotationIsapreExams.idPrevision,
      })
      .from(quotationIsapreExams)
      .where(eq(quotationIsapreExams.idCotizacion, idCotizacion))

    if (isapreItems.length > 0) {
      await db.insert(visitIsapreExams).values(
        isapreItems.map((e) => ({
          idExamen: e.idExamen,
          idVisita: visitId,
          valorCompleto: e.valorCompleto,
          valorPagar: e.valorPagar,
          idPrevision: e.idPrevision,
          createdAt: new Date(),
        })),
      )
    }

    // Copy talleres
    const tallerItems = await db
      .select({ idTaller: quotationWorkshops.idTaller, precio: quotationWorkshops.precio })
      .from(quotationWorkshops)
      .where(eq(quotationWorkshops.idCotizacion, idCotizacion))

    if (tallerItems.length > 0) {
      await db.insert(visitWorkshops).values(
        tallerItems.map((t) => ({
          idTaller: t.idTaller,
          idVisita: visitId,
          precio: t.precio,
          createdAt: new Date(),
        })),
      )
    }

    // Copy recargos
    const surchargeItems = await db
      .select({ idTipoRecargo: quotationSurcharges.idTipoRecargo, precio: quotationSurcharges.precio })
      .from(quotationSurcharges)
      .where(eq(quotationSurcharges.idCotizacion, idCotizacion))

    if (surchargeItems.length > 0) {
      await db.insert(visitSurcharges).values(
        surchargeItems.map((s) => ({
          idTipoRecargo: s.idTipoRecargo,
          idVisita: visitId,
          precio: s.precio,
          createdAt: new Date(),
        })),
      )
    }

    // Update quotation
    await db
      .update(quotations)
      .set({
        estado: 'aceptada',
        idVisita: visitId,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, idCotizacion))

    revalidatePath('/cotizaciones')
    revalidatePath('/visitas')
    return { idVisita: visitId }
  })
}

// ─── marcarEnviada ────────────────────────────────────────────────────────

export async function marcarEnviada(id: number): Promise<ActionResult> {
  return withAction('Error al marcar cotización como enviada', async () => {
    const [quotation] = await db.select({ estado: quotations.estado }).from(quotations).where(eq(quotations.id, id))
    if (!quotation) throw new ActionError('Cotización no encontrada')
    if (quotation.estado !== 'creada') throw new ActionError('Solo se puede marcar como enviada una cotización en estado creada')
    await db.update(quotations).set({ estado: 'enviada', fechaEnvio: new Date(), updatedAt: new Date() }).where(eq(quotations.id, id))
    revalidatePath('/cotizaciones')
    revalidatePath(`/cotizaciones/${id}`)
  })
}

// ─── aceptarCotizacion ────────────────────────────────────────────────────

export async function aceptarCotizacion(
  idCotizacion: number,
  idPatient?: number,
): Promise<ActionResult<{ idVisita: number }>> {
  return withAction('Error al aceptar cotización', async () => {
    const [quotation] = await db.select({ estado: quotations.estado }).from(quotations).where(eq(quotations.id, idCotizacion))
    if (!quotation) throw new ActionError('Cotización no encontrada')
    if (quotation.estado !== 'enviada') throw new ActionError('Solo se puede aceptar una cotización en estado enviada')
    const result = await convertirCotizacionAVisita(idCotizacion, idPatient)
    if (!result.success) throw new ActionError(result.error ?? 'Error al convertir cotización')
    return { idVisita: result.data.idVisita }
  })
}

// ─── rechazarCotizacion ───────────────────────────────────────────────────

export async function rechazarCotizacion(id: number, motivo: string): Promise<ActionResult> {
  return withAction('Error al rechazar cotización', async () => {
    if (!motivo.trim()) throw new ActionError('El motivo de rechazo es requerido')
    const [quotation] = await db.select({ estado: quotations.estado }).from(quotations).where(eq(quotations.id, id))
    if (!quotation) throw new ActionError('Cotización no encontrada')
    if (quotation.estado !== 'enviada') throw new ActionError('Solo se puede rechazar una cotización en estado enviada')
    await db.update(quotations).set({ estado: 'rechazada', motivoRechazo: motivo.trim(), updatedAt: new Date() }).where(eq(quotations.id, id))
    revalidatePath('/cotizaciones')
    revalidatePath(`/cotizaciones/${id}`)
  })
}

// ─── getPreciosVisita ─────────────────────────────────────────────────────

export async function getPreciosVisita(): Promise<Record<string, number>> {
  return withQuery(async () => {
    const rows = await db
      .select({ comuna: nursingVisitPrices.comuna, precio: nursingVisitPrices.precio })
      .from(nursingVisitPrices)
      .where(eq(nursingVisitPrices.activo, true))
    const map: Record<string, number> = {}
    for (const row of rows) {
      if (row.comuna === null) map['__base__'] = row.precio
      else map[row.comuna] = row.precio
    }
    return map
  })
}

'use server'

import { z } from 'zod'
import { db } from '@/db'
import {
  quotations,
  quotationExams,
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
  visitWorkshops,
  visitSurcharges,
  nursingVisitPrices,
} from '@/db/schema'
import { eq, and, or, ilike, asc, desc, SQL, sql, isNull, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { SearchParams, Result } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'
import { formatNombre } from '@/lib/paciente'
import { getPrecioVisitaEnfermeria } from '@/lib/pricing/visitas'
import { parseFormDataWithArrays, fields } from '@/lib/validation'

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
  idVisita: number | null
  notas: string | null
  examIds: number[]
  examPrices: { idExamen: number; precio: number }[]
  procedureIds: number[]
  procedurePrices: { idProcedimiento: number; precio: number }[]
  tallerIds: number[]
  tallerPrices: { idTaller: number; precio: number }[]
  surchargeIds: number[]
  surchargePrices: { idTipoRecargo: number; precio: number }[]
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
  await requireSession()

  const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id))
  if (!quotation) return null

  const [exams_, procs, talleres_, surcharges_] = await Promise.all([
    db
      .select({ idExamen: quotationExams.idExamen, precio: quotationExams.precio })
      .from(quotationExams)
      .where(eq(quotationExams.idCotizacion, id)),
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
    idVisita: quotation.idVisita ?? null,
    notas: quotation.notas ?? null,
    examIds: exams_.map((e) => e.idExamen),
    examPrices: exams_.map((e) => ({ idExamen: e.idExamen, precio: e.precio })),
    procedureIds: procs.map((p) => p.idProcedimiento),
    procedurePrices: procs.map((p) => ({ idProcedimiento: p.idProcedimiento, precio: p.precio })),
    tallerIds: talleres_.map((t) => t.idTaller),
    tallerPrices: talleres_.map((t) => ({ idTaller: t.idTaller, precio: t.precio })),
    surchargeIds: surcharges_.map((s) => s.idTipoRecargo),
    surchargePrices: surcharges_.map((s) => ({ idTipoRecargo: s.idTipoRecargo, precio: s.precio })),
  }
}

// ─── searchCotizaciones ───────────────────────────────────────────────────

export async function searchCotizaciones(
  params: SearchParams,
): Promise<{ rows: CotizacionRow[]; total: number }> {
  await requireSession()

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
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  await requireSession()

  const parsed = parseFormDataWithArrays(cotizacionCreateSchema, fd, ['procedure_ids', 'exam_ids', 'taller_ids', 'surcharge_ids'])
  if (!parsed.success) return parsed

  const {
    idPaciente, nombreDestinatario, emailDestinatario, telefonoDestinatario,
    identificacionDestinatario, comuna, cobraVisita,
    notas,
    procedure_ids: procedureIds, exam_ids: examIds, taller_ids: tallerIds, surcharge_ids: surchargeIds,
  } = parsed.data

  const tallerPrecioMap: Record<number, number> = {}
  for (const id of tallerIds) {
    tallerPrecioMap[id] = parseInt(fd.get(`taller_precio_${id}`) as string) || 0
  }

  try {
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

    // Add taller prices (free-form per cotizacion)
    total += Object.values(tallerPrecioMap).reduce((sum, p) => sum + p, 0)

    // Add nursing visit price if requested
    let visitPrice = 0
    if (cobraVisita) {
      visitPrice = (await getPrecioVisitaEnfermeria(db, comuna)) ?? 0
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

    // Create quotation
    const inserted = await db
      .insert(quotations)
      .values({
        estado: 'borrador',
        idPaciente,
        nombreDestinatario,
        emailDestinatario,
        telefonoDestinatario,
        identificacionDestinatario,
        comuna,
        cobraVisita,
        total,
        notas,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (!inserted || !Array.isArray(inserted) || inserted.length === 0) {
      return { success: false, error: 'Error al crear la cotización' }
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
    return { success: true, id: cotizacionId }
  } catch (error) {
    console.error('Error creating cotizacion:', error)
    return { success: false, error: 'Error al crear cotización' }
  }
}

// ─── updateCotizacion ──────────────────────────────────────────────────────

export async function updateCotizacion(
  fd: FormData,
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  await requireSession()

  const parsed = parseFormDataWithArrays(cotizacionUpdateSchema, fd, ['procedure_ids', 'exam_ids', 'taller_ids', 'surcharge_ids'])
  if (!parsed.success) return parsed

  const {
    id, idPaciente, nombreDestinatario, emailDestinatario, telefonoDestinatario,
    identificacionDestinatario, comuna, cobraVisita,
    notas,
    procedure_ids: procedureIds, exam_ids: examIds, taller_ids: tallerIds, surcharge_ids: surchargeIds,
  } = parsed.data

  const tallerPrecioMap: Record<number, number> = {}
  for (const tid of tallerIds) {
    tallerPrecioMap[tid] = parseInt(fd.get(`taller_precio_${tid}`) as string) || 0
  }

  try {
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

    total += Object.values(tallerPrecioMap).reduce((sum, p) => sum + p, 0)

    let visitPrice = 0
    if (cobraVisita) {
      visitPrice = (await getPrecioVisitaEnfermeria(db, comuna)) ?? 0
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
        notas,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, id))

    // Delete existing items
    await db.delete(quotationProcedures).where(eq(quotationProcedures.idCotizacion, id))
    await db.delete(quotationExams).where(eq(quotationExams.idCotizacion, id))
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
    return { success: true, id }
  } catch (error) {
    console.error('Error updating cotizacion:', error)
    return { success: false, error: 'Error al actualizar cotización' }
  }
}

// ─── deleteCotizacion ──────────────────────────────────────────────────────

export async function deleteCotizacion(id: number): Promise<Result> {
  await requireSession()

  try {
    // Only allow deleting draft quotations
    const [quotation] = await db.select({ estado: quotations.estado }).from(quotations).where(eq(quotations.id, id))

    if (quotation?.estado !== 'borrador') {
      return { success: false, error: 'Solo se pueden eliminar cotizaciones en borrador' }
    }

    await db.delete(quotations).where(eq(quotations.id, id))
    revalidatePath('/cotizaciones')
    return { success: true }
  } catch (error) {
    console.error('Error deleting cotizacion:', error)
    return { success: false, error: 'Error al eliminar cotización' }
  }
}

// ─── convertirCotizacionAVisita ────────────────────────────────────────────

export async function convertirCotizacionAVisita(
  idCotizacion: number,
  idPatient?: number,
): Promise<{ success: true; idVisita: number } | { success: false; error: string }> {
  await requireSession()

  try {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, idCotizacion))

    if (!quotation) {
      return { success: false, error: 'Cotización no encontrada' }
    }

    // Determine patient ID
    let finalIdPaciente = quotation.idPaciente
    if (!finalIdPaciente && idPatient) {
      finalIdPaciente = idPatient
    }

    if (!finalIdPaciente) {
      return { success: false, error: 'Se requiere un paciente para convertir a visita' }
    }

    // Create visit
    const hoy = new Date().toISOString().split('T')[0] || '2026-01-01'
    const insertedVisits = await db
      .insert(visits)
      .values({
        fecha: hoy,
        estado: 'creada',
        costo: quotation.total ?? 0,
        idPaciente: finalIdPaciente,
        cobraVisita: quotation.cobraVisita,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (!insertedVisits || insertedVisits.length === 0) {
      return { success: false, error: 'Error al crear la visita' }
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
        estado: 'convertida',
        idVisita: visitId,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, idCotizacion))

    revalidatePath('/cotizaciones')
    revalidatePath('/visitas')
    return { success: true, idVisita: visitId }
  } catch (error) {
    console.error('Error converting cotizacion to visit:', error)
    return { success: false, error: 'Error al convertir cotización a visita' }
  }
}

// ─── getPreciosVisita ─────────────────────────────────────────────────────

export async function getPreciosVisita(): Promise<Record<string, number>> {
  await requireSession()

  const rows = await db
    .select({ comuna: nursingVisitPrices.comuna, precio: nursingVisitPrices.precio })
    .from(nursingVisitPrices)
    .where(eq(nursingVisitPrices.activo, true))

  const map: Record<string, number> = {}
  for (const row of rows) {
    if (row.comuna === null) {
      map['__base__'] = row.precio
    } else {
      map[row.comuna] = row.precio
    }
  }
  return map
}

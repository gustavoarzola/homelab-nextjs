'use server'

import { z } from 'zod'
import { db } from '@/db'
import { contactOrigins, visits, visitProcedures, visitExams, visitWorkshops, visitSurcharges, workshops, patients, nurses, laboratories, procedures, exams, healthInsurances, addresses, nursingVisitPrices, surchargeTypes } from '@/db/schema'
import { eq, count, and, or, ilike, gte, lte, asc, desc, SQL, sql, inArray, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { SearchParams, Result } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'
import { formatNombre } from '@/lib/paciente'
import { actualizarCostoVisitaPersistida } from '@/lib/pricing/visitas'
import type { VisitaFormPricingContext } from '@/lib/pricing/visita-preview'
import { parseFormDataWithArrays, fields } from '@/lib/validation'

// ─── getEnfermeras ────────────────────────────────────────────────────────────

export async function getEnfermeras(): Promise<{ id: number; nombre: string }[]> {
  await requireSession()

  const rows = await db
    .select({ id: nurses.id, nombres: nurses.nombres, apellidoPaterno: nurses.apellidoPaterno })
    .from(nurses)
    .where(eq(nurses.activo, true))
    .orderBy(asc(nurses.apellidoPaterno))

  return rows.map((r) => ({
    id: r.id,
    nombre: formatNombre(r),
  }))
}

// ─── getTiposRecargos ──────────────────────────────────────────────────────────

export async function getTiposRecargos(): Promise<{ id: number; label: string; precio: number }[]> {
  await requireSession()

  const rows = await db
    .select({ id: surchargeTypes.id, nombre: surchargeTypes.nombre, precio: surchargeTypes.precio })
    .from(surchargeTypes)
    .where(eq(surchargeTypes.activo, true))
    .orderBy(asc(surchargeTypes.nombre))

  return rows.map((r) => ({
    id: r.id,
    label: r.nombre,
    precio: r.precio,
  }))
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
  idLaboratorio: number | null
  numeroBoleta: string
  tipoDocumento: string
  numeroAtencion: number | null
  origenContacto: string | null
  informacionAdicional: string
  pagado: boolean
  metodoPago: string | null
  fechaPago: string | null
  resultadosEnviados: boolean
  fechaEnvioResultados: string | null
  costoTraslado: number
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
  laboratorio: string | null
  pagado: boolean
  resultadosEnviados: boolean
  keyOrdenMedica: string | null
}

// ─── Visitas query helpers (internal) ─────────────────────────────────────────

function buildVisitasWhere(filters: SearchParams['filters']): SQL | undefined {
  const buscar = (filters.buscar as string | undefined)?.trim()
  const estado = (filters.estado as string | undefined)?.trim()
  const enfermeraId = (filters.enfermera as string | undefined)?.trim()
  const fechaInicio = (filters.fechaInicio as string | undefined)?.trim()
  const fechaFin = (filters.fechaFin as string | undefined)?.trim()
  const pendientePago = filters.pendientePago as boolean | undefined
  const resultadosPendientes = filters.resultadosPendientes as boolean | undefined

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
  if (pendientePago) conditions.push(and(eq(visits.pagado, false), eq(visits.estado, 'realizada'))!)
  if (resultadosPendientes) conditions.push(and(eq(visits.resultadosEnviados, false), eq(visits.estado, 'realizada'))!)

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
  pagado: visits.pagado,
  resultadosEnviados: visits.resultadosEnviados,
  pacienteNombres: patients.nombres,
  pacienteApellido: patients.apellidoPaterno,
  pacienteApellidoMaterno: patients.apellidoMaterno,
  enfermeraNombres: nurses.nombres,
  enfermeraApellido: nurses.apellidoPaterno,
  enfermeraApellidoMaterno: nurses.apellidoMaterno,
  laboratorio: laboratories.nombre,
  keyOrdenMedica: visits.keyOrdenMedica,
}

type VisitaRawRow = {
  id: number
  fecha: string
  hora: string | null
  estado: string
  costo: number
  idPaciente: number | null
  pagado: boolean
  resultadosEnviados: boolean
  pacienteNombres: string | null
  pacienteApellido: string | null
  pacienteApellidoMaterno: string | null
  enfermeraNombres: string | null
  enfermeraApellido: string | null
  enfermeraApellidoMaterno: string | null
  laboratorio: string | null
  keyOrdenMedica: string | null
}

function mapVisitaRow(r: VisitaRawRow): VisitaRow {
  return {
    id: r.id,
    activo: r.estado !== 'cancelada',
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
    laboratorio: r.laboratorio ?? null,
    pagado: r.pagado,
    resultadosEnviados: r.resultadosEnviados,
    keyOrdenMedica: r.keyOrdenMedica ?? null,
  }
}

// ─── searchVisitas ────────────────────────────────────────────────────────────

export async function searchVisitas(
  params: SearchParams,
): Promise<{ rows: VisitaRow[]; total: number }> {
  await requireSession()

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
    .leftJoin(laboratories, eq(visits.idLaboratorio, laboratories.id))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { rows: rawRows.map(mapVisitaRow), total: Number(countRow?.total ?? 0) }
}

// ─── listVisitasForExport ─────────────────────────────────────────────────────

export async function listVisitasForExport(
  filters: SearchParams['filters'],
  sort: SearchParams['sort'],
): Promise<VisitaRow[]> {
  await requireSession()

  const where = buildVisitasWhere(filters)
  const order = buildVisitasOrder(sort)

  const rawRows = await db
    .select(visitaRowSelect)
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .leftJoin(nurses, eq(visits.idEnfermera, nurses.id))
    .leftJoin(laboratories, eq(visits.idLaboratorio, laboratories.id))
    .where(where)
    .orderBy(order)

  return rawRows.map(mapVisitaRow)
}


// ─── getVisitaFormPricingContext ─────────────────────────────────────────────

export async function getVisitaFormPricingContext(
  idPaciente: number,
  examIds: number[],
): Promise<VisitaFormPricingContext> {
  await requireSession()

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
}

// ─── getVisita ────────────────────────────────────────────────────────────────

export async function getVisita(id: number): Promise<VisitaDetalle | null> {
  await requireSession()

  const [visit] = await db.select().from(visits).where(eq(visits.id, id))
  if (!visit) return null

  const [procs, exams_, talleres_, surcharges_] = await Promise.all([
    db.select({ idProcedimiento: visitProcedures.idProcedimiento, precio: visitProcedures.precio }).from(visitProcedures).where(eq(visitProcedures.idVisita, id)),
    db.select({ idExamen: visitExams.idExamen, precio: visitExams.precio }).from(visitExams).where(eq(visitExams.idVisita, id)),
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
    idLaboratorio: visit.idLaboratorio ?? null,
    numeroBoleta: visit.numeroBoleta ?? '',
    tipoDocumento: visit.tipoDocumento ?? '',
    numeroAtencion: visit.numeroAtencion ?? null,
    origenContacto: visit.origenContacto ?? null,
    informacionAdicional: visit.informacionAdicional ?? '',
    pagado: visit.pagado,
    metodoPago: visit.metodoPago ?? null,
    fechaPago: visit.fechaPago ?? null,
    resultadosEnviados: visit.resultadosEnviados,
    fechaEnvioResultados: visit.fechaEnvioResultados ?? null,
    costoTraslado: visit.costoTraslado,
    cobraVisita: visit.cobraVisita,
    keyOrdenMedica: visit.keyOrdenMedica ?? null,
    procedureIds: procs.map((p) => p.idProcedimiento),
    procedurePrices: procs.map((p) => ({ idProcedimiento: p.idProcedimiento, precio: p.precio })),
    examIds: exams_.map((e) => e.idExamen),
    examPrices: exams_.map((e) => ({ idExamen: e.idExamen, precio: e.precio })),
    tallerIds: talleres_.map((t) => t.idTaller),
    tallerPrices: talleres_.map((t) => ({ idTaller: t.idTaller, precio: t.precio })),
    surchargeIds: surcharges_.map((s) => s.idTipoRecargo),
    surchargePrices: surcharges_.map((s) => ({ idTipoRecargo: s.idTipoRecargo, precio: s.precio })),
  }
}

// ─── deleteVisita ─────────────────────────────────────────────────────────────

export async function deleteVisita(id: number): Promise<Result> {
  await requireSession()

  try {
    await db.delete(visits).where(eq(visits.id, id))
    revalidatePath('/visitas')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al eliminar la visita' }
  }
}

// ─── searchOrigenesContacto ───────────────────────────────────────────────────

export async function searchOrigenesContacto(): Promise<{ id: number; nombre: string }[]> {
  await requireSession()

  return db
    .select({ id: contactOrigins.id, nombre: contactOrigins.nombre })
    .from(contactOrigins)
    .where(eq(contactOrigins.activo, true))
    .orderBy(asc(contactOrigins.nombre))
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const visitaSharedFields = {
  fecha: fields.fechaRequerida,
  hora: fields.nullableStr,
  idEnfermera: fields.nullableId,
  idLaboratorio: fields.nullableId,
  numeroBoleta: z.string().trim().max(20, 'N° boleta máximo 20 caracteres').optional().default(''),
  tipoDocumento: z.enum(['boleta', 'factura', '']).optional().default(''),
  numeroAtencion: z.string().trim().optional().transform((v) => (v ? Number(v) || null : null)),
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

const visitaUpdateSchema = z
  .object({
    id: fields.id,
    estado: z.enum(['creada', 'asignada', 'realizada', 'cancelada']).optional().default('creada'),
    pagado: fields.bool,
    metodoPago: fields.nullableStr,
    fechaPago: fields.nullableStr,
    resultadosEnviados: fields.bool,
    fechaEnvioResultados: fields.nullableStr,
    costoTraslado: z.coerce.number().int().min(0).default(0),
    keyOrdenMedica: fields.nullableStr,
    ...visitaSharedFields,
  })
  .superRefine((data, ctx) => {
    if (data.estado === 'realizada') {
      if (!data.numeroBoleta) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['numeroBoleta'], message: 'N° boleta/factura requerido para marcar como realizada' })
      if (!data.tipoDocumento) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tipoDocumento'], message: 'Tipo de documento requerido para marcar como realizada' })
      if (!data.numeroAtencion) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['numeroAtencion'], message: 'N° atención requerido para marcar como realizada' })
    }
  })

// ─── updateVisita ─────────────────────────────────────────────────────────────

export async function updateVisita(
  fd: FormData,
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  await requireSession()

  const parsed = parseFormDataWithArrays(visitaUpdateSchema, fd, ['procedure_ids', 'exam_ids', 'taller_ids', 'surcharge_ids'])
  if (!parsed.success) return parsed

  const {
    id, fecha, hora, estado, idEnfermera, idLaboratorio, numeroBoleta, tipoDocumento,
    numeroAtencion, origenContacto, informacionAdicional, pagado, metodoPago, fechaPago,
    resultadosEnviados, fechaEnvioResultados, costoTraslado, cobraVisita,
    keyOrdenMedica,
    procedure_ids: procedureIds, exam_ids: examIds, taller_ids: tallerIds, surcharge_ids: surchargeIds,
  } = parsed.data

  const tallerPrices = tallerIds.map((idTaller) => ({
    idTaller,
    precio: Number(fd.get(`taller_precio_${idTaller}`)) || 0,
  }))

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(visits)
        .set({ fecha, hora, estado, idEnfermera, idLaboratorio, numeroBoleta, tipoDocumento, numeroAtencion, origenContacto, informacionAdicional, pagado, metodoPago, fechaPago, resultadosEnviados, fechaEnvioResultados, costoTraslado, cobraVisita, keyOrdenMedica, updatedAt: new Date() })
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
    })

    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
    return { success: true, id }
  } catch (err) {
    console.error('[updateVisita] error:', err)
    // Drizzle wraps the PG error in err.cause
    const pgErr = ((err as { cause?: unknown })?.cause ?? err) as { code?: string; constraint_name?: string }
    const code = pgErr?.code
    const constraint = pgErr?.constraint_name ?? ''
    if (code === '23505') {
      if (constraint.includes('numero_atencion')) {
        return { success: false, error: 'El N° de atención ya está registrado en otra visita' }
      }
      if (constraint.includes('numero_boleta')) {
        return { success: false, error: 'El N° de boleta/factura ya está registrado en otra visita con el mismo tipo de documento' }
      }
      return { success: false, error: 'Ya existe un registro con los mismos datos únicos' }
    }
    if (code === '22001') {
      return { success: false, error: 'El N° de boleta/factura es demasiado largo (máximo 20 caracteres)' }
    }
    return { success: false, error: 'Error al actualizar la visita' }
  }
}

// ─── createVisita ─────────────────────────────────────────────────────────────

export async function createVisita(
  fd: FormData,
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  await requireSession()

  const parsed = parseFormDataWithArrays(visitaCreateSchema, fd, ['procedure_ids', 'exam_ids', 'taller_ids', 'surcharge_ids'])
  if (!parsed.success) return parsed

  const {
    idPaciente, fecha, hora, idEnfermera, idLaboratorio, numeroBoleta, tipoDocumento,
    numeroAtencion, origenContacto, informacionAdicional, cobraVisita,
    procedure_ids: procedureIds, exam_ids: examIds, taller_ids: tallerIds, surcharge_ids: surchargeIds,
  } = parsed.data

  const tallerPrices = tallerIds.map((idTaller) => ({
    idTaller,
    precio: Number(fd.get(`taller_precio_${idTaller}`)) || 0,
  }))

  try {
    const visitId = await db.transaction(async (tx) => {
      const [visit] = await tx
        .insert(visits)
        .values({
          fecha, hora, estado: 'creada', costo: 0,
          idPaciente, idEnfermera, idLaboratorio, numeroBoleta, tipoDocumento,
          numeroAtencion, origenContacto, informacionAdicional,
          pagado: false, resultadosEnviados: false, costoTraslado: 0,
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

      return id
    })

    revalidatePath('/visitas')
    return { success: true, id: visitId }
  } catch {
    return { success: false, error: 'Error al crear la visita' }
  }
}

// ─── actualizarPrecioExamenVisita ─────────────────────────────────────────────

export async function actualizarPrecioExamenVisita(
  idVisita: number,
  idExamen: number,
): Promise<Result> {
  await requireSession()

  try {
    const [exam] = await db.select({ precio: exams.precio }).from(exams).where(eq(exams.id, idExamen))
    if (!exam) return { success: false, error: 'Examen no encontrado' }

    await db.transaction(async (tx) => {
      await tx
        .update(visitExams)
        .set({ precio: exam.precio })
        .where(and(eq(visitExams.idVisita, idVisita), eq(visitExams.idExamen, idExamen)))
      await actualizarCostoVisitaPersistida(idVisita, tx)
    })

    revalidatePath(`/visitas/${idVisita}`)
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar precio' }
  }
}

// ─── actualizarPrecioProcedimientoVisita ──────────────────────────────────────

export async function actualizarPrecioProcedimientoVisita(
  idVisita: number,
  idProcedimiento: number,
): Promise<Result> {
  await requireSession()

  try {
    const [proc] = await db
      .select({ precio: procedures.precio })
      .from(procedures)
      .where(eq(procedures.id, idProcedimiento))
    if (!proc) return { success: false, error: 'Procedimiento no encontrado' }

    await db.transaction(async (tx) => {
      await tx
        .update(visitProcedures)
        .set({ precio: proc.precio })
        .where(and(eq(visitProcedures.idVisita, idVisita), eq(visitProcedures.idProcedimiento, idProcedimiento)))
      await actualizarCostoVisitaPersistida(idVisita, tx)
    })

    revalidatePath(`/visitas/${idVisita}`)
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar precio' }
  }
}

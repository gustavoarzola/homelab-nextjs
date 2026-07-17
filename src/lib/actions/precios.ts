'use server'

import { z } from 'zod'
import { parseFormData, fields } from '@/lib/validation'
import { withQuery, withFormAction, withAction, ActionError, type ActionResult } from '@/lib/with-action'
import { db } from '@/db'
import {
  nursingVisitPrices,
  exams,
  patients,
  addresses,
  healthInsurances,
  visits,
  nurses,
  visitProcedures,
  visitExams,
  visitIsapreExams,
  visitWorkshops,
  visitSurcharges,
  procedures,
  workshops,
  surchargeTypes,
} from '@/db/schema'
import { eq, and, or, isNull, ne, asc, desc, count, ilike, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { formatNombre } from '@/lib/paciente'
import type { SearchParams } from '@/components/data-table'
import { calcularCostoVisitaPersistida } from '@/lib/pricing/visitas'

// ─── Row types ────────────────────────────────────────────────────────────────

export type PrecioExamenRow = {
  id: number
  idExamen: number
  examenNombre: string
  examenCodigo: string
  grupoExamen: string
  precio: number
  activo: boolean
}

export type PrecioVisitaRow = {
  id: number
  comuna: string | null
  precio: number
  activo: boolean
}

// ─── Helper: normalizar categoria ─────────────────────────────────────────────

function normalizarCategoria(categoria: string | null): 'fonasa' | 'isapre' | 'particular' {
  if (categoria === 'fonasa' || categoria === 'isapre') return categoria
  return 'particular'
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const precioExamenCreateSchema = z.object({
  idExamen: z.coerce.number().positive('Examen requerido'),
  precio: fields.precioRequerido,
})

const precioExamenUpdateSchema = z.object({
  id: fields.id,
  precio: fields.precioRequerido,
})

const precioVisitaCreateSchema = z.object({
  comuna: z.string().trim().optional().transform((v) => v || null),
  precio: fields.precioRequerido,
})

const precioVisitaUpdateSchema = z.object({
  id: fields.id,
  comuna: z.string().trim().optional().transform((v) => v || null),
  precio: fields.precioRequerido,
})

// ─── searchPreciosExamenes ────────────────────────────────────────────────────

export async function searchPreciosExamenes(
  params: SearchParams,
): Promise<{ rows: PrecioExamenRow[]; total: number }> {
  return withQuery(async () => {
  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar)
    conditions.push(
      or(ilike(exams.nombre, `%${buscar}%`), ilike(exams.codigo, `%${buscar}%`))!,
    )
  if (!mostrarInactivos) conditions.push(eq(exams.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ total: count() })
    .from(exams)
    .where(where)

  const sortCol = sort?.key === 'examenNombre' ? exams.nombre : exams.precio
  const order = sort?.dir === 'asc' ? asc(sortCol) : desc(sortCol)

  const rows = await db
    .select({
      id: exams.id,
      idExamen: exams.id,
      nombre: exams.nombre,
      codigo: exams.codigo,
      grupoExamen: exams.grupoExamen,
      precio: exams.precio,
      activo: exams.activo,
    })
    .from(exams)
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    rows: rows.map((r) => ({
      id: r.id,
      idExamen: r.idExamen,
      examenNombre: r.nombre,
      examenCodigo: r.codigo,
      grupoExamen: r.grupoExamen,
      precio: r.precio,
      activo: r.activo,
    })),
    total: Number(countRow?.total ?? 0),
  }
  })
}

export async function createPrecioExamen(fd: FormData): Promise<ActionResult> {
  return withFormAction(precioExamenCreateSchema, fd, 'Error al actualizar precio', async ({ idExamen, precio }) => {
    await db.update(exams).set({ precio }).where(eq(exams.id, idExamen))
    revalidatePath('/examenes')
  })
}

export async function updatePrecioExamen(fd: FormData): Promise<ActionResult> {
  return withFormAction(precioExamenUpdateSchema, fd, 'Error al actualizar precio', async ({ id, precio }) => {
    await db.update(exams).set({ precio, updatedAt: new Date() }).where(eq(exams.id, id))
    revalidatePath('/examenes')
  })
}

export async function togglePrecioExamen(id: number, activo: boolean): Promise<ActionResult> {
  return withAction('Error al cambiar estado', async () => {
    await db.update(exams).set({ activo: !activo }).where(eq(exams.id, id))
    revalidatePath('/examenes')
  })
}

// ─── searchPreciosVisita ──────────────────────────────────────────────────────

export async function searchPreciosVisita(
  params: SearchParams,
): Promise<{ rows: PrecioVisitaRow[]; total: number }> {
  return withQuery(async () => {
  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(ilike(nursingVisitPrices.comuna, `%${buscar}%`))
  if (!mostrarInactivos) conditions.push(eq(nursingVisitPrices.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ total: count() })
    .from(nursingVisitPrices)
    .where(where)

  const sortCol =
    sort?.key === 'precio' ? nursingVisitPrices.precio : nursingVisitPrices.comuna
  const order = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

  const rows = await db
    .select()
    .from(nursingVisitPrices)
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { rows, total: Number(countRow?.total ?? 0) }
  })
}

export async function createPrecioVisita(fd: FormData): Promise<ActionResult> {
  return withFormAction(precioVisitaCreateSchema, fd, 'Error al crear precio', async ({ comuna, precio }) => {
    const duplicateCondition = comuna
      ? eq(nursingVisitPrices.comuna, comuna)
      : isNull(nursingVisitPrices.comuna)
    const [existing] = await db.select({ id: nursingVisitPrices.id }).from(nursingVisitPrices).where(duplicateCondition).limit(1)
    if (existing) {
      const label = comuna ? `la comuna "${comuna}"` : 'el precio base'
      throw new ActionError(`Ya existe un precio para ${label}`)
    }
    await db.insert(nursingVisitPrices).values({ comuna, precio })
    revalidatePath('/precios/visitas')
  })
}

export async function updatePrecioVisita(fd: FormData): Promise<ActionResult> {
  return withFormAction(precioVisitaUpdateSchema, fd, 'Error al actualizar precio', async ({ id, comuna, precio }) => {
    const duplicateCondition = comuna
      ? and(eq(nursingVisitPrices.comuna, comuna), ne(nursingVisitPrices.id, id))
      : and(isNull(nursingVisitPrices.comuna), ne(nursingVisitPrices.id, id))
    const [duplicate] = await db.select({ id: nursingVisitPrices.id }).from(nursingVisitPrices).where(duplicateCondition).limit(1)
    if (duplicate) {
      const label = comuna ? `la comuna "${comuna}"` : 'el precio base'
      throw new ActionError(`Ya existe otro precio para ${label}`)
    }
    await db.update(nursingVisitPrices).set({ comuna, precio, updatedAt: new Date() }).where(eq(nursingVisitPrices.id, id))
    revalidatePath('/precios/visitas')
  })
}

export async function togglePrecioVisita(id: number, activo: boolean): Promise<ActionResult> {
  return withAction('Error al cambiar estado', async () => {
    await db.update(nursingVisitPrices).set({ activo: !activo }).where(eq(nursingVisitPrices.id, id))
    revalidatePath('/precios/visitas')
  })
}

// ─── getCotizacionVisita ──────────────────────────────────────────────────────

export type ItemCotizacion = {
  descripcion: string
  codigo: string
  tipo: 'examen' | 'procedimiento' | 'visita' | 'taller'
  precio: number | null   // null = sin precio configurado
}

export type CotizacionVisita = {
  id: number
  fecha: string
  hora: string | null
  paciente: {
    nombreCompleto: string
    identificador: string | null
    tipoIdentificador: string | null
    fechaNacimiento: string | null
    prevision: string | null
    direccion: string | null
    comuna: string | null
  }
  enfermera: string | null
  items: ItemCotizacion[]
  subtotalExamenes: number
  subtotalTalleres: number
  costoVisitaEnfermeria: number
  costoVisitaEnfermeriaOriginal: number
  montoDescuento: number
  recargos: { nombre: string; precio: number }[]
  subtotalRecargos: number
  montoInsumos: number
  total: number
  tipoPrevision: 'fonasa' | 'isapre' | 'particular'
}

export async function getCotizacionVisita(idVisita: number): Promise<CotizacionVisita | null> {
  return withQuery(async () => {
  // Visita base
  const [visitRow] = await db
    .select({
      id: visits.id,
      fecha: visits.fecha,
      hora: visits.hora,
      idPaciente: visits.idPaciente,
      idEnfermera: visits.idEnfermera,
    })
    .from(visits)
    .where(eq(visits.id, idVisita))

  if (!visitRow) return null

  // Datos en paralelo
  const [pacienteRow, enfermeraRow, procRows, examRows, isapreExamRows, tallerRows, surchargesRows] = await Promise.all([
    visitRow.idPaciente
      ? db
          .select({
            id: patients.id,
            nombres: patients.nombres,
            apellidoPaterno: patients.apellidoPaterno,
            apellidoMaterno: patients.apellidoMaterno,
            identificador: patients.identificador,
            tipoIdentificador: patients.tipoIdentificador,
            fechaNacimiento: patients.fechaNacimiento,
            previsionNombre: healthInsurances.nombre,
            categoriaSeguro: healthInsurances.categoria,
            direccionFormateada: addresses.direccionFormateada,
            direccion: addresses.direccion,
            comuna: addresses.areaAdministrativa3,
          })
          .from(patients)
          .leftJoin(healthInsurances, eq(patients.idCompaniaSeguro, healthInsurances.id))
          .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
          .where(eq(patients.id, visitRow.idPaciente))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),

    visitRow.idEnfermera
      ? db
          .select({ nombres: nurses.nombres, apellidoPaterno: nurses.apellidoPaterno, apellidoMaterno: nurses.apellidoMaterno })
          .from(nurses)
          .where(eq(nurses.id, visitRow.idEnfermera))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),

    db
      .select({ id: visitProcedures.idProcedimiento, nombre: procedures.nombre, codigo: procedures.codigo, precio: visitProcedures.precio })
      .from(visitProcedures)
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(eq(visitProcedures.idVisita, idVisita)),

    db
      .select({ id: visitExams.idExamen, nombre: exams.nombre, codigo: exams.codigo, precio: visitExams.precio })
      .from(visitExams)
      .innerJoin(exams, eq(visitExams.idExamen, exams.id))
      .where(eq(visitExams.idVisita, idVisita)),

    db
      .select({ nombre: exams.nombre, codigo: exams.codigo, precio: visitIsapreExams.valorPagar })
      .from(visitIsapreExams)
      .innerJoin(exams, eq(visitIsapreExams.idExamen, exams.id))
      .where(eq(visitIsapreExams.idVisita, idVisita)),

    db
      .select({ nombre: workshops.nombre, codigo: workshops.codigo, precio: visitWorkshops.precio })
      .from(visitWorkshops)
      .innerJoin(workshops, eq(visitWorkshops.idTaller, workshops.id))
      .where(eq(visitWorkshops.idVisita, idVisita)),

    db
      .select({ nombre: surchargeTypes.nombre, precio: visitSurcharges.precio })
      .from(visitSurcharges)
      .innerJoin(surchargeTypes, eq(visitSurcharges.idTipoRecargo, surchargeTypes.id))
      .where(eq(visitSurcharges.idVisita, idVisita)),
  ])

  const tipoPrevision = normalizarCategoria(pacienteRow?.categoriaSeguro ?? null)
  const costoCalculado = await calcularCostoVisitaPersistida(idVisita)

  // Precios de exámenes (desde snapshot guardado en visitExams.precio)
  const items: ItemCotizacion[] = []
  for (const exam of examRows) {
    const precioExamen = exam.precio || null
    items.push({ descripcion: exam.nombre, codigo: exam.codigo, tipo: 'examen', precio: precioExamen })
  }

  for (const isapreExam of isapreExamRows) {
    items.push({ descripcion: isapreExam.nombre, codigo: isapreExam.codigo, tipo: 'examen', precio: isapreExam.precio || null })
  }

  for (const proc of procRows) {
    const precio = proc.precio || null
    items.push({ descripcion: proc.nombre, codigo: proc.codigo, tipo: 'procedimiento', precio })
  }

  for (const taller of tallerRows) {
    items.push({ descripcion: taller.nombre, codigo: taller.codigo, tipo: 'taller', precio: taller.precio })
  }

  if (costoCalculado.aplicaVisitaEnfermeria) {
    items.push({
      descripcion: 'Visita de enfermería a domicilio',
      codigo: 'VIS-ENF',
      tipo: 'visita',
      precio: costoCalculado.precioVisitaConfigurado ? costoCalculado.costoVisitaEnfermeriaOriginal : null,
    })
  }

  return {
    id: visitRow.id,
    fecha: visitRow.fecha,
    hora: visitRow.hora ?? null,
    paciente: {
      nombreCompleto: pacienteRow
        ? formatNombre({
            nombres: pacienteRow.nombres,
            apellidoPaterno: pacienteRow.apellidoPaterno,
            apellidoMaterno: pacienteRow.apellidoMaterno,
          })
        : '—',
      identificador: pacienteRow?.identificador ?? null,
      tipoIdentificador: pacienteRow?.tipoIdentificador ?? null,
      fechaNacimiento: pacienteRow?.fechaNacimiento ?? null,
      prevision: pacienteRow?.previsionNombre ?? null,
      direccion: pacienteRow?.direccionFormateada ?? pacienteRow?.direccion ?? null,
      comuna: pacienteRow?.comuna ?? null,
    },
    enfermera: enfermeraRow
      ? formatNombre({
          nombres: enfermeraRow.nombres,
          apellidoPaterno: enfermeraRow.apellidoPaterno,
          apellidoMaterno: enfermeraRow.apellidoMaterno,
        })
      : null,
    items,
    subtotalExamenes: costoCalculado.subtotalExamenes,
    subtotalTalleres: costoCalculado.subtotalTalleres,
    costoVisitaEnfermeria: costoCalculado.costoVisitaEnfermeria,
    costoVisitaEnfermeriaOriginal: costoCalculado.costoVisitaEnfermeriaOriginal,
    montoDescuento: costoCalculado.montoDescuento,
    recargos: surchargesRows,
    subtotalRecargos: costoCalculado.subtotalRecargos,
    montoInsumos: costoCalculado.montoInsumos,
    total: costoCalculado.total,
    tipoPrevision,
  }
  })
}

// ─── getExamenesForSelect ─────────────────────────────────────────────────────

export async function getExamenesForSelect(): Promise<{ id: number; label: string }[]> {
  return withQuery(async () => {
  const rows = await db
    .select({ id: exams.id, nombre: exams.nombre, codigo: exams.codigo })
    .from(exams)
    .where(eq(exams.activo, true))
    .orderBy(asc(exams.nombre))

  return rows.map((r) => ({ id: r.id, label: `${r.nombre} (${r.codigo})` }))
  })
}

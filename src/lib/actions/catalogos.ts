'use server'

import { db } from '@/db'
import { procedures, exams, healthInsurances, elderlyResidences, surchargeTypes, workshops } from '@/db/schema'
import { eq, count, and, or, ilike, asc, desc, not, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SearchParams } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'
import { parseFormData, fields } from '@/lib/validation'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const procedimientoSchema = z.object({
  nombre: fields.nombre,
  codigo: fields.codigo,
  categoria: z.string().trim().optional().transform((v) => v || 'otros'),
  precio: fields.precio.optional().default(0),
})
const procedimientoUpdateSchema = procedimientoSchema.extend({ id: fields.id })

const examenSchema = z.object({
  nombre: fields.nombre,
  codigo: fields.codigo,
  grupoExamen: z.string().trim().min(1, 'Grupo requerido'),
  precio: fields.precio.optional().default(0),
})
const examenUpdateSchema = examenSchema.extend({ id: fields.id })

const previsionSchema = z.object({
  nombre: fields.nombre,
  categoria: z.string().trim().optional().transform((v) => v || null),
})
const previsionUpdateSchema = previsionSchema.extend({ id: fields.id })

const residenciaSchema = z.object({ nombre: fields.nombre })
const residenciaUpdateSchema = residenciaSchema.extend({ id: fields.id })

const tipoRecargoSchema = z.object({ nombre: fields.nombre })
const tipoRecargoUpdateSchema = tipoRecargoSchema.extend({ id: fields.id })

const tallerSchema = z.object({ nombre: fields.nombre, codigo: fields.codigo })
const tallerUpdateSchema = tallerSchema.extend({ id: fields.id })

type Result = { success: boolean; error?: string }

// ─── Shared row types ──────────────────────────────────────────────────────────

export type ProcedimientoRow = { id: number; nombre: string; codigo: string; categoria: string; precio: number; activo: boolean }
export type ExamenRow       = { id: number; nombre: string; codigo: string; grupoExamen: string; precio: number; activo: boolean }
export type TallerRow       = { id: number; nombre: string; codigo: string; activo: boolean }
export type PrevisionRow    = { id: number; nombre: string; categoria: string | null; activo: boolean }
export type ResidenciaRow   = { id: number; nombre: string; activo: boolean }
export type TipoRecargoRow  = { id: number; nombre: string; activo: boolean }

export async function getPrevisionCategorias(): Promise<string[]> {
  await requireSession()

  const rows = await db
    .selectDistinct({ categoria: healthInsurances.categoria })
    .from(healthInsurances)
    .where(and(eq(healthInsurances.activo, true), not(eq(healthInsurances.categoria, ''))))
    .orderBy(asc(healthInsurances.categoria))

  return rows
    .map((row) => row.categoria?.trim())
    .filter((categoria): categoria is string => Boolean(categoria))
}

// ─── Procedimientos ───────────────────────────────────────────────────────────

export async function searchProcedimientos(params: SearchParams): Promise<{ rows: ProcedimientoRow[]; total: number }> {
  await requireSession()

  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const categoria = (filters.categoria as string | undefined)?.trim()
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(or(ilike(procedures.nombre, `%${buscar}%`), ilike(procedures.codigo, `%${buscar}%`))!)
  if (categoria) conditions.push(eq(procedures.categoria, categoria))
  if (!mostrarInactivos) conditions.push(eq(procedures.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db.select({ total: count() }).from(procedures).where(where)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortCols: Record<string, any> = { nombre: procedures.nombre, codigo: procedures.codigo }
  const sortCol = (sort?.key && sortCols[sort.key]) ?? procedures.nombre
  const order = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

  const rows = await db.select().from(procedures).where(where).orderBy(order, asc(procedures.nombre)).limit(pageSize).offset((page - 1) * pageSize)
  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function createProcedimiento(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(procedimientoSchema, formData)
  if (!parsed.success) return parsed
  const { nombre, codigo, categoria, precio } = parsed.data
  try {
    const existing = await db.select().from(procedures).where(ilike(procedures.nombre, nombre))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.insert(procedures).values({ nombre, codigo, categoria, precio })
    revalidatePath('/procedimientos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updateProcedimiento(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(procedimientoUpdateSchema, formData)
  if (!parsed.success) return parsed
  const { id, nombre, codigo, categoria, precio } = parsed.data
  try {
    const duplicated = await db
      .select()
      .from(procedures)
      .where(and(ilike(procedures.nombre, nombre), not(eq(procedures.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.update(procedures).set({ nombre, codigo, categoria, precio }).where(eq(procedures.id, id))
    revalidatePath('/procedimientos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleProcedimiento(id: number, activo: boolean): Promise<Result> {
  await requireSession()

  try {
    await db.update(procedures).set({ activo: !activo }).where(eq(procedures.id, id))
    revalidatePath('/procedimientos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── Exámenes ─────────────────────────────────────────────────────────────────

export async function searchExamenes(params: SearchParams): Promise<{ rows: ExamenRow[]; total: number }> {
  await requireSession()

  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(or(ilike(exams.nombre, `%${buscar}%`), ilike(exams.codigo, `%${buscar}%`))!)
  if (!mostrarInactivos) conditions.push(eq(exams.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db.select({ total: count() }).from(exams).where(where)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortCols: Record<string, any> = { nombre: exams.nombre, codigo: exams.codigo }
  const sortCol = (sort?.key && sortCols[sort.key]) ?? exams.nombre
  const order = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

  const rows = await db.select().from(exams).where(where).orderBy(order, asc(exams.nombre)).limit(pageSize).offset((page - 1) * pageSize)
  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function createExamen(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(examenSchema, formData)
  if (!parsed.success) return parsed
  const { nombre, codigo, grupoExamen, precio } = parsed.data
  try {
    const existing = await db.select().from(exams).where(ilike(exams.nombre, nombre))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.insert(exams).values({ nombre, codigo, grupoExamen, precio })
    revalidatePath('/examenes')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updateExamen(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(examenUpdateSchema, formData)
  if (!parsed.success) return parsed
  const { id, nombre, codigo, grupoExamen, precio } = parsed.data
  try {
    const duplicated = await db
      .select()
      .from(exams)
      .where(and(ilike(exams.nombre, nombre), not(eq(exams.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.update(exams).set({ nombre, codigo, grupoExamen, precio, updatedAt: new Date() }).where(eq(exams.id, id))
    revalidatePath('/examenes')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleExamen(id: number, activo: boolean): Promise<Result> {
  await requireSession()

  try {
    await db.update(exams).set({ activo: !activo }).where(eq(exams.id, id))
    revalidatePath('/examenes')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── Previsiones de Salud ─────────────────────────────────────────────────────

export async function searchPrevisiones(params: SearchParams): Promise<{ rows: PrevisionRow[]; total: number }> {
  await requireSession()

  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const categoria = (filters.categoria as string | undefined)?.trim()
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(ilike(healthInsurances.nombre, `%${buscar}%`))
  if (categoria) conditions.push(eq(healthInsurances.categoria, categoria))
  if (!mostrarInactivos) conditions.push(eq(healthInsurances.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db.select({ total: count() }).from(healthInsurances).where(where)
  const order = sort?.dir === 'desc' ? desc(healthInsurances.nombre) : asc(healthInsurances.nombre)

  const rows = await db.select().from(healthInsurances).where(where).orderBy(order).limit(pageSize).offset((page - 1) * pageSize)
  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function createPrevision(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(previsionSchema, formData)
  if (!parsed.success) return parsed
  const { nombre, categoria } = parsed.data
  try {
    const existing = await db.select().from(healthInsurances).where(ilike(healthInsurances.nombre, nombre))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.insert(healthInsurances).values({ nombre, categoria })
    revalidatePath('/previsiones')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updatePrevision(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(previsionUpdateSchema, formData)
  if (!parsed.success) return parsed
  const { id, nombre, categoria } = parsed.data
  try {
    const duplicated = await db
      .select()
      .from(healthInsurances)
      .where(and(ilike(healthInsurances.nombre, nombre), not(eq(healthInsurances.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.update(healthInsurances).set({ nombre, categoria }).where(eq(healthInsurances.id, id))
    revalidatePath('/previsiones')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function togglePrevision(id: number, activo: boolean): Promise<Result> {
  await requireSession()

  try {
    await db.update(healthInsurances).set({ activo: !activo }).where(eq(healthInsurances.id, id))
    revalidatePath('/previsiones')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── Residencias de Adulto Mayor ──────────────────────────────────────────────

export async function searchResidencias(params: SearchParams): Promise<{ rows: ResidenciaRow[]; total: number }> {
  await requireSession()

  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(ilike(elderlyResidences.nombre, `%${buscar}%`))
  if (!mostrarInactivos) conditions.push(eq(elderlyResidences.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db.select({ total: count() }).from(elderlyResidences).where(where)
  const order = sort?.dir === 'desc' ? desc(elderlyResidences.nombre) : asc(elderlyResidences.nombre)

  const rows = await db.select().from(elderlyResidences).where(where).orderBy(order).limit(pageSize).offset((page - 1) * pageSize)
  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function createResidencia(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(residenciaSchema, formData)
  if (!parsed.success) return parsed
  const { nombre } = parsed.data
  try {
    const existing = await db.select().from(elderlyResidences).where(ilike(elderlyResidences.nombre, nombre))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.insert(elderlyResidences).values({ nombre })
    revalidatePath('/residencias')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updateResidencia(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(residenciaUpdateSchema, formData)
  if (!parsed.success) return parsed
  const { id, nombre } = parsed.data
  try {
    const duplicated = await db
      .select()
      .from(elderlyResidences)
      .where(and(ilike(elderlyResidences.nombre, nombre), not(eq(elderlyResidences.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.update(elderlyResidences).set({ nombre }).where(eq(elderlyResidences.id, id))
    revalidatePath('/residencias')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleResidencia(id: number, activo: boolean): Promise<Result> {
  await requireSession()

  try {
    await db.update(elderlyResidences).set({ activo: !activo }).where(eq(elderlyResidences.id, id))
    revalidatePath('/residencias')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── Tipos de Recargos ────────────────────────────────────────────────────────

export async function searchTiposRecargos(params: SearchParams): Promise<{ rows: TipoRecargoRow[]; total: number }> {
  await requireSession()

  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(ilike(surchargeTypes.nombre, `%${buscar}%`))
  if (!mostrarInactivos) conditions.push(eq(surchargeTypes.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db.select({ total: count() }).from(surchargeTypes).where(where)
  const order = sort?.dir === 'desc' ? desc(surchargeTypes.nombre) : asc(surchargeTypes.nombre)

  const rows = await db.select().from(surchargeTypes).where(where).orderBy(order).limit(pageSize).offset((page - 1) * pageSize)
  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function createTipoRecargo(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(tipoRecargoSchema, formData)
  if (!parsed.success) return parsed
  const { nombre } = parsed.data
  try {
    const existing = await db.select().from(surchargeTypes).where(ilike(surchargeTypes.nombre, nombre))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.insert(surchargeTypes).values({ nombre })
    revalidatePath('/tipos-recargos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updateTipoRecargo(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(tipoRecargoUpdateSchema, formData)
  if (!parsed.success) return parsed
  const { id, nombre } = parsed.data
  try {
    const duplicated = await db
      .select()
      .from(surchargeTypes)
      .where(and(ilike(surchargeTypes.nombre, nombre), not(eq(surchargeTypes.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.update(surchargeTypes).set({ nombre, updatedAt: new Date() }).where(eq(surchargeTypes.id, id))
    revalidatePath('/tipos-recargos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleTipoRecargo(id: number, activo: boolean): Promise<Result> {
  await requireSession()

  try {
    await db.update(surchargeTypes).set({ activo: !activo }).where(eq(surchargeTypes.id, id))
    revalidatePath('/tipos-recargos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

export async function getTiposRecargosForSelect(): Promise<{ id: number; label: string }[]> {
  await requireSession()

  const rows = await db
    .select({ id: surchargeTypes.id, nombre: surchargeTypes.nombre })
    .from(surchargeTypes)
    .where(eq(surchargeTypes.activo, true))
    .orderBy(asc(surchargeTypes.nombre))

  return rows.map((r) => ({ id: r.id, label: r.nombre }))
}

// ─── Talleres ─────────────────────────────────────────────────────────────────

export async function searchTalleres(params: SearchParams): Promise<{ rows: TallerRow[]; total: number }> {
  await requireSession()

  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(or(ilike(workshops.nombre, `%${buscar}%`), ilike(workshops.codigo, `%${buscar}%`))!)
  if (!mostrarInactivos) conditions.push(eq(workshops.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db.select({ total: count() }).from(workshops).where(where)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortCols: Record<string, any> = { nombre: workshops.nombre, codigo: workshops.codigo }
  const sortCol = (sort?.key && sortCols[sort.key]) ?? workshops.nombre
  const order = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

  const rows = await db.select().from(workshops).where(where).orderBy(order, asc(workshops.nombre)).limit(pageSize).offset((page - 1) * pageSize)
  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function createTaller(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(tallerSchema, formData)
  if (!parsed.success) return parsed
  const { nombre, codigo } = parsed.data
  try {
    const existing = await db.select().from(workshops).where(ilike(workshops.nombre, nombre))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.insert(workshops).values({ nombre, codigo })
    revalidatePath('/talleres')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updateTaller(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(tallerUpdateSchema, formData)
  if (!parsed.success) return parsed
  const { id, nombre, codigo } = parsed.data
  try {
    const duplicated = await db
      .select()
      .from(workshops)
      .where(and(ilike(workshops.nombre, nombre), not(eq(workshops.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.update(workshops).set({ nombre, codigo, updatedAt: new Date() }).where(eq(workshops.id, id))
    revalidatePath('/talleres')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleTaller(id: number, activo: boolean): Promise<Result> {
  await requireSession()

  try {
    await db.update(workshops).set({ activo: !activo }).where(eq(workshops.id, id))
    revalidatePath('/talleres')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

export async function getTalleres(): Promise<TallerRow[]> {
  await requireSession()

  return db
    .select()
    .from(workshops)
    .where(eq(workshops.activo, true))
    .orderBy(asc(workshops.nombre))
}

// ─── getProcedimientos (all active) ────────────────────────────────────────

export async function getProcedimientos(): Promise<ProcedimientoRow[]> {
  await requireSession()

  return db
    .select()
    .from(procedures)
    .where(eq(procedures.activo, true))
    .orderBy(asc(procedures.nombre))
}

// ─── getExamenes (all active) ────────────────────────────────────────────────

export async function getExamenes(): Promise<ExamenRow[]> {
  await requireSession()

  return db
    .select()
    .from(exams)
    .where(eq(exams.activo, true))
    .orderBy(asc(exams.nombre))
}

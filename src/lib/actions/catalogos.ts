'use server'

import { db } from '@/db'
import { procedures, exams, healthInsurances, elderlyResidences } from '@/db/schema'
import { eq, count, and, or, ilike, asc, desc, not, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { SearchParams } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'

type Result = { success: boolean; error?: string }

// ─── Shared row types ──────────────────────────────────────────────────────────

export type ProcedimientoRow = { id: number; nombre: string; codigo: string; categoria: string; activo: boolean }
export type ExamenRow       = { id: number; nombre: string; codigo: string; activo: boolean }
export type PrevisionRow    = { id: number; nombre: string; activo: boolean }
export type ResidenciaRow   = { id: number; nombre: string; activo: boolean }

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

  const nombre = (formData.get('nombre') as string)?.trim()
  const codigo = (formData.get('codigo') as string)?.trim()
  const categoria = (formData.get('categoria') as string)?.trim() || 'otros'
  if (!nombre || !codigo) return { success: false, error: 'Nombre y código son requeridos' }
  try {
    const existing = await db.select().from(procedures).where(ilike(procedures.nombre, nombre))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.insert(procedures).values({ nombre, codigo, categoria })
    revalidatePath('/procedimientos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updateProcedimiento(formData: FormData): Promise<Result> {
  await requireSession()

  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  const codigo = (formData.get('codigo') as string)?.trim()
  const categoria = (formData.get('categoria') as string)?.trim() || 'otros'
  if (!id || !nombre || !codigo) return { success: false, error: 'Datos inválidos' }
  try {
    const duplicated = await db
      .select()
      .from(procedures)
      .where(and(ilike(procedures.nombre, nombre), not(eq(procedures.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.update(procedures).set({ nombre, codigo, categoria }).where(eq(procedures.id, id))
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

  const nombre = (formData.get('nombre') as string)?.trim()
  const codigo = (formData.get('codigo') as string)?.trim()
  if (!nombre || !codigo) return { success: false, error: 'Nombre y código son requeridos' }
  try {
    const existing = await db.select().from(exams).where(ilike(exams.nombre, nombre))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.insert(exams).values({ nombre, codigo })
    revalidatePath('/examenes')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updateExamen(formData: FormData): Promise<Result> {
  await requireSession()

  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  const codigo = (formData.get('codigo') as string)?.trim()
  if (!id || !nombre || !codigo) return { success: false, error: 'Datos inválidos' }
  try {
    const duplicated = await db
      .select()
      .from(exams)
      .where(and(ilike(exams.nombre, nombre), not(eq(exams.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.update(exams).set({ nombre, codigo }).where(eq(exams.id, id))
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
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(ilike(healthInsurances.nombre, `%${buscar}%`))
  if (!mostrarInactivos) conditions.push(eq(healthInsurances.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db.select({ total: count() }).from(healthInsurances).where(where)
  const order = sort?.dir === 'desc' ? desc(healthInsurances.nombre) : asc(healthInsurances.nombre)

  const rows = await db.select().from(healthInsurances).where(where).orderBy(order).limit(pageSize).offset((page - 1) * pageSize)
  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function createPrevision(formData: FormData): Promise<Result> {
  await requireSession()

  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'Nombre requerido' }
  try {
    const existing = await db.select().from(healthInsurances).where(ilike(healthInsurances.nombre, nombre))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.insert(healthInsurances).values({ nombre })
    revalidatePath('/previsiones')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updatePrevision(formData: FormData): Promise<Result> {
  await requireSession()

  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!id || !nombre) return { success: false, error: 'Datos inválidos' }
  try {
    const duplicated = await db
      .select()
      .from(healthInsurances)
      .where(and(ilike(healthInsurances.nombre, nombre), not(eq(healthInsurances.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.update(healthInsurances).set({ nombre }).where(eq(healthInsurances.id, id))
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

  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'Nombre requerido' }
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

  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!id || !nombre) return { success: false, error: 'Datos inválidos' }
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

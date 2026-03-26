'use server'

import { db } from '@/db'
import { laboratories, branches } from '@/db/schema'
import { eq, count, and, ilike, asc, desc, not, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { SearchParams } from '@/components/data-table'

type Result = { success: boolean; error?: string }

// ─── Row types ────────────────────────────────────────────────────────────────

export type LaboratorioRow = { id: number; nombre: string; activo: boolean }
export type SucursalRow = { id: number; nombre: string; idLaboratorio: number | null; laboratorio: string | null; activo: boolean }

// ─── Laboratorios ──────────────────────────────────────────────────────────────

export async function searchLaboratorios(params: SearchParams): Promise<{ rows: LaboratorioRow[]; total: number }> {
  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const mostrarInactivas = filters.mostrarInactivas as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(ilike(laboratories.nombre, `%${buscar}%`))
  if (!mostrarInactivas) conditions.push(eq(laboratories.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db.select({ total: count() }).from(laboratories).where(where)
  const order = sort?.dir === 'desc' ? desc(laboratories.nombre) : asc(laboratories.nombre)

  const rows = await db.select().from(laboratories).where(where).orderBy(order).limit(pageSize).offset((page - 1) * pageSize)
  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function createLaboratorio(formData: FormData): Promise<Result> {
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'Nombre requerido' }
  try {
    const existing = await db.select().from(laboratories).where(ilike(laboratories.nombre, nombre))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.insert(laboratories).values({ nombre })
    revalidatePath('/laboratorios')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear el laboratorio' }
  }
}

export async function updateLaboratorio(formData: FormData): Promise<Result> {
  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!id || !nombre) return { success: false, error: 'Datos inválidos' }
  try {
    const duplicated = await db
      .select()
      .from(laboratories)
      .where(and(ilike(laboratories.nombre, nombre), not(eq(laboratories.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe' }
    await db.update(laboratories).set({ nombre }).where(eq(laboratories.id, id))
    revalidatePath('/laboratorios')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleLaboratorio(id: number, activo: boolean): Promise<Result> {
  try {
    await db.update(laboratories).set({ activo: !activo }).where(eq(laboratories.id, id))
    revalidatePath('/laboratorios')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── Sucursales ───────────────────────────────────────────────────────────────

export async function searchSucursales(params: SearchParams): Promise<{ rows: SucursalRow[]; total: number }> {
  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const idLaboratorio = (filters.idLaboratorio as string | undefined)
  const mostrarInactivas = filters.mostrarInactivas as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(ilike(branches.nombre, `%${buscar}%`))
  if (idLaboratorio) conditions.push(eq(branches.idLaboratorio, Number(idLaboratorio)))
  if (!mostrarInactivas) conditions.push(eq(branches.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db.select({ total: count() }).from(branches).where(where)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortCols: Record<string, any> = { nombre: branches.nombre, laboratorio: laboratories.nombre }
  const sortCol = (sort?.key && sortCols[sort.key]) ?? branches.nombre
  const order = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

  const rows = await db
    .select({
      id: branches.id,
      nombre: branches.nombre,
      idLaboratorio: branches.idLaboratorio,
      laboratorio: laboratories.nombre,
      activo: branches.activo,
    })
    .from(branches)
    .leftJoin(laboratories, eq(branches.idLaboratorio, laboratories.id))
    .where(where)
    .orderBy(order, asc(branches.nombre))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function createSucursal(formData: FormData): Promise<Result> {
  const nombre = (formData.get('nombre') as string)?.trim()
  const idLaboratorio = Number(formData.get('idLaboratorio'))
  if (!nombre || !idLaboratorio) return { success: false, error: 'Nombre y laboratorio son requeridos' }
  try {
    const existing = await db
      .select()
      .from(branches)
      .where(and(ilike(branches.nombre, nombre), eq(branches.idLaboratorio, idLaboratorio)))
    if (existing.length > 0) return { success: false, error: 'Este nombre ya existe en este laboratorio' }
    await db.insert(branches).values({ nombre, idLaboratorio })
    revalidatePath('/sucursales')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear la sucursal' }
  }
}

export async function updateSucursal(formData: FormData): Promise<Result> {
  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  const idLaboratorio = Number(formData.get('idLaboratorio'))
  if (!id || !nombre || !idLaboratorio) return { success: false, error: 'Datos inválidos' }
  try {
    const duplicated = await db
      .select()
      .from(branches)
      .where(and(ilike(branches.nombre, nombre), eq(branches.idLaboratorio, idLaboratorio), not(eq(branches.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este nombre ya existe en este laboratorio' }
    await db.update(branches).set({ nombre, idLaboratorio }).where(eq(branches.id, id))
    revalidatePath('/sucursales')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleSucursal(id: number, activo: boolean): Promise<Result> {
  try {
    await db.update(branches).set({ activo: !activo }).where(eq(branches.id, id))
    revalidatePath('/sucursales')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

'use server'

import { db } from '@/db'
import { laboratories } from '@/db/schema'
import { eq, count, and, ilike, asc, desc, not, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SearchParams } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'
import { parseFormData, fields } from '@/lib/validation'

type Result = { success: boolean; error?: string }

const laboratorioSchema = z.object({ nombre: fields.nombre })
const laboratorioUpdateSchema = laboratorioSchema.extend({ id: fields.id })

// ─── Row types ────────────────────────────────────────────────────────────────

export type LaboratorioRow = { id: number; nombre: string; activo: boolean }

// ─── Laboratorios ──────────────────────────────────────────────────────────────

export async function searchLaboratorios(params: SearchParams): Promise<{ rows: LaboratorioRow[]; total: number }> {
  await requireSession()

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
  await requireSession()

  const parsed = parseFormData(laboratorioSchema, formData)
  if (!parsed.success) return parsed
  const { nombre } = parsed.data
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
  await requireSession()

  const parsed = parseFormData(laboratorioUpdateSchema, formData)
  if (!parsed.success) return parsed
  const { id, nombre } = parsed.data
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
  await requireSession()

  try {
    await db.update(laboratories).set({ activo: !activo }).where(eq(laboratories.id, id))
    revalidatePath('/laboratorios')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}


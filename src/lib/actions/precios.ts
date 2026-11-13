'use server'

import { z } from 'zod'
import { fields } from '@/lib/validation'
import { withQuery, withFormAction, withAction, ActionError, type ActionResult } from '@/lib/with-action'
import { requireAdmin } from '@/lib/auth-guard'
import { db } from '@/db'
import {
  nursingVisitPrices,
  exams,
  comunas,
} from '@/db/schema'
import { eq, and, or, isNull, ne, asc, desc, count, ilike, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { SearchParams } from '@/lib/types'

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
  idComuna: number | null
  comuna: string | null
  precio: number
  activo: boolean
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
  idComuna: fields.nullableId,
  precio: fields.precioRequerido,
})

const precioVisitaUpdateSchema = z.object({
  id: fields.id,
  idComuna: fields.nullableId,
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
    await requireAdmin()
    await db.update(exams).set({ precio }).where(eq(exams.id, idExamen))
    revalidatePath('/examenes')
  })
}

export async function updatePrecioExamen(fd: FormData): Promise<ActionResult> {
  return withFormAction(precioExamenUpdateSchema, fd, 'Error al actualizar precio', async ({ id, precio }) => {
    await requireAdmin()
    await db.update(exams).set({ precio, updatedAt: new Date() }).where(eq(exams.id, id))
    revalidatePath('/examenes')
  })
}

export async function togglePrecioExamen(id: number, activo: boolean): Promise<ActionResult> {
  return withAction('Error al cambiar estado', async () => {
    await requireAdmin()
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
  if (buscar) conditions.push(ilike(comunas.nombre, `%${buscar}%`))
  if (!mostrarInactivos) conditions.push(eq(nursingVisitPrices.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ total: count() })
    .from(nursingVisitPrices)
    .leftJoin(comunas, eq(nursingVisitPrices.idComuna, comunas.id))
    .where(where)

  const sortCol =
    sort?.key === 'precio' ? nursingVisitPrices.precio : comunas.nombre
  const order = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

  const rows = await db
    .select({
      id: nursingVisitPrices.id,
      idComuna: nursingVisitPrices.idComuna,
      comuna: comunas.nombre,
      precio: nursingVisitPrices.precio,
      activo: nursingVisitPrices.activo,
    })
    .from(nursingVisitPrices)
    .leftJoin(comunas, eq(nursingVisitPrices.idComuna, comunas.id))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { rows, total: Number(countRow?.total ?? 0) }
  })
}

async function labelParaIdComuna(idComuna: number | null): Promise<string> {
  if (idComuna === null) return 'el precio base'
  const [row] = await db.select({ nombre: comunas.nombre }).from(comunas).where(eq(comunas.id, idComuna)).limit(1)
  return row ? `la comuna "${row.nombre}"` : 'esa comuna'
}

export async function createPrecioVisita(fd: FormData): Promise<ActionResult> {
  return withFormAction(precioVisitaCreateSchema, fd, 'Error al crear precio', async ({ idComuna, precio }) => {
    await requireAdmin()
    const duplicateCondition = idComuna !== null
      ? eq(nursingVisitPrices.idComuna, idComuna)
      : isNull(nursingVisitPrices.idComuna)
    const [existing] = await db.select({ id: nursingVisitPrices.id }).from(nursingVisitPrices).where(duplicateCondition).limit(1)
    if (existing) {
      throw new ActionError(`Ya existe un precio para ${await labelParaIdComuna(idComuna)}`)
    }
    await db.insert(nursingVisitPrices).values({ idComuna, precio })
    revalidatePath('/precios/visitas')
  })
}

export async function updatePrecioVisita(fd: FormData): Promise<ActionResult> {
  return withFormAction(precioVisitaUpdateSchema, fd, 'Error al actualizar precio', async ({ id, idComuna, precio }) => {
    await requireAdmin()
    const duplicateCondition = idComuna !== null
      ? and(eq(nursingVisitPrices.idComuna, idComuna), ne(nursingVisitPrices.id, id))
      : and(isNull(nursingVisitPrices.idComuna), ne(nursingVisitPrices.id, id))
    const [duplicate] = await db.select({ id: nursingVisitPrices.id }).from(nursingVisitPrices).where(duplicateCondition).limit(1)
    if (duplicate) {
      throw new ActionError(`Ya existe otro precio para ${await labelParaIdComuna(idComuna)}`)
    }
    await db.update(nursingVisitPrices).set({ idComuna, precio, updatedAt: new Date() }).where(eq(nursingVisitPrices.id, id))
    revalidatePath('/precios/visitas')
  })
}

export async function togglePrecioVisita(id: number, activo: boolean): Promise<ActionResult> {
  return withAction('Error al cambiar estado', async () => {
    await requireAdmin()
    await db.update(nursingVisitPrices).set({ activo: !activo }).where(eq(nursingVisitPrices.id, id))
    revalidatePath('/precios/visitas')
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

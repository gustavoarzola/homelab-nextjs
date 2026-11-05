'use server'

import { and, asc, count, desc, eq, ilike, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { SearchParams } from '@/components/data-table'
import { db } from '@/db'
import { monthlyExpenses } from '@/db/schema'
import { EXAM_GRUPOS } from '@/lib/exam-grupos'
import { GASTO_CATEGORIAS } from '@/lib/finanzas/categorias-gasto'
import { previousMonth } from '@/lib/finanzas/periodo'
import { withAction, withFormAction, withQuery, ActionError, type ActionResult } from '@/lib/with-action'

const PATH = '/estado-resultados'

export type GastoMensualRow = {
  id: number
  anio: number
  mes: number
  categoria: string
  descripcion: string
  monto: number
  grupoExamen: string | null
}

const baseSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1, 'Mes inválido').max(12, 'Mes inválido'),
  categoria: z.enum(GASTO_CATEGORIAS, { message: 'Categoría inválida' }),
  descripcion: z.string().trim().min(1, 'Descripción requerida').max(200, 'Descripción demasiado larga'),
  monto: z.coerce.number().int('Monto inválido').min(0, 'Monto inválido'),
  grupoExamen: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || (EXAM_GRUPOS as readonly string[]).includes(v), 'Laboratorio inválido'),
})

// El laboratorio solo tiene sentido en `costo_laboratorio`.
const normalize = <T extends z.infer<typeof baseSchema>>(d: T): T => ({
  ...d,
  grupoExamen: d.categoria === 'costo_laboratorio' ? d.grupoExamen : null,
})

const createSchema = baseSchema.transform(normalize)
const updateSchema = baseSchema.extend({ id: z.coerce.number().int().positive('ID inválido') }).transform(normalize)

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function searchGastosMensuales(
  params: SearchParams,
): Promise<{ rows: GastoMensualRow[]; total: number }> {
  return withQuery(async () => {
    const { filters, sort, page, pageSize } = params
    const anio = Number(filters.anio)
    const mes = Number(filters.mes)
    const categoria = (filters.categoria as string | undefined)?.trim()
    const buscar = (filters.buscar as string | undefined)?.trim()

    const conditions: SQL[] = []
    if (anio) conditions.push(eq(monthlyExpenses.anio, anio))
    if (mes) conditions.push(eq(monthlyExpenses.mes, mes))
    if (categoria) conditions.push(eq(monthlyExpenses.categoria, categoria))
    if (buscar) conditions.push(ilike(monthlyExpenses.descripcion, `%${buscar}%`))
    const where = conditions.length ? and(...conditions) : undefined

    const sortCols = {
      monto: monthlyExpenses.monto,
      descripcion: monthlyExpenses.descripcion,
      categoria: monthlyExpenses.categoria,
    } as const
    const sortCol = sort?.key && sort.key in sortCols ? sortCols[sort.key as keyof typeof sortCols] : monthlyExpenses.categoria
    const order = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

    const [countRow] = await db.select({ total: count() }).from(monthlyExpenses).where(where)
    const rows = await db
      .select({
        id: monthlyExpenses.id,
        anio: monthlyExpenses.anio,
        mes: monthlyExpenses.mes,
        categoria: monthlyExpenses.categoria,
        descripcion: monthlyExpenses.descripcion,
        monto: monthlyExpenses.monto,
        grupoExamen: monthlyExpenses.grupoExamen,
      })
      .from(monthlyExpenses)
      .where(where)
      .orderBy(order, asc(monthlyExpenses.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    return { rows, total: Number(countRow?.total ?? 0) }
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createGastoMensual(formData: FormData): Promise<ActionResult> {
  return withFormAction(createSchema, formData, 'Error al crear el gasto', async (data) => {
    await db.insert(monthlyExpenses).values(data)
    revalidatePath(PATH)
  })
}

export async function updateGastoMensual(formData: FormData): Promise<ActionResult> {
  return withFormAction(updateSchema, formData, 'Error al actualizar el gasto', async ({ id, ...data }) => {
    const updated = await db
      .update(monthlyExpenses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(monthlyExpenses.id, id))
      .returning()
    if (updated.length === 0) throw new ActionError('El gasto ya no existe')
    revalidatePath(PATH)
  })
}

export async function deleteGastoMensual(id: number): Promise<ActionResult> {
  return withAction('Error al eliminar el gasto', async () => {
    await db.delete(monthlyExpenses).where(eq(monthlyExpenses.id, id))
    revalidatePath(PATH)
  })
}

/**
 * Copia los gastos del mes anterior al mes indicado (los fijos se repiten cada mes).
 * Omite los que ya existen en el destino (misma categoría + descripción + laboratorio),
 * así que se puede ejecutar más de una vez sin duplicar. Devuelve cuántos copió.
 */
export async function copiarGastosMesAnterior(month: number, year: number): Promise<ActionResult<{ copiados: number }>> {
  return withAction('Error al copiar los gastos', async () => {
    if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) throw new ActionError('Período inválido')
    const prev = previousMonth(year, month)

    const [origen, destino] = await Promise.all([
      db.select().from(monthlyExpenses).where(and(eq(monthlyExpenses.anio, prev.year), eq(monthlyExpenses.mes, prev.month))),
      db.select().from(monthlyExpenses).where(and(eq(monthlyExpenses.anio, year), eq(monthlyExpenses.mes, month))),
    ])
    if (origen.length === 0) throw new ActionError('El mes anterior no tiene gastos para copiar')

    const clave = (g: { categoria: string; descripcion: string; grupoExamen: string | null }) =>
      `${g.categoria}|${g.descripcion.toLowerCase()}|${g.grupoExamen ?? ''}`
    const existentes = new Set(destino.map(clave))
    const nuevos = origen
      .filter((g) => !existentes.has(clave(g)))
      .map((g) => ({ anio: year, mes: month, categoria: g.categoria, descripcion: g.descripcion, monto: g.monto, grupoExamen: g.grupoExamen }))

    if (nuevos.length > 0) await db.insert(monthlyExpenses).values(nuevos)
    revalidatePath(PATH)
    return { copiados: nuevos.length }
  })
}


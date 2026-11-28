'use server'

import { and, asc, eq, inArray, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { expenseCategories, expenseGroups, monthlyExpenses } from '@/db/schema'
import { withAction, withQuery, ActionError, type ActionResult } from '@/lib/with-action'

// Gastos mensuales por categoría (laboratorio, insumos, arriendo, etc.). Se
// ingresan por mes, no por visita, y alimentan la hoja "Resumen" del reporte
// financiero. Cualquier usuario puede ingresarlos; el catálogo de categorías
// (`/categorias-gastos`) es solo-admin.

export type GastoMensualFormRow = {
  idCategoria: number
  categoria: string
  grupo: string
  activo: boolean
  monto: number
  notas: string
}

const periodoSchema = z.object({
  anio: z.coerce.number().int().min(2000, 'Año inválido').max(2100, 'Año inválido'),
  mes: z.coerce.number().int().min(1, 'Mes inválido').max(12, 'Mes inválido'),
})

const guardarSchema = periodoSchema.extend({
  items: z
    .array(
      z.object({
        idCategoria: z.coerce.number().int().positive('Categoría inválida'),
        monto: z.coerce.number().int('El monto debe ser un número entero').min(0, 'El monto no puede ser negativo'),
        notas: z.string().trim().max(1000, 'Notas demasiado largas').optional().default(''),
      }),
    )
    .max(200),
})

/**
 * Categorías activas + las inactivas que ya tienen un monto en ese mes (para
 * no perder datos históricos al desactivar una categoría).
 */
export async function getGastosMensuales(anio: number, mes: number): Promise<GastoMensualFormRow[]> {
  return withQuery(async () => {
    const periodo = periodoSchema.parse({ anio, mes })
    const registrados = await db
      .select({ idCategoria: monthlyExpenses.idCategoria, monto: monthlyExpenses.monto, notas: monthlyExpenses.notas })
      .from(monthlyExpenses)
      .where(and(eq(monthlyExpenses.anio, periodo.anio), eq(monthlyExpenses.mes, periodo.mes)))
    const porCategoria = new Map(registrados.map((r) => [r.idCategoria, r]))
    const idsConMonto = [...porCategoria.keys()]

    const categorias = await db
      .select({ id: expenseCategories.id, nombre: expenseCategories.nombre, activo: expenseCategories.activo, grupo: expenseGroups.nombre })
      .from(expenseCategories)
      .innerJoin(expenseGroups, eq(expenseCategories.idGrupo, expenseGroups.id))
      .where(
        idsConMonto.length
          ? or(eq(expenseCategories.activo, true), inArray(expenseCategories.id, idsConMonto))
          : eq(expenseCategories.activo, true),
      )
      .orderBy(asc(expenseGroups.orden), asc(expenseGroups.nombre), asc(expenseCategories.orden), asc(expenseCategories.nombre))

    return categorias.map((c) => ({
      idCategoria: c.id,
      categoria: c.nombre,
      grupo: c.grupo,
      activo: c.activo,
      monto: porCategoria.get(c.id)?.monto ?? 0,
      notas: porCategoria.get(c.id)?.notas ?? '',
    }))
  })
}

/**
 * Guarda los montos del mes (upsert por categoría). Un ítem en 0 y sin notas
 * borra el registro, así "vacío" y "0" no conviven.
 */
export async function guardarGastosMensuales(input: {
  anio: number
  mes: number
  items: { idCategoria: number; monto: number; notas?: string }[]
}): Promise<ActionResult> {
  return withAction('Error al guardar los gastos', async () => {
    const parsed = guardarSchema.safeParse(input)
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
    const { anio, mes, items } = parsed.data

    const ids = [...new Set(items.map((i) => i.idCategoria))]
    if (ids.length !== items.length) throw new ActionError('Categoría repetida')
    if (ids.length > 0) {
      const existentes = await db
        .select({ id: expenseCategories.id })
        .from(expenseCategories)
        .where(inArray(expenseCategories.id, ids))
      if (existentes.length !== ids.length) throw new ActionError('Categoría no encontrada')
    }

    await db.transaction(async (tx) => {
      for (const item of items) {
        const where = and(
          eq(monthlyExpenses.idCategoria, item.idCategoria),
          eq(monthlyExpenses.anio, anio),
          eq(monthlyExpenses.mes, mes),
        )
        if (item.monto === 0 && !item.notas) {
          await tx.delete(monthlyExpenses).where(where)
          continue
        }
        await tx
          .insert(monthlyExpenses)
          .values({ idCategoria: item.idCategoria, anio, mes, monto: item.monto, notas: item.notas || null })
          .onConflictDoUpdate({
            target: [monthlyExpenses.idCategoria, monthlyExpenses.anio, monthlyExpenses.mes],
            set: { monto: item.monto, notas: item.notas || null, updatedAt: new Date() },
          })
      }
    })

    revalidatePath('/gastos-mensuales')
  })
}

'use server'

import { and, asc, eq, inArray, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { costCategories, monthlyCosts } from '@/db/schema'
import { withAction, withQuery, ActionError, type ActionResult } from '@/lib/with-action'

// Costos mensuales por categoría (laboratorio, insumos, arriendo, etc.). Se
// ingresan por mes, no por visita, y alimentan la hoja "Resumen" del reporte
// financiero. Cualquier usuario puede ingresarlos; el catálogo de categorías
// (`/categorias-costos`) es solo-admin.

export type CostoMensualFormRow = {
  idCategoria: number
  categoria: string
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
export async function getCostosMensuales(anio: number, mes: number): Promise<CostoMensualFormRow[]> {
  return withQuery(async () => {
    const periodo = periodoSchema.parse({ anio, mes })
    const registrados = await db
      .select({ idCategoria: monthlyCosts.idCategoria, monto: monthlyCosts.monto, notas: monthlyCosts.notas })
      .from(monthlyCosts)
      .where(and(eq(monthlyCosts.anio, periodo.anio), eq(monthlyCosts.mes, periodo.mes)))
    const porCategoria = new Map(registrados.map((r) => [r.idCategoria, r]))
    const idsConMonto = [...porCategoria.keys()]

    const categorias = await db
      .select({ id: costCategories.id, nombre: costCategories.nombre, activo: costCategories.activo })
      .from(costCategories)
      .where(
        idsConMonto.length
          ? or(eq(costCategories.activo, true), inArray(costCategories.id, idsConMonto))
          : eq(costCategories.activo, true),
      )
      .orderBy(asc(costCategories.nombre))

    return categorias.map((c) => ({
      idCategoria: c.id,
      categoria: c.nombre,
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
export async function guardarCostosMensuales(input: {
  anio: number
  mes: number
  items: { idCategoria: number; monto: number; notas?: string }[]
}): Promise<ActionResult> {
  return withAction('Error al guardar los costos', async () => {
    const parsed = guardarSchema.safeParse(input)
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
    const { anio, mes, items } = parsed.data

    const ids = [...new Set(items.map((i) => i.idCategoria))]
    if (ids.length !== items.length) throw new ActionError('Categoría repetida')
    if (ids.length > 0) {
      const existentes = await db
        .select({ id: costCategories.id })
        .from(costCategories)
        .where(inArray(costCategories.id, ids))
      if (existentes.length !== ids.length) throw new ActionError('Categoría no encontrada')
    }

    await db.transaction(async (tx) => {
      for (const item of items) {
        const where = and(
          eq(monthlyCosts.idCategoria, item.idCategoria),
          eq(monthlyCosts.anio, anio),
          eq(monthlyCosts.mes, mes),
        )
        if (item.monto === 0 && !item.notas) {
          await tx.delete(monthlyCosts).where(where)
          continue
        }
        await tx
          .insert(monthlyCosts)
          .values({ idCategoria: item.idCategoria, anio, mes, monto: item.monto, notas: item.notas || null })
          .onConflictDoUpdate({
            target: [monthlyCosts.idCategoria, monthlyCosts.anio, monthlyCosts.mes],
            set: { monto: item.monto, notas: item.notas || null, updatedAt: new Date() },
          })
      }
    })

    revalidatePath('/costos-mensuales')
  })
}

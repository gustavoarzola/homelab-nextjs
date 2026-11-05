'use server'

import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/db'
import { feeRetentionRates } from '@/db/schema'
import { fields } from '@/lib/validation'
import { withFormAction, withQuery, ActionError, type ActionResult } from '@/lib/with-action'

export type TasaRetencionRow = { id: number; vigenteDesde: string; porcentaje: number }

const createSchema = z.object({
  vigenteDesde: fields.fechaRequerida,
  porcentaje: z.coerce.number().min(0, 'Porcentaje inválido').max(100, 'Porcentaje inválido'),
})

export async function getTasasRetencion(): Promise<TasaRetencionRow[]> {
  return withQuery(async () => {
    const rows = await db.select().from(feeRetentionRates).orderBy(desc(feeRetentionRates.vigenteDesde))
    return rows.map((r) => ({ id: r.id, vigenteDesde: r.vigenteDesde, porcentaje: Number(r.porcentaje) }))
  })
}

/**
 * Agrega una tasa con vigencia desde una fecha. Las anteriores no se editan: la tasa de
 * un mes es la de mayor `vigente_desde` anterior o igual a su fin, así los meses ya
 * reportados no cambian cuando la tasa sube.
 */
export async function createTasaRetencion(formData: FormData): Promise<ActionResult> {
  return withFormAction(createSchema, formData, 'Error al guardar la tasa', async ({ vigenteDesde, porcentaje }) => {
    const [existente] = await db
      .select({ id: feeRetentionRates.id })
      .from(feeRetentionRates)
      .where(eq(feeRetentionRates.vigenteDesde, vigenteDesde))
      .limit(1)
    if (existente) throw new ActionError('Ya existe una tasa con esa fecha de vigencia')

    await db.insert(feeRetentionRates).values({ vigenteDesde, porcentaje: porcentaje.toFixed(2) })
    revalidatePath('/estado-resultados')
  })
}

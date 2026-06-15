'use server'

import { db } from '@/db'
import { nurses, visits } from '@/db/schema'
import { eq, count, and, or, ilike, asc, desc, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { validateRut } from '@/lib/rut'
import type { SearchParams } from '@/components/data-table'
import { fields } from '@/lib/validation'
import { withQuery, withAction, withFormAction, ActionError, type ActionResult } from '@/lib/with-action'

const enfermeraSchema = z.object({
  nombres: z.string().trim().min(1, 'Nombres requeridos'),
  apellidoPaterno: z.string().trim().min(1, 'Apellido paterno requerido'),
  apellidoMaterno: z.string().trim().optional().transform((v) => v ?? ''),
  rut: z.string().trim().optional().transform((v, ctx) => {
    const raw = v || null
    if (!raw) return null
    const result = validateRut(raw)
    if (!result.valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RUT inválido' })
      return z.NEVER
    }
    return result.normalized
  }),
  telefono: z.string().trim().optional().transform((v) => v || null),
  correo: z.string().trim().optional().transform((v) => v || null),
  porcentajePago: z.string().trim().optional()
    .transform((v) => v || '67.5')
    .refine(
      (v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 100 },
      'Porcentaje inválido (0–100)',
    ),
  comunaResidencia: z.string().trim().optional().transform((v) => v || null),
})
const enfermeraUpdateSchema = enfermeraSchema.extend({ id: fields.id })

export type NurseRow = {
  id: number
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string | null
  rut: string | null
  telefono: string | null
  correo: string | null
  activo: boolean
  porcentajePago: string
  comunaResidencia: string | null
}

export async function searchEnfermeras(
  params: SearchParams,
): Promise<{ rows: NurseRow[]; total: number }> {
  return withQuery(async () => {
    const { filters, sort, page, pageSize } = params
    const nombre = (filters.nombre as string | undefined)?.trim()
    const mostrarInactivas = filters.mostrarInactivas as boolean | undefined

    const conditions: SQL[] = []
    if (nombre) {
      conditions.push(
        or(
          ilike(nurses.nombres, `%${nombre}%`),
          ilike(nurses.apellidoPaterno, `%${nombre}%`),
          ilike(nurses.apellidoMaterno, `%${nombre}%`),
        )!,
      )
    }
    if (!mostrarInactivas) conditions.push(eq(nurses.activo, true))

    const where = conditions.length ? and(...conditions) : undefined

    const [countRow] = await db.select({ total: count() }).from(nurses).where(where)
    const total = countRow?.total ?? 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortCols: Record<string, any> = {
      apellidoPaterno: nurses.apellidoPaterno,
      nombres: nurses.nombres,
      rut: nurses.rut,
      correo: nurses.correo,
      telefono: nurses.telefono,
    }
    const sortCol = (sort?.key && sortCols[sort.key]) ?? nurses.apellidoPaterno
    const primaryOrder = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

    const rows = await db
      .select()
      .from(nurses)
      .where(where)
      .orderBy(primaryOrder, asc(nurses.apellidoPaterno), asc(nurses.nombres))
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    return { rows, total: Number(countRow?.total ?? 0) }
  })
}

export async function createEnfermera(formData: FormData): Promise<ActionResult> {
  return withFormAction(enfermeraSchema, formData, 'Error al crear la enfermera', async (data) => {
    await db.insert(nurses).values(data)
    revalidatePath('/enfermeras')
  })
}

export async function updateEnfermera(formData: FormData): Promise<ActionResult> {
  return withFormAction(enfermeraUpdateSchema, formData, 'Error al actualizar', async ({ id, ...data }) => {
    await db.update(nurses).set(data).where(eq(nurses.id, id))
    revalidatePath('/enfermeras')
  })
}

export async function toggleEnfermera(id: number, activo: boolean): Promise<ActionResult> {
  return withAction('Error al cambiar estado', async () => {
    await db.update(nurses).set({ activo: !activo }).where(eq(nurses.id, id))
    revalidatePath('/enfermeras')
  })
}

export async function deleteEnfermera(id: number): Promise<ActionResult> {
  return withAction('Error al eliminar', async () => {
    const [countRow] = await db.select({ total: count() }).from(visits).where(eq(visits.idEnfermera, id))
    const total = Number(countRow?.total ?? 0)
    if (total > 0) throw new ActionError(
      `No se puede eliminar: tiene ${total} visita${total === 1 ? '' : 's'} asignada${total === 1 ? '' : 's'}`,
    )
    await db.delete(nurses).where(eq(nurses.id, id))
    revalidatePath('/enfermeras')
  })
}

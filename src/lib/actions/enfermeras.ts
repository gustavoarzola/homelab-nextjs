'use server'

import { db } from '@/db'
import { nurses, visits } from '@/db/schema'
import { eq, count, and, or, ilike, asc, desc, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { validateRut } from '@/lib/rut'
import type { SearchParams } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'
import { parseFormData, fields } from '@/lib/validation'

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
  await requireSession()

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
}

type Result = { success: boolean; error?: string }

export async function createEnfermera(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(enfermeraSchema, formData)
  if (!parsed.success) return parsed

  try {
    await db.insert(nurses).values(parsed.data)
    revalidatePath('/enfermeras')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear la enfermera' }
  }
}

export async function updateEnfermera(formData: FormData): Promise<Result> {
  await requireSession()

  const parsed = parseFormData(enfermeraUpdateSchema, formData)
  if (!parsed.success) return parsed
  const { id, ...data } = parsed.data

  try {
    await db.update(nurses).set(data).where(eq(nurses.id, id))
    revalidatePath('/enfermeras')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleEnfermera(id: number, activo: boolean): Promise<Result> {
  await requireSession()

  try {
    await db.update(nurses).set({ activo: !activo }).where(eq(nurses.id, id))
    revalidatePath('/enfermeras')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

export async function deleteEnfermera(id: number): Promise<Result> {
  await requireSession()

  try {
    const [countRow] = await db
      .select({ total: count() })
      .from(visits)
      .where(eq(visits.idEnfermera, id))
    const total = countRow?.total ?? 0

    if (total > 0)
      return { success: false, error: `No se puede eliminar: tiene ${total} visita${total === 1 ? '' : 's'} asignada${total === 1 ? '' : 's'}` }

    await db.delete(nurses).where(eq(nurses.id, id))
    revalidatePath('/enfermeras')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al eliminar' }
  }
}

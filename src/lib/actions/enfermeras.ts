'use server'

import { db } from '@/db'
import { nurses, visits } from '@/db/schema'
import { eq, count, and, or, ilike, asc, desc, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { validateRut } from '@/lib/rut'
import type { SearchParams } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'

export type NurseRow = {
  id: number
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string | null
  rut: string | null
  telefono: string | null
  correo: string | null
  activo: boolean
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

function parseFields(formData: FormData): { error: string } | {
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  rut: string | null
  telefono: string | null
  correo: string | null
} {
  const nombres = (formData.get('nombres') as string)?.trim()
  const apellidoPaterno = (formData.get('apellidoPaterno') as string)?.trim()
  const apellidoMaterno = (formData.get('apellidoMaterno') as string)?.trim() ?? ''
  const rawRut = (formData.get('rut') as string)?.trim() || null
  const telefono = (formData.get('telefono') as string)?.trim() || null
  const correo = (formData.get('correo') as string)?.trim() || null

  if (!nombres) return { error: 'Nombres requeridos' }
  if (!apellidoPaterno) return { error: 'Apellido paterno requerido' }

  let rut: string | null = null
  if (rawRut) {
    const result = validateRut(rawRut)
    if (!result.valid) return { error: 'RUT inválido' }
    rut = result.normalized
  }

  return { nombres, apellidoPaterno, apellidoMaterno, rut, telefono, correo }
}

export async function createEnfermera(formData: FormData): Promise<Result> {
  await requireSession()

  const fields = parseFields(formData)
  if ('error' in fields) return { success: false, error: fields.error }

  try {
    await db.insert(nurses).values(fields)
    revalidatePath('/enfermeras')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear la enfermera' }
  }
}

export async function updateEnfermera(formData: FormData): Promise<Result> {
  await requireSession()

  const id = Number(formData.get('id'))
  if (!id) return { success: false, error: 'ID inválido' }

  const fields = parseFields(formData)
  if ('error' in fields) return { success: false, error: fields.error }

  try {
    await db.update(nurses).set(fields).where(eq(nurses.id, id))
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

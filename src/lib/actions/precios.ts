'use server'

import { db } from '@/db'
import {
  examPrices,
  nursingVisitPrices,
  exams,
  patients,
  addresses,
  healthInsurances,
} from '@/db/schema'
import { eq, and, or, isNull, asc, desc, count, ilike, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth-guard'
import type { SearchParams, Result } from '@/components/data-table'

// ─── Row types ────────────────────────────────────────────────────────────────

export type PrecioExamenRow = {
  id: number
  idExamen: number
  examenNombre: string
  examenCodigo: string
  tipoPrevision: string
  comuna: string | null
  precio: number
  activo: boolean
}

export type PrecioVisitaRow = {
  id: number
  comuna: string
  precio: number
  activo: boolean
}

export type CostoVisitaDetalle = {
  costoExamenes: number
  costoVisitaEnfermeria: number
  total: number
  desglose: { descripcion: string; monto: number }[]
}

// ─── Helper: determinar tipo_prevision desde nombre compañía ──────────────────

function detectarTipoPrevision(nombre: string | null): 'fonasa' | 'isapre' | 'particular' {
  if (!nombre) return 'particular'
  const n = nombre.toLowerCase()
  if (n.includes('fonasa')) return 'fonasa'
  if (
    n.includes('isapre') ||
    n.includes('banmédica') ||
    n.includes('banmedica') ||
    n.includes('colmena') ||
    n.includes('consalud') ||
    n.includes('cruz blanca') ||
    n.includes('nueva masvida') ||
    n.includes('vida tres')
  )
    return 'isapre'
  return 'particular'
}

// ─── calcularCostoVisita ──────────────────────────────────────────────────────

export async function calcularCostoVisita(
  idPaciente: number,
  examIds: number[],
): Promise<CostoVisitaDetalle> {
  await requireSession()

  // Obtener datos del paciente (previsión + comuna)
  const [paciente] = await db
    .select({
      previsionNombre: healthInsurances.nombre,
      comuna: addresses.areaAdministrativa3,
    })
    .from(patients)
    .leftJoin(healthInsurances, eq(patients.idCompaniaSeguro, healthInsurances.id))
    .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
    .where(eq(patients.id, idPaciente))

  const tipoPrevision = detectarTipoPrevision(paciente?.previsionNombre ?? null)
  const comuna = paciente?.comuna ?? null

  const desglose: { descripcion: string; monto: number }[] = []
  let costoExamenes = 0

  // Calcular costo por cada examen
  if (examIds.length > 0) {
    for (const idExamen of examIds) {
      // Buscar precio: primero por comuna específica, luego sin comuna
      let precioRow: { precio: number } | undefined

      if (comuna) {
        const [row] = await db
          .select({ precio: examPrices.precio })
          .from(examPrices)
          .where(
            and(
              eq(examPrices.idExamen, idExamen),
              eq(examPrices.tipoPrevision, tipoPrevision),
              eq(examPrices.comuna, comuna),
              eq(examPrices.activo, true),
            ),
          )
          .limit(1)
        precioRow = row
      }

      if (!precioRow) {
        const [row] = await db
          .select({ precio: examPrices.precio })
          .from(examPrices)
          .where(
            and(
              eq(examPrices.idExamen, idExamen),
              eq(examPrices.tipoPrevision, tipoPrevision),
              isNull(examPrices.comuna),
              eq(examPrices.activo, true),
            ),
          )
          .limit(1)
        precioRow = row
      }

      if (precioRow) {
        const [examen] = await db
          .select({ nombre: exams.nombre })
          .from(exams)
          .where(eq(exams.id, idExamen))
        costoExamenes += precioRow.precio
        desglose.push({
          descripcion: examen?.nombre ?? `Examen #${idExamen}`,
          monto: precioRow.precio,
        })
      }
    }
  }

  // Buscar precio de visita de enfermería por comuna
  let costoVisitaEnfermeria = 0
  if (comuna) {
    const [visRow] = await db
      .select({ precio: nursingVisitPrices.precio })
      .from(nursingVisitPrices)
      .where(and(eq(nursingVisitPrices.comuna, comuna), eq(nursingVisitPrices.activo, true)))
      .limit(1)

    if (visRow) {
      costoVisitaEnfermeria = visRow.precio
      desglose.push({ descripcion: 'Visita de enfermería', monto: visRow.precio })
    }
  }

  return {
    costoExamenes,
    costoVisitaEnfermeria,
    total: costoExamenes + costoVisitaEnfermeria,
    desglose,
  }
}

// ─── searchPreciosExamenes ────────────────────────────────────────────────────

export async function searchPreciosExamenes(
  params: SearchParams,
): Promise<{ rows: PrecioExamenRow[]; total: number }> {
  await requireSession()

  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const tipoPrevision = (filters.tipoPrevision as string | undefined)?.trim()
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar)
    conditions.push(
      or(ilike(exams.nombre, `%${buscar}%`), ilike(exams.codigo, `%${buscar}%`))!,
    )
  if (tipoPrevision) conditions.push(eq(examPrices.tipoPrevision, tipoPrevision))
  if (!mostrarInactivos) conditions.push(eq(examPrices.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ total: count() })
    .from(examPrices)
    .leftJoin(exams, eq(examPrices.idExamen, exams.id))
    .where(where)

  const sortCol = sort?.key === 'examenNombre' ? exams.nombre : examPrices.precio
  const order = sort?.dir === 'asc' ? asc(sortCol) : desc(sortCol)

  const rows = await db
    .select({
      id: examPrices.id,
      idExamen: examPrices.idExamen,
      examenNombre: exams.nombre,
      examenCodigo: exams.codigo,
      tipoPrevision: examPrices.tipoPrevision,
      comuna: examPrices.comuna,
      precio: examPrices.precio,
      activo: examPrices.activo,
    })
    .from(examPrices)
    .leftJoin(exams, eq(examPrices.idExamen, exams.id))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    rows: rows.map((r) => ({
      id: r.id,
      idExamen: r.idExamen,
      examenNombre: r.examenNombre ?? '',
      examenCodigo: r.examenCodigo ?? '',
      tipoPrevision: r.tipoPrevision,
      comuna: r.comuna,
      precio: r.precio,
      activo: r.activo,
    })),
    total: Number(countRow?.total ?? 0),
  }
}

export async function createPrecioExamen(fd: FormData): Promise<Result> {
  await requireSession()

  const idExamen = Number(fd.get('idExamen'))
  const tipoPrevision = (fd.get('tipoPrevision') as string)?.trim()
  const comuna = (fd.get('comuna') as string)?.trim() || null
  const precio = Number(fd.get('precio'))

  if (!idExamen || !tipoPrevision || !precio)
    return { success: false, error: 'Examen, previsión y precio son requeridos' }

  try {
    await db.insert(examPrices).values({ idExamen, tipoPrevision, comuna, precio })
    revalidatePath('/precios/examenes')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear precio' }
  }
}

export async function updatePrecioExamen(fd: FormData): Promise<Result> {
  await requireSession()

  const id = Number(fd.get('id'))
  const tipoPrevision = (fd.get('tipoPrevision') as string)?.trim()
  const comuna = (fd.get('comuna') as string)?.trim() || null
  const precio = Number(fd.get('precio'))

  if (!id || !tipoPrevision || !precio) return { success: false, error: 'Datos inválidos' }

  try {
    await db
      .update(examPrices)
      .set({ tipoPrevision, comuna, precio, updatedAt: new Date() })
      .where(eq(examPrices.id, id))
    revalidatePath('/precios/examenes')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar precio' }
  }
}

export async function togglePrecioExamen(id: number, activo: boolean): Promise<Result> {
  await requireSession()

  try {
    await db.update(examPrices).set({ activo: !activo }).where(eq(examPrices.id, id))
    revalidatePath('/precios/examenes')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── searchPreciosVisita ──────────────────────────────────────────────────────

export async function searchPreciosVisita(
  params: SearchParams,
): Promise<{ rows: PrecioVisitaRow[]; total: number }> {
  await requireSession()

  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

  const conditions: SQL[] = []
  if (buscar) conditions.push(ilike(nursingVisitPrices.comuna, `%${buscar}%`))
  if (!mostrarInactivos) conditions.push(eq(nursingVisitPrices.activo, true))
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ total: count() })
    .from(nursingVisitPrices)
    .where(where)

  const sortCol =
    sort?.key === 'precio' ? nursingVisitPrices.precio : nursingVisitPrices.comuna
  const order = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

  const rows = await db
    .select()
    .from(nursingVisitPrices)
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function createPrecioVisita(fd: FormData): Promise<Result> {
  await requireSession()

  const comuna = (fd.get('comuna') as string)?.trim()
  const precio = Number(fd.get('precio'))

  if (!comuna || !precio) return { success: false, error: 'Comuna y precio son requeridos' }

  try {
    await db.insert(nursingVisitPrices).values({ comuna, precio })
    revalidatePath('/precios/visitas')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear precio' }
  }
}

export async function updatePrecioVisita(fd: FormData): Promise<Result> {
  await requireSession()

  const id = Number(fd.get('id'))
  const comuna = (fd.get('comuna') as string)?.trim()
  const precio = Number(fd.get('precio'))

  if (!id || !comuna || !precio) return { success: false, error: 'Datos inválidos' }

  try {
    await db
      .update(nursingVisitPrices)
      .set({ comuna, precio, updatedAt: new Date() })
      .where(eq(nursingVisitPrices.id, id))
    revalidatePath('/precios/visitas')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar precio' }
  }
}

export async function togglePrecioVisita(id: number, activo: boolean): Promise<Result> {
  await requireSession()

  try {
    await db
      .update(nursingVisitPrices)
      .set({ activo: !activo })
      .where(eq(nursingVisitPrices.id, id))
    revalidatePath('/precios/visitas')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── getExamenesForSelect ─────────────────────────────────────────────────────

export async function getExamenesForSelect(): Promise<{ id: number; label: string }[]> {
  await requireSession()

  const rows = await db
    .select({ id: exams.id, nombre: exams.nombre, codigo: exams.codigo })
    .from(exams)
    .where(eq(exams.activo, true))
    .orderBy(asc(exams.nombre))

  return rows.map((r) => ({ id: r.id, label: `${r.nombre} (${r.codigo})` }))
}

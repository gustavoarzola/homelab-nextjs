'use server'

import { db } from '@/db'
import {
  nursingVisitPrices,
  exams,
  patients,
  addresses,
  healthInsurances,
  visits,
  nurses,
  laboratories,
  visitProcedures,
  visitExams,
  procedures,
} from '@/db/schema'
import { eq, and, or, isNull, ne, asc, desc, count, ilike, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth-guard'
import { formatNombre } from '@/lib/paciente'
import type { SearchParams, Result } from '@/components/data-table'
import { calcularCostoVisitaPersistida } from '@/lib/pricing/visitas'

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
  comuna: string | null
  precio: number
  activo: boolean
}

// ─── Helper: normalizar categoria ─────────────────────────────────────────────

function normalizarCategoria(categoria: string | null): 'fonasa' | 'isapre' | 'particular' {
  if (categoria === 'fonasa' || categoria === 'isapre') return categoria
  return 'particular'
}

// ─── searchPreciosExamenes ────────────────────────────────────────────────────

export async function searchPreciosExamenes(
  params: SearchParams,
): Promise<{ rows: PrecioExamenRow[]; total: number }> {
  await requireSession()

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
}

export async function createPrecioExamen(fd: FormData): Promise<Result> {
  await requireSession()

  const idExamen = Number(fd.get('idExamen'))
  const precio = Number(fd.get('precio'))

  if (!idExamen || !precio)
    return { success: false, error: 'Examen y precio son requeridos' }

  try {
    await db.update(exams).set({ precio }).where(eq(exams.id, idExamen))
    revalidatePath('/examenes')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar precio' }
  }
}

export async function updatePrecioExamen(fd: FormData): Promise<Result> {
  await requireSession()

  const id = Number(fd.get('id'))
  const precio = Number(fd.get('precio'))

  if (!id || !precio) return { success: false, error: 'Datos inválidos' }

  try {
    await db
      .update(exams)
      .set({ precio, updatedAt: new Date() })
      .where(eq(exams.id, id))
    revalidatePath('/examenes')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar precio' }
  }
}

export async function togglePrecioExamen(id: number, activo: boolean): Promise<Result> {
  await requireSession()

  try {
    await db.update(exams).set({ activo: !activo }).where(eq(exams.id, id))
    revalidatePath('/examenes')
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

  const comuna = (fd.get('comuna') as string)?.trim() || null
  const precio = Number(fd.get('precio'))

  if (!precio) return { success: false, error: 'Precio es requerido' }

  const duplicateCondition = comuna
    ? eq(nursingVisitPrices.comuna, comuna)
    : isNull(nursingVisitPrices.comuna)

  const [existing] = await db
    .select({ id: nursingVisitPrices.id })
    .from(nursingVisitPrices)
    .where(duplicateCondition)
    .limit(1)

  if (existing) {
    const label = comuna ? `la comuna "${comuna}"` : 'el precio base'
    return { success: false, error: `Ya existe un precio para ${label}` }
  }

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
  const comuna = (fd.get('comuna') as string)?.trim() || null
  const precio = Number(fd.get('precio'))

  if (!id || !precio) return { success: false, error: 'Datos inválidos' }

  const duplicateCondition = comuna
    ? and(eq(nursingVisitPrices.comuna, comuna), ne(nursingVisitPrices.id, id))
    : and(isNull(nursingVisitPrices.comuna), ne(nursingVisitPrices.id, id))

  const [duplicate] = await db
    .select({ id: nursingVisitPrices.id })
    .from(nursingVisitPrices)
    .where(duplicateCondition)
    .limit(1)

  if (duplicate) {
    const label = comuna ? `la comuna "${comuna}"` : 'el precio base'
    return { success: false, error: `Ya existe otro precio para ${label}` }
  }

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

// ─── getCotizacionVisita ──────────────────────────────────────────────────────

export type ItemCotizacion = {
  descripcion: string
  codigo: string
  tipo: 'examen' | 'procedimiento' | 'visita'
  precio: number | null   // null = sin precio configurado
}

export type CotizacionVisita = {
  id: number
  fecha: string
  hora: string | null
  paciente: {
    nombreCompleto: string
    identificador: string | null
    tipoIdentificador: string | null
    fechaNacimiento: string | null
    prevision: string | null
    direccion: string | null
    comuna: string | null
  }
  enfermera: string | null
  laboratorio: string | null
  items: ItemCotizacion[]
  subtotalExamenes: number
  costoVisitaEnfermeria: number
  montoRecargo: number
  total: number
  tipoPrevision: 'fonasa' | 'isapre' | 'particular'
}

export async function getCotizacionVisita(idVisita: number): Promise<CotizacionVisita | null> {
  await requireSession()

  // Visita base
  const [visitRow] = await db
    .select({
      id: visits.id,
      fecha: visits.fecha,
      hora: visits.hora,
      idPaciente: visits.idPaciente,
      idEnfermera: visits.idEnfermera,
      idLaboratorio: visits.idLaboratorio,
      montoRecargo: visits.montoRecargo,
    })
    .from(visits)
    .where(eq(visits.id, idVisita))

  if (!visitRow) return null

  // Datos en paralelo
  const [pacienteRow, enfermeraRow, laboratorioRow, procRows, examRows] = await Promise.all([
    visitRow.idPaciente
      ? db
          .select({
            id: patients.id,
            nombres: patients.nombres,
            apellidoPaterno: patients.apellidoPaterno,
            apellidoMaterno: patients.apellidoMaterno,
            identificador: patients.identificador,
            tipoIdentificador: patients.tipoIdentificador,
            fechaNacimiento: patients.fechaNacimiento,
            previsionNombre: healthInsurances.nombre,
            categoriaSeguro: healthInsurances.categoria,
            direccionFormateada: addresses.direccionFormateada,
            direccion: addresses.direccion,
            comuna: addresses.areaAdministrativa3,
          })
          .from(patients)
          .leftJoin(healthInsurances, eq(patients.idCompaniaSeguro, healthInsurances.id))
          .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
          .where(eq(patients.id, visitRow.idPaciente))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),

    visitRow.idEnfermera
      ? db
          .select({ nombres: nurses.nombres, apellidoPaterno: nurses.apellidoPaterno, apellidoMaterno: nurses.apellidoMaterno })
          .from(nurses)
          .where(eq(nurses.id, visitRow.idEnfermera))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),

    visitRow.idLaboratorio
      ? db
          .select({ nombre: laboratories.nombre })
          .from(laboratories)
          .where(eq(laboratories.id, visitRow.idLaboratorio))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),

    db
      .select({ id: visitProcedures.idProcedimiento, nombre: procedures.nombre, codigo: procedures.codigo, precio: visitProcedures.precio })
      .from(visitProcedures)
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(eq(visitProcedures.idVisita, idVisita)),

    db
      .select({ id: visitExams.idExamen, nombre: exams.nombre, codigo: exams.codigo, precio: visitExams.precio })
      .from(visitExams)
      .innerJoin(exams, eq(visitExams.idExamen, exams.id))
      .where(eq(visitExams.idVisita, idVisita)),
  ])

  const tipoPrevision = normalizarCategoria(pacienteRow?.categoriaSeguro ?? null)
  const costoCalculado = await calcularCostoVisitaPersistida(idVisita)

  // Precios de exámenes (desde snapshot guardado en visitExams.precio)
  const items: ItemCotizacion[] = []
  for (const exam of examRows) {
    const precioExamen = exam.precio || null
    items.push({ descripcion: exam.nombre, codigo: exam.codigo, tipo: 'examen', precio: precioExamen })
  }

  for (const proc of procRows) {
    const precio = proc.precio || null
    items.push({ descripcion: proc.nombre, codigo: proc.codigo, tipo: 'procedimiento', precio })
  }

  if (costoCalculado.aplicaVisitaEnfermeria) {
    items.push({
      descripcion: 'Visita de enfermería a domicilio',
      codigo: 'VIS-ENF',
      tipo: 'visita',
      precio: costoCalculado.precioVisitaConfigurado ? costoCalculado.costoVisitaEnfermeria : null,
    })
  }

  const laboratorioLabel = laboratorioRow?.nombre ?? null
  const montoRecargo = visitRow.montoRecargo ?? 0

  return {
    id: visitRow.id,
    fecha: visitRow.fecha,
    hora: visitRow.hora ?? null,
    paciente: {
      nombreCompleto: pacienteRow
        ? formatNombre({
            nombres: pacienteRow.nombres,
            apellidoPaterno: pacienteRow.apellidoPaterno,
            apellidoMaterno: pacienteRow.apellidoMaterno,
          })
        : '—',
      identificador: pacienteRow?.identificador ?? null,
      tipoIdentificador: pacienteRow?.tipoIdentificador ?? null,
      fechaNacimiento: pacienteRow?.fechaNacimiento ?? null,
      prevision: pacienteRow?.previsionNombre ?? null,
      direccion: pacienteRow?.direccionFormateada ?? pacienteRow?.direccion ?? null,
      comuna: pacienteRow?.comuna ?? null,
    },
    enfermera: enfermeraRow
      ? formatNombre({
          nombres: enfermeraRow.nombres,
          apellidoPaterno: enfermeraRow.apellidoPaterno,
          apellidoMaterno: enfermeraRow.apellidoMaterno,
        })
      : null,
    laboratorio: laboratorioLabel,
    items,
    subtotalExamenes: costoCalculado.subtotalExamenes,
    costoVisitaEnfermeria: costoCalculado.costoVisitaEnfermeria,
    montoRecargo,
    total: costoCalculado.total,
    tipoPrevision,
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

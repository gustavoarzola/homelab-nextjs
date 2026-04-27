'use server'

import { db } from '@/db'
import {
  examPrices,
  nursingVisitPrices,
  exams,
  patients,
  addresses,
  healthInsurances,
  visits,
  nurses,
  branches,
  laboratories,
  visitProcedures,
  visitExams,
  procedures,
} from '@/db/schema'
import { eq, and, or, isNull, asc, desc, count, ilike, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth-guard'
import { formatNombre } from '@/lib/paciente'
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
  sucursal: string | null
  items: ItemCotizacion[]
  subtotalExamenes: number
  costoVisitaEnfermeria: number
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
      idSucursal: visits.idSucursal,
    })
    .from(visits)
    .where(eq(visits.id, idVisita))

  if (!visitRow) return null

  // Datos en paralelo
  const [pacienteRow, enfermeraRow, sucursalRow, procRows, examRows] = await Promise.all([
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

    visitRow.idSucursal
      ? db
          .select({ nombre: branches.nombre, laboratorio: laboratories.nombre })
          .from(branches)
          .leftJoin(laboratories, eq(branches.idLaboratorio, laboratories.id))
          .where(eq(branches.id, visitRow.idSucursal))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),

    db
      .select({ id: visitProcedures.idProcedimiento, nombre: procedures.nombre, codigo: procedures.codigo })
      .from(visitProcedures)
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(eq(visitProcedures.idVisita, idVisita)),

    db
      .select({ id: visitExams.idExamen, nombre: exams.nombre, codigo: exams.codigo })
      .from(visitExams)
      .innerJoin(exams, eq(visitExams.idExamen, exams.id))
      .where(eq(visitExams.idVisita, idVisita)),
  ])

  const tipoPrevision = detectarTipoPrevision(pacienteRow?.previsionNombre ?? null)
  const comuna = pacienteRow?.comuna ?? null

  // Precios de exámenes
  const items: ItemCotizacion[] = []
  let subtotalExamenes = 0

  for (const exam of examRows) {
    let precioExamen: number | null = null

    if (comuna) {
      const [row] = await db
        .select({ precio: examPrices.precio })
        .from(examPrices)
        .where(
          and(
            eq(examPrices.idExamen, exam.id),
            eq(examPrices.tipoPrevision, tipoPrevision),
            eq(examPrices.comuna, comuna),
            eq(examPrices.activo, true),
          ),
        )
        .limit(1)
      if (row) precioExamen = row.precio
    }

    if (precioExamen === null) {
      const [row] = await db
        .select({ precio: examPrices.precio })
        .from(examPrices)
        .where(
          and(
            eq(examPrices.idExamen, exam.id),
            eq(examPrices.tipoPrevision, tipoPrevision),
            isNull(examPrices.comuna),
            eq(examPrices.activo, true),
          ),
        )
        .limit(1)
      if (row) precioExamen = row.precio
    }

    if (precioExamen !== null) subtotalExamenes += precioExamen
    items.push({ descripcion: exam.nombre, codigo: exam.codigo, tipo: 'examen', precio: precioExamen })
  }

  for (const proc of procRows) {
    items.push({ descripcion: proc.nombre, codigo: proc.codigo, tipo: 'procedimiento', precio: null })
  }

  // Precio de visita de enfermería
  let costoVisitaEnfermeria = 0
  if (comuna) {
    const [row] = await db
      .select({ precio: nursingVisitPrices.precio })
      .from(nursingVisitPrices)
      .where(and(eq(nursingVisitPrices.comuna, comuna), eq(nursingVisitPrices.activo, true)))
      .limit(1)
    if (row) costoVisitaEnfermeria = row.precio
  }

  // Agregar visita de enfermería como ítem
  items.push({
    descripcion: 'Visita de enfermería a domicilio',
    codigo: 'VIS-ENF',
    tipo: 'visita',
    precio: costoVisitaEnfermeria || null,
  })

  const sucursalLabel = sucursalRow
    ? sucursalRow.laboratorio
      ? `${sucursalRow.nombre} (${sucursalRow.laboratorio})`
      : sucursalRow.nombre
    : null

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
    sucursal: sucursalLabel,
    items,
    subtotalExamenes,
    costoVisitaEnfermeria,
    total: subtotalExamenes + costoVisitaEnfermeria,
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

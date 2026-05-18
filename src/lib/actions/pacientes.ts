'use server'

import { db } from '@/db'
import {
  patients,
  addresses,
  healthInsurances,
  patientPhones,
  visits,
  visitProcedures,
  visitExams,
  procedures,
  exams,
  nurses,
} from '@/db/schema'
import { eq, count, and, or, ilike, asc, desc, inArray, not, sql, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { validateRut, validatePasaporte } from '@/lib/rut'
import { formatNombre } from '@/lib/paciente'
import type { SearchParams, Result } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'

// ─── Row types ────────────────────────────────────────────────────────────────

export type PacienteRow = {
  id: number
  nombres: string
  apellidoPaterno: string | null
  apellidoMaterno: string | null
  identificador: string | null
  tipoIdentificador: string | null
  telefono: string | null
  prevision: string | null
  comuna: string | null
}

export type PacienteDetalle = {
  id: number
  identificador: string | null
  tipoIdentificador: string | null
  nombres: string
  apellidoPaterno: string | null
  apellidoMaterno: string | null
  fechaNacimiento: string | null
  correo: string | null
  informacionAdicional: string | null
  idCompaniaSeguro: number | null
  idResidenciaAdulto: number | null
  // address
  direccion: string
  direccionFormateada: string | null
  numero: string | null
  calle: string | null
  localidad: string | null
  areaAdministrativa1: string | null
  areaAdministrativa2: string | null
  areaAdministrativa3: string | null
  pais: string | null
  latitud: string | null
  longitud: string | null
  // phones
  telefonos: { id: number; telefono: string; descripcion: string | null }[]
}

// ─── searchPacientes ──────────────────────────────────────────────────────────

export async function searchPacientes(
  params: SearchParams,
): Promise<{ rows: PacienteRow[]; total: number }> {
  await requireSession()

  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const idPrevision = (filters.idPrevision as string | undefined)?.trim()

  const conditions: SQL[] = []
  if (buscar) {
    const normalized = buscar.replace(/[\.\-\s]/g, '').toUpperCase()
    const fullName = sql`(${patients.nombres} || ' ' || ${patients.apellidoPaterno} || ' ' || COALESCE(${patients.apellidoMaterno}, ''))`
    conditions.push(
      or(
        sql`unaccent(${fullName}) ILIKE unaccent(${'%' + buscar + '%'})`,
        ilike(patients.identificador, `%${normalized}%`),
      )!,
    )
  }
  if (idPrevision) {
    conditions.push(eq(patients.idCompaniaSeguro, Number(idPrevision)))
  }

  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ total: count() })
    .from(patients)
    .where(where)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortCols: Record<string, any> = {
    apellidoPaterno: patients.apellidoPaterno,
    nombres: patients.nombres,
    identificador: patients.identificador,
  }
  const sortCol = (sort?.key && sortCols[sort.key]) ?? patients.apellidoPaterno
  const primaryOrder = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

  const rawRows = await db
    .select({
      id: patients.id,
      nombres: patients.nombres,
      apellidoPaterno: patients.apellidoPaterno,
      apellidoMaterno: patients.apellidoMaterno,
      identificador: patients.identificador,
      tipoIdentificador: patients.tipoIdentificador,
      prevision: healthInsurances.nombre,
      comuna: addresses.areaAdministrativa3,
    })
    .from(patients)
    .leftJoin(healthInsurances, eq(patients.idCompaniaSeguro, healthInsurances.id))
    .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
    .where(where)
    .orderBy(primaryOrder, asc(patients.apellidoPaterno), asc(patients.nombres))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  // Fetch first phone for each patient
  const patientIds = rawRows.map((r) => r.id)
  const phonesMap = new Map<number, string>()
  if (patientIds.length > 0) {
    const phoneRows = await db
      .select({ idPaciente: patientPhones.idPaciente, telefono: patientPhones.telefono })
      .from(patientPhones)
      .where(inArray(patientPhones.idPaciente, patientIds))
    phoneRows.forEach((p) => {
      if (!phonesMap.has(p.idPaciente)) phonesMap.set(p.idPaciente, p.telefono)
    })
  }

  const rows: PacienteRow[] = rawRows.map((r) => ({
    ...r,
    telefono: phonesMap.get(r.id) ?? null,
  }))

  return { rows, total: Number(countRow?.total ?? 0) }
}

// ─── getPaciente ──────────────────────────────────────────────────────────────

export async function getPaciente(id: number): Promise<PacienteDetalle | null> {
  await requireSession()

  const [row] = await db
    .select({
      id: patients.id,
      identificador: patients.identificador,
      tipoIdentificador: patients.tipoIdentificador,
      nombres: patients.nombres,
      apellidoPaterno: patients.apellidoPaterno,
      apellidoMaterno: patients.apellidoMaterno,
      fechaNacimiento: patients.fechaNacimiento,
      correo: patients.correo,
      informacionAdicional: patients.informacionAdicional,
      idCompaniaSeguro: patients.idCompaniaSeguro,
      idResidenciaAdulto: patients.idResidenciaAdulto,
      // address fields
      direccion: addresses.direccion,
      direccionFormateada: addresses.direccionFormateada,
      numero: addresses.numero,
      calle: addresses.calle,
      localidad: addresses.localidad,
      areaAdministrativa1: addresses.areaAdministrativa1,
      areaAdministrativa2: addresses.areaAdministrativa2,
      areaAdministrativa3: addresses.areaAdministrativa3,
      pais: addresses.pais,
      latitud: addresses.latitud,
      longitud: addresses.longitud,
    })
    .from(patients)
    .innerJoin(addresses, eq(patients.idDireccion, addresses.id))
    .where(eq(patients.id, id))

  if (!row) return null

  const phoneRows = await db
    .select({ id: patientPhones.id, telefono: patientPhones.telefono, descripcion: patientPhones.descripcion })
    .from(patientPhones)
    .where(eq(patientPhones.idPaciente, id))

  return {
    ...row,
    direccionFormateada: row.direccionFormateada ?? null,
    telefonos: phoneRows,
  }
}

// ─── createPaciente ───────────────────────────────────────────────────────────

export async function createPaciente(
  formData: FormData,
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  await requireSession()

  // Personal fields
  const nombres = (formData.get('nombres') as string)?.trim()
  const apellidoPaterno = (formData.get('apellidoPaterno') as string)?.trim()
  const apellidoMaterno = (formData.get('apellidoMaterno') as string)?.trim() ?? ''
  const tipoIdentificador = (formData.get('tipoIdentificador') as string)?.trim() || null
  const rawIdentificador = (formData.get('identificador') as string)?.trim() || null
  const fechaNacimiento = (formData.get('fechaNacimiento') as string)?.trim() || null
  const correo = (formData.get('correo') as string)?.trim() || null
  const informacionAdicional = (formData.get('informacionAdicional') as string)?.trim() || null
  const idCompaniaSeguro = Number(formData.get('idCompaniaSeguro')) || null
  const idResidenciaAdulto = Number(formData.get('idResidenciaAdulto')) || null

  if (!nombres) return { success: false, error: 'Nombres son requeridos' }
  if (!apellidoPaterno) return { success: false, error: 'Apellido paterno es requerido' }

  let identificador: string | null = null
  let tipoId: string | null = null
  if (rawIdentificador && tipoIdentificador) {
    if (tipoIdentificador === 'rut') {
      const result = validateRut(rawIdentificador)
      if (!result.valid) return { success: false, error: 'RUT inválido' }
      identificador = result.normalized
      tipoId = 'rut'
    } else if (tipoIdentificador === 'pasaporte') {
      const result = validatePasaporte(rawIdentificador)
      if (!result.valid) return { success: false, error: 'Pasaporte inválido' }
      identificador = result.normalized
      tipoId = 'pasaporte'
    } else {
      return { success: false, error: 'Tipo de identificador no válido' }
    }
    // Validar identificador único
    const existing = await db.select().from(patients).where(eq(patients.identificador, identificador))
    if (existing.length > 0) return { success: false, error: 'Este identificador ya está registrado' }
  }

  // Address fields
  const direccion = (formData.get('direccion') as string)?.trim()
  if (!direccion) return { success: false, error: 'Dirección es requerida' }
  const direccionFormateada = (formData.get('direccionFormateada') as string)?.trim() || ''
  const numero = (formData.get('numero') as string)?.trim() || null
  const calle = (formData.get('calle') as string)?.trim() || null
  const localidad = (formData.get('localidad') as string)?.trim() || null
  const areaAdministrativa1 = (formData.get('areaAdministrativa1') as string)?.trim() || null
  const areaAdministrativa2 = (formData.get('areaAdministrativa2') as string)?.trim() || null
  const areaAdministrativa3 = (formData.get('areaAdministrativa3') as string)?.trim() || null
  const pais = (formData.get('pais') as string)?.trim() || null
  const latitud = (formData.get('latitud') as string)?.trim() || null
  const longitud = (formData.get('longitud') as string)?.trim() || null

  // Phones
  const phones: { telefono: string; descripcion: string | null }[] = []
  for (let i = 0; i < 20; i++) {
    const tel = (formData.get(`phone_${i}`) as string)?.trim()
    if (!tel) break
    const desc = (formData.get(`phone_desc_${i}`) as string)?.trim() || null
    phones.push({ telefono: tel, descripcion: desc })
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [addr] = await tx
        .insert(addresses)
        .values({
          direccion,
          direccionFormateada,
          numero,
          calle,
          localidad,
          areaAdministrativa1,
          areaAdministrativa2,
          areaAdministrativa3,
          pais,
          latitud: latitud ?? undefined,
          longitud: longitud ?? undefined,
        })
        .returning()

      const idDireccion = addr!.id

      const [patient] = await tx
        .insert(patients)
        .values({
          identificador,
          tipoIdentificador: tipoId,
          nombres,
          apellidoPaterno,
          apellidoMaterno,
          fechaNacimiento,
          correo,
          informacionAdicional,
          idDireccion,
          idCompaniaSeguro,
          idResidenciaAdulto,
        })
        .returning()

      const idPaciente = patient!.id

      if (phones.length > 0) {
        await tx.insert(patientPhones).values(phones.map((p) => ({ ...p, idPaciente })))
      }

      return idPaciente
    })

    revalidatePath('/pacientes')
    return { success: true, id: result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('identificador')) return { success: false, error: 'Este identificador ya está registrado' }
    return { success: false, error: 'Error al crear el paciente' }
  }
}

// ─── updatePaciente ───────────────────────────────────────────────────────────

export async function updatePaciente(formData: FormData): Promise<Result> {
  await requireSession()

  const id = Number(formData.get('id'))
  if (!id) return { success: false, error: 'ID inválido' }

  // Personal fields
  const nombres = (formData.get('nombres') as string)?.trim()
  const apellidoPaterno = (formData.get('apellidoPaterno') as string)?.trim()
  const apellidoMaterno = (formData.get('apellidoMaterno') as string)?.trim() ?? ''
  const tipoIdentificador = (formData.get('tipoIdentificador') as string)?.trim() || null
  const rawIdentificador = (formData.get('identificador') as string)?.trim() || null
  const fechaNacimiento = (formData.get('fechaNacimiento') as string)?.trim() || null
  const correo = (formData.get('correo') as string)?.trim() || null
  const informacionAdicional = (formData.get('informacionAdicional') as string)?.trim() || null
  const idCompaniaSeguro = Number(formData.get('idCompaniaSeguro')) || null
  const idResidenciaAdulto = Number(formData.get('idResidenciaAdulto')) || null

  if (!nombres) return { success: false, error: 'Nombres son requeridos' }
  if (!apellidoPaterno) return { success: false, error: 'Apellido paterno es requerido' }

  let identificador: string | null = null
  let tipoId: string | null = null
  if (rawIdentificador && tipoIdentificador) {
    if (tipoIdentificador === 'rut') {
      const result = validateRut(rawIdentificador)
      if (!result.valid) return { success: false, error: 'RUT inválido' }
      identificador = result.normalized
      tipoId = 'rut'
    } else if (tipoIdentificador === 'pasaporte') {
      const result = validatePasaporte(rawIdentificador)
      if (!result.valid) return { success: false, error: 'Pasaporte inválido' }
      identificador = result.normalized
      tipoId = 'pasaporte'
    } else {
      return { success: false, error: 'Tipo de identificador no válido' }
    }
    // Validar identificador único (excluyendo el paciente actual)
    const duplicated = await db
      .select()
      .from(patients)
      .where(and(eq(patients.identificador, identificador), not(eq(patients.id, id))))
    if (duplicated.length > 0) return { success: false, error: 'Este identificador ya está registrado' }
  }

  // Address fields
  const direccion = (formData.get('direccion') as string)?.trim()
  if (!direccion) return { success: false, error: 'Dirección es requerida' }
  const direccionFormateada = (formData.get('direccionFormateada') as string)?.trim() || ''
  const numero = (formData.get('numero') as string)?.trim() || null
  const calle = (formData.get('calle') as string)?.trim() || null
  const localidad = (formData.get('localidad') as string)?.trim() || null
  const areaAdministrativa1 = (formData.get('areaAdministrativa1') as string)?.trim() || null
  const areaAdministrativa2 = (formData.get('areaAdministrativa2') as string)?.trim() || null
  const areaAdministrativa3 = (formData.get('areaAdministrativa3') as string)?.trim() || null
  const pais = (formData.get('pais') as string)?.trim() || null
  const latitud = (formData.get('latitud') as string)?.trim() || null
  const longitud = (formData.get('longitud') as string)?.trim() || null

  // Phones
  const phones: { telefono: string; descripcion: string | null }[] = []
  for (let i = 0; i < 20; i++) {
    const tel = (formData.get(`phone_${i}`) as string)?.trim()
    if (!tel) break
    const desc = (formData.get(`phone_desc_${i}`) as string)?.trim() || null
    phones.push({ telefono: tel, descripcion: desc })
  }

  try {
    await db.transaction(async (tx) => {
      // Get patient to find idDireccion
      const [existingPatient] = await tx
        .select({ idDireccion: patients.idDireccion })
        .from(patients)
        .where(eq(patients.id, id))

      if (!existingPatient) throw new Error('Paciente no encontrado')

      await tx
        .update(addresses)
        .set({
          direccion,
          direccionFormateada,
          numero,
          calle,
          localidad,
          areaAdministrativa1,
          areaAdministrativa2,
          areaAdministrativa3,
          pais,
          latitud: latitud ?? undefined,
          longitud: longitud ?? undefined,
        })
        .where(eq(addresses.id, existingPatient.idDireccion))

      await tx
        .update(patients)
        .set({
          identificador,
          tipoIdentificador: tipoId,
          nombres,
          apellidoPaterno,
          apellidoMaterno,
          fechaNacimiento,
          correo,
          informacionAdicional,
          idCompaniaSeguro,
          idResidenciaAdulto,
          updatedAt: new Date(),
        })
        .where(eq(patients.id, id))

      await tx.delete(patientPhones).where(eq(patientPhones.idPaciente, id))

      if (phones.length > 0) {
        await tx.insert(patientPhones).values(phones.map((p) => ({ ...p, idPaciente: id })))
      }
    })

    revalidatePath('/pacientes')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('identificador')) return { success: false, error: 'Este identificador ya está registrado' }
    return { success: false, error: 'Error al actualizar el paciente' }
  }
}

// ─── getHistorialPaciente ─────────────────────────────────────────────────────

export type VisitaHistorialItem = {
  id: number
  fecha: string
  hora: string | null
  estado: string
  costo: number
  numeroBoleta: string
  tipoDocumento: string
  informacionAdicional: string
  enfermera: string | null
  procedimientos: { nombre: string; codigo: string; categoria: string }[]
  examenes: { nombre: string; codigo: string }[]
}

export type HistorialPaciente = {
  paciente: {
    id: number
    nombres: string
    apellidoPaterno: string | null
    apellidoMaterno: string | null
    identificador: string | null
    tipoIdentificador: string | null
    prevision: string | null
    comuna: string | null
  }
  visitas: VisitaHistorialItem[]
}

export async function getHistorialPaciente(id: number): Promise<HistorialPaciente | null> {
  await requireSession()

  const [pacienteRow] = await db
    .select({
      id: patients.id,
      nombres: patients.nombres,
      apellidoPaterno: patients.apellidoPaterno,
      apellidoMaterno: patients.apellidoMaterno,
      identificador: patients.identificador,
      tipoIdentificador: patients.tipoIdentificador,
      prevision: healthInsurances.nombre,
      comuna: addresses.areaAdministrativa3,
    })
    .from(patients)
    .leftJoin(healthInsurances, eq(patients.idCompaniaSeguro, healthInsurances.id))
    .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
    .where(eq(patients.id, id))

  if (!pacienteRow) return null

  const visitRows = await db
    .select({
      id: visits.id,
      fecha: visits.fecha,
      hora: visits.hora,
      estado: visits.estado,
      costo: visits.costo,
      numeroBoleta: visits.numeroBoleta,
      tipoDocumento: visits.tipoDocumento,
      informacionAdicional: visits.informacionAdicional,
      enfermera_nombres: nurses.nombres,
      enfermera_apellidoPaterno: nurses.apellidoPaterno,
      enfermera_apellidoMaterno: nurses.apellidoMaterno,
    })
    .from(visits)
    .leftJoin(nurses, eq(visits.idEnfermera, nurses.id))
    .where(eq(visits.idPaciente, id))
    .orderBy(desc(visits.fecha), desc(visits.hora))

  if (visitRows.length === 0) {
    return { paciente: pacienteRow, visitas: [] }
  }

  const visitIds = visitRows.map((v) => v.id)

  const [procRows, examRows] = await Promise.all([
    db
      .select({
        idVisita: visitProcedures.idVisita,
        nombre: procedures.nombre,
        codigo: procedures.codigo,
        categoria: procedures.categoria,
      })
      .from(visitProcedures)
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(inArray(visitProcedures.idVisita, visitIds)),
    db
      .select({
        idVisita: visitExams.idVisita,
        nombre: exams.nombre,
        codigo: exams.codigo,
      })
      .from(visitExams)
      .innerJoin(exams, eq(visitExams.idExamen, exams.id))
      .where(inArray(visitExams.idVisita, visitIds)),
  ])

  const procMap = new Map<number, { nombre: string; codigo: string; categoria: string }[]>()
  for (const p of procRows) {
    const arr = procMap.get(p.idVisita) ?? []
    arr.push({ nombre: p.nombre, codigo: p.codigo, categoria: p.categoria })
    procMap.set(p.idVisita, arr)
  }

  const examMap = new Map<number, { nombre: string; codigo: string }[]>()
  for (const e of examRows) {
    const arr = examMap.get(e.idVisita) ?? []
    arr.push({ nombre: e.nombre, codigo: e.codigo })
    examMap.set(e.idVisita, arr)
  }

  const visitas: VisitaHistorialItem[] = visitRows.map((v) => ({
    id: v.id,
    fecha: v.fecha,
    hora: v.hora,
    estado: v.estado,
    costo: v.costo,
    numeroBoleta: v.numeroBoleta ?? '',
    tipoDocumento: v.tipoDocumento ?? '',
    informacionAdicional: v.informacionAdicional ?? '',
    enfermera: v.enfermera_nombres
      ? formatNombre({
          nombres: v.enfermera_nombres,
          apellidoPaterno: v.enfermera_apellidoPaterno,
          apellidoMaterno: v.enfermera_apellidoMaterno,
        })
      : null,
    procedimientos: procMap.get(v.id) ?? [],
    examenes: examMap.get(v.id) ?? [],
  }))

  return { paciente: pacienteRow, visitas }
}

// ─── deletePaciente ───────────────────────────────────────────────────────────

export async function deletePaciente(id: number): Promise<Result> {
  const session = await requireSession()
  const userRole = session.user.role ?? 'usuario'

  try {
    const [countRow] = await db
      .select({ total: count() })
      .from(visits)
      .where(eq(visits.idPaciente, id))
    const total = Number(countRow?.total ?? 0)

    if (total > 0 && userRole !== 'admin') {
      return {
        success: false,
        error: `No se puede eliminar: tiene ${total} visita${total === 1 ? '' : 's'} registrada${total === 1 ? '' : 's'}`,
      }
    }

    const [existingPatient] = await db
      .select({ idDireccion: patients.idDireccion })
      .from(patients)
      .where(eq(patients.id, id))

    if (!existingPatient) return { success: false, error: 'Paciente no encontrado' }

    await db.transaction(async (tx) => {
      await tx.delete(patients).where(eq(patients.id, id))
      await tx.delete(addresses).where(eq(addresses.id, existingPatient.idDireccion))
    })

    revalidatePath('/pacientes')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al eliminar el paciente' }
  }
}

// ─── getPacientes (all for select dropdowns) ────────────────────────────────

export async function getPacientes(): Promise<{ id: number; nombres: string; apellidoPaterno: string | null; apellidoMaterno?: string | null; comuna: string | null }[]> {
  await requireSession()

  return db
    .select({
      id: patients.id,
      nombres: patients.nombres,
      apellidoPaterno: patients.apellidoPaterno,
      apellidoMaterno: patients.apellidoMaterno,
      comuna: addresses.areaAdministrativa3,
    })
    .from(patients)
    .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
    .orderBy(asc(patients.apellidoPaterno), asc(patients.nombres))
}

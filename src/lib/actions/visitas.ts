'use server'

import { db } from '@/db'
import { contactOrigins, visits, visitProcedures, visitExams, patients, nurses, branches } from '@/db/schema'
import { eq, count, and, or, ilike, gte, lte, asc, desc, SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { SearchParams, Result } from '@/components/data-table'
import { requireSession } from '@/lib/auth-guard'
import { formatEnfermeraNombre, formatPacienteNombre } from '@/lib/paciente'

// ─── getEnfermeras ────────────────────────────────────────────────────────────

export async function getEnfermeras(): Promise<{ id: number; nombre: string }[]> {
  await requireSession()

  const rows = await db
    .select({ id: nurses.id, nombres: nurses.nombres, apellidoPaterno: nurses.apellidoPaterno })
    .from(nurses)
    .where(eq(nurses.activo, true))
    .orderBy(asc(nurses.apellidoPaterno))

  return rows.map((r) => ({
    id: r.id,
    nombre: formatEnfermeraNombre(r),
  }))
}

// ─── Detail type ──────────────────────────────────────────────────────────────

export type VisitaDetalle = {
  id: number
  fecha: string
  hora: string | null
  estado: string
  costo: number
  idPaciente: number | null
  idEnfermera: number | null
  idSucursal: number | null
  numeroBoleta: string
  tipoDocumento: string
  origenContacto: string | null
  informacionAdicional: string
  procedureIds: number[]
  examIds: number[]
}

// ─── Row type ─────────────────────────────────────────────────────────────────

export type VisitaRow = {
  id: number
  activo: boolean      // false when cancelada → renders at 50% opacity
  fecha: string        // YYYY-MM-DD
  hora: string | null
  estado: string
  costo: number
  idPaciente: number | null
  paciente: string | null
  enfermera: string | null
  sucursal: string | null
}

// ─── searchVisitas ────────────────────────────────────────────────────────────

export async function searchVisitas(
  params: SearchParams,
): Promise<{ rows: VisitaRow[]; total: number }> {
  await requireSession()

  const { filters, sort, page, pageSize } = params
  const buscar = (filters.buscar as string | undefined)?.trim()
  const estado = (filters.estado as string | undefined)?.trim()
  const enfermeraId = (filters.enfermera as string | undefined)?.trim()
  const fechaInicio = (filters.fechaInicio as string | undefined)?.trim()
  const fechaFin = (filters.fechaFin as string | undefined)?.trim()

  const conditions: SQL[] = []
  if (buscar) {
    conditions.push(
      or(
        ilike(patients.nombres, `%${buscar}%`),
        ilike(patients.apellidoPaterno, `%${buscar}%`),
        ilike(patients.apellidoMaterno, `%${buscar}%`),
      )!,
    )
  }
  if (estado) conditions.push(eq(visits.estado, estado))
  if (enfermeraId) conditions.push(eq(visits.idEnfermera, Number(enfermeraId)))
  if (fechaInicio) conditions.push(gte(visits.fecha, fechaInicio))
  if (fechaFin) conditions.push(lte(visits.fecha, fechaFin))

  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ total: count() })
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .where(where)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortCols: Record<string, any> = {
    fecha: visits.fecha,
    paciente: patients.apellidoPaterno,
    estado: visits.estado,
    costo: visits.costo,
  }
  const sortCol = (sort?.key && sortCols[sort.key]) ?? visits.fecha
  const order = sort?.dir === 'asc' ? asc(sortCol) : desc(sortCol)

  const rawRows = await db
    .select({
      id: visits.id,
      fecha: visits.fecha,
      hora: visits.hora,
      estado: visits.estado,
      costo: visits.costo,
      idPaciente: visits.idPaciente,
      pacienteNombres: patients.nombres,
      pacienteApellido: patients.apellidoPaterno,
      pacienteApellidoMaterno: patients.apellidoMaterno,
      enfermeraNombres: nurses.nombres,
      enfermeraApellido: nurses.apellidoPaterno,
      enfermeraApellidoMaterno: nurses.apellidoMaterno,
      sucursal: branches.nombre,
    })
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .leftJoin(nurses, eq(visits.idEnfermera, nurses.id))
    .leftJoin(branches, eq(visits.idSucursal, branches.id))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const rows: VisitaRow[] = rawRows.map((r) => ({
    id: r.id,
    activo: r.estado !== 'cancelada',
    fecha: r.fecha,
    hora: r.hora,
    estado: r.estado,
    costo: r.costo,
    idPaciente: r.idPaciente,
    paciente: formatPacienteNombre({
      nombres: r.pacienteNombres,
      apellidoPaterno: r.pacienteApellido,
      apellidoMaterno: r.pacienteApellidoMaterno,
    }) || null,
    enfermera: formatEnfermeraNombre({
      nombres: r.enfermeraNombres,
      apellidoPaterno: r.enfermeraApellido,
      apellidoMaterno: r.enfermeraApellidoMaterno,
    }) || null,
    sucursal: r.sucursal ?? null,
  }))

  return { rows, total: Number(countRow?.total ?? 0) }
}

// ─── getVisita ────────────────────────────────────────────────────────────────

export async function getVisita(id: number): Promise<VisitaDetalle | null> {
  await requireSession()

  const [visit] = await db.select().from(visits).where(eq(visits.id, id))
  if (!visit) return null

  const [procs, exams_] = await Promise.all([
    db.select({ id: visitProcedures.idProcedimiento }).from(visitProcedures).where(eq(visitProcedures.idVisita, id)),
    db.select({ id: visitExams.idExamen }).from(visitExams).where(eq(visitExams.idVisita, id)),
  ])

  return {
    id: visit.id,
    fecha: visit.fecha,
    hora: visit.hora ?? null,
    estado: visit.estado,
    costo: visit.costo,
    idPaciente: visit.idPaciente ?? null,
    idEnfermera: visit.idEnfermera ?? null,
    idSucursal: visit.idSucursal ?? null,
    numeroBoleta: visit.numeroBoleta ?? '',
    tipoDocumento: visit.tipoDocumento ?? '',
    origenContacto: visit.origenContacto ?? null,
    informacionAdicional: visit.informacionAdicional ?? '',
    procedureIds: procs.map((p) => p.id),
    examIds: exams_.map((e) => e.id),
  }
}

// ─── deleteVisita ─────────────────────────────────────────────────────────────

export async function deleteVisita(id: number): Promise<Result> {
  await requireSession()

  try {
    await db.delete(visits).where(eq(visits.id, id))
    revalidatePath('/visitas')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al eliminar la visita' }
  }
}

// ─── searchOrigenesContacto ───────────────────────────────────────────────────

export async function searchOrigenesContacto(): Promise<{ id: number; nombre: string }[]> {
  await requireSession()

  return db
    .select({ id: contactOrigins.id, nombre: contactOrigins.nombre })
    .from(contactOrigins)
    .where(eq(contactOrigins.activo, true))
    .orderBy(asc(contactOrigins.nombre))
}

// ─── updateVisita ─────────────────────────────────────────────────────────────

export async function updateVisita(
  fd: FormData,
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  await requireSession()

  const id = Number(fd.get('id'))
  const fecha = (fd.get('fecha') as string)?.trim()

  if (!id) return { success: false, error: 'ID requerido' }
  if (!fecha) return { success: false, error: 'Fecha requerida' }

  const hora = (fd.get('hora') as string)?.trim() || null
  const estado = (fd.get('estado') as string)?.trim() || 'creada'
  const costo = Number(fd.get('costo')) || 0
  const idEnfermera = Number(fd.get('idEnfermera')) || null
  const idSucursal = Number(fd.get('idSucursal')) || null
  const numeroBoleta = (fd.get('numeroBoleta') as string)?.trim() || ''
  const tipoDocumento = (fd.get('tipoDocumento') as string)?.trim() || ''
  const origenContacto = (fd.get('origenContacto') as string)?.trim() || null
  const informacionAdicional = (fd.get('informacionAdicional') as string)?.trim() || ''

  const procedureIds = fd.getAll('procedure_ids').map(Number).filter(Boolean)
  const examIds = fd.getAll('exam_ids').map(Number).filter(Boolean)

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(visits)
        .set({ fecha, hora, estado, costo, idEnfermera, idSucursal, numeroBoleta, tipoDocumento, origenContacto, informacionAdicional })
        .where(eq(visits.id, id))

      await tx.delete(visitProcedures).where(eq(visitProcedures.idVisita, id))
      await tx.delete(visitExams).where(eq(visitExams.idVisita, id))

      if (procedureIds.length > 0) {
        await tx.insert(visitProcedures).values(
          procedureIds.map((idProcedimiento) => ({ idProcedimiento, idVisita: id })),
        )
      }
      if (examIds.length > 0) {
        await tx.insert(visitExams).values(
          examIds.map((idExamen) => ({ idExamen, idSucursal: null, idVisita: id })),
        )
      }
    })

    revalidatePath('/visitas')
    revalidatePath(`/visitas/${id}`)
    return { success: true, id }
  } catch {
    return { success: false, error: 'Error al actualizar la visita' }
  }
}

// ─── createVisita ─────────────────────────────────────────────────────────────

export async function createVisita(
  fd: FormData,
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  await requireSession()

  const idPaciente = Number(fd.get('idPaciente'))
  const fecha = (fd.get('fecha') as string)?.trim()

  if (!idPaciente) return { success: false, error: 'Paciente requerido' }
  if (!fecha) return { success: false, error: 'Fecha requerida' }

  const hora = (fd.get('hora') as string)?.trim() || null
  const estado = 'creada'
  const costo = Number(fd.get('costo')) || 0
  const idEnfermera = Number(fd.get('idEnfermera')) || null
  const idSucursal = Number(fd.get('idSucursal')) || null
  const numeroBoleta = (fd.get('numeroBoleta') as string)?.trim() || ''
  const tipoDocumento = (fd.get('tipoDocumento') as string)?.trim() || ''
  const origenContacto = (fd.get('origenContacto') as string)?.trim() || null
  const informacionAdicional = (fd.get('informacionAdicional') as string)?.trim() || ''

  const procedureIds = fd.getAll('procedure_ids').map(Number).filter(Boolean)
  const examIds = fd.getAll('exam_ids').map(Number).filter(Boolean)

  try {
    const visitId = await db.transaction(async (tx) => {
      const [visit] = await tx
        .insert(visits)
        .values({
          fecha,
          hora,
          estado,
          costo,
          idPaciente,
          idEnfermera,
          idSucursal,
          numeroBoleta,
          tipoDocumento,
          origenContacto,
          informacionAdicional,
        })
        .returning()

      const id = visit!.id

      if (procedureIds.length > 0) {
        await tx.insert(visitProcedures).values(
          procedureIds.map((idProcedimiento) => ({ idProcedimiento, idVisita: id })),
        )
      }

      if (examIds.length > 0) {
        await tx.insert(visitExams).values(
          examIds.map((idExamen) => ({ idExamen, idSucursal: null, idVisita: id })),
        )
      }

      return id
    })

    revalidatePath('/visitas')
    return { success: true, id: visitId }
  } catch {
    return { success: false, error: 'Error al crear la visita' }
  }
}

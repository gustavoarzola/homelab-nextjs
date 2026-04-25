'use server'

import { db } from '@/db'
import {
  visits, patients, addresses, branches,
  visitProcedures, visitExams, procedures, exams, nurses,
} from '@/db/schema'
import { eq, and, inArray, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth-guard'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisitaAsignacion = {
  id: number
  hora: string | null
  idEnfermera: number | null
  pacienteNombre: string
  comuna: string | null
  latitud: string | null
  longitud: string | null
  sucursal: string | null
  procedimientos: string[]
  examenes: string[]
}

export type Result = { success: boolean; error?: string }

// ─── getVisitasParaAsignacion ─────────────────────────────────────────────────

export async function getVisitasParaAsignacion(fecha: string): Promise<VisitaAsignacion[]> {
  await requireSession()

  const rawVisitas = await db
    .select({
      id: visits.id,
      hora: visits.hora,
      idEnfermera: visits.idEnfermera,
      pacienteNombres: patients.nombres,
      pacienteApellido: patients.apellidoPaterno,
      comuna: addresses.areaAdministrativa3,
      latitud: addresses.latitud,
      longitud: addresses.longitud,
      sucursal: branches.nombre,
    })
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
    .leftJoin(branches, eq(visits.idSucursal, branches.id))
    .where(and(eq(visits.fecha, fecha), eq(visits.estado, 'creada')))

  if (!rawVisitas.length) return []

  const ids = rawVisitas.map((v) => v.id)

  const [procRows, examRows] = await Promise.all([
    db
      .select({ idVisita: visitProcedures.idVisita, nombre: procedures.nombre })
      .from(visitProcedures)
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(inArray(visitProcedures.idVisita, ids)),
    db
      .select({ idVisita: visitExams.idVisita, nombre: exams.nombre })
      .from(visitExams)
      .innerJoin(exams, eq(visitExams.idExamen, exams.id))
      .where(inArray(visitExams.idVisita, ids)),
  ])

  const procsByVisita = new Map<number, string[]>()
  const examsByVisita = new Map<number, string[]>()
  for (const p of procRows) {
    const arr = procsByVisita.get(p.idVisita) ?? []
    arr.push(p.nombre)
    procsByVisita.set(p.idVisita, arr)
  }
  for (const e of examRows) {
    const arr = examsByVisita.get(e.idVisita) ?? []
    arr.push(e.nombre)
    examsByVisita.set(e.idVisita, arr)
  }

  return rawVisitas.map((v) => ({
    id: v.id,
    hora: v.hora ?? null,
    idEnfermera: v.idEnfermera ?? null,
    pacienteNombre: v.pacienteApellido
      ? `${v.pacienteApellido}, ${v.pacienteNombres}`
      : (v.pacienteNombres ?? ''),
    comuna: v.comuna ?? null,
    latitud: v.latitud ?? null,
    longitud: v.longitud ?? null,
    sucursal: v.sucursal ?? null,
    procedimientos: procsByVisita.get(v.id) ?? [],
    examenes: examsByVisita.get(v.id) ?? [],
  }))
}

// ─── getEnfermerasActivas ─────────────────────────────────────────────────────

export async function getEnfermerasActivas(): Promise<{ id: number; nombre: string }[]> {
  await requireSession()

  const rows = await db
    .select({ id: nurses.id, nombres: nurses.nombres, apellidoPaterno: nurses.apellidoPaterno })
    .from(nurses)
    .where(eq(nurses.activo, true))
    .orderBy(asc(nurses.apellidoPaterno))

  return rows.map((r) => ({
    id: r.id,
    nombre: r.apellidoPaterno ? `${r.apellidoPaterno}, ${r.nombres}` : r.nombres,
  }))
}

// ─── guardarAsignaciones ──────────────────────────────────────────────────────

export async function guardarAsignaciones(
  cambios: { idVisita: number; idEnfermera: number | null }[],
): Promise<Result> {
  await requireSession()

  if (!cambios.length) return { success: true }
  try {
    for (const { idVisita, idEnfermera } of cambios) {
      await db.update(visits).set({ idEnfermera }).where(eq(visits.id, idVisita))
    }
    revalidatePath('/asignacion')
    return { success: true }
  } catch (err) {
    console.error('guardarAsignaciones failed', err)
    return { success: false, error: 'Error al guardar asignaciones' }
  }
}

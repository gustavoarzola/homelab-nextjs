import { randomUUID } from 'crypto'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { visitFiles, patientFiles, visits, patients } from '@/db/schema'
import { moveR2Object } from '@/lib/r2'
import { buildArchivoKey, extFromKeyOrType, type ArchivoTipo } from './nombres'

export type ArchivoRow = { id: number; key: string; contentType: string | null }
export type RenameMove = { id: number; from: string; to: string }

/**
 * Dada la lista de filas (ya ordenada por `orden`) y la key esperada de cada
 * una (mismo índice), devuelve los movimientos pendientes. Función pura.
 */
export function planRenames(rows: ArchivoRow[], expectedKeys: string[]): RenameMove[] {
  const moves: RenameMove[] = []
  rows.forEach((row, i) => {
    const to = expectedKeys[i]
    if (to && row.key !== to) moves.push({ id: row.id, from: row.key, to })
  })
  return moves
}

/**
 * Aplica los renombrados en dos fases para evitar colisiones: al borrar el
 * archivo 1 de 3, el 2 pasa a ser el 1 y su key esperada es la que otra fila
 * viva todavía ocupa. Primero todo va a `tmp/`, luego a su destino final.
 */
async function applyRenames(
  moves: RenameMove[],
  updateRowKey: (id: number, key: string) => Promise<void>,
): Promise<void> {
  if (moves.length === 0) return
  const staged = moves.map((m) => ({
    ...m,
    tmp: `tmp/${randomUUID()}.${extFromKeyOrType(m.to)}`,
  }))
  for (const m of staged) await moveR2Object(m.from, m.tmp)
  for (const m of staged) {
    await moveR2Object(m.tmp, m.to)
    await updateRowKey(m.id, m.to)
  }
}

type EntidadNombre = { nombres: string; apellidoPaterno: string | null }

async function syncArchivos(
  tipo: ArchivoTipo,
  entidadId: number,
  entidad: EntidadNombre | null,
  rows: ArchivoRow[],
  updateRowKey: (id: number, key: string) => Promise<void>,
): Promise<void> {
  if (!entidad || rows.length === 0) return
  const expectedKeys = rows.map((row, i) =>
    buildArchivoKey({
      tipo,
      entidadId,
      nombres: entidad.nombres,
      apellidoPaterno: entidad.apellidoPaterno,
      orden: i + 1,
      ext: extFromKeyOrType(row.key, row.contentType),
    }),
  )
  await applyRenames(planRenames(rows, expectedKeys), updateRowKey)
}

/** Deja los objetos de R2 de la visita con la key legible `visitas/v{id}_…`. Correr fuera de la transacción de DB. */
export async function syncArchivosVisita(idVisita: number): Promise<void> {
  const [visita] = await db
    .select({ nombres: patients.nombres, apellidoPaterno: patients.apellidoPaterno })
    .from(visits)
    .innerJoin(patients, eq(visits.idPaciente, patients.id))
    .where(eq(visits.id, idVisita))

  const rows = await db
    .select({ id: visitFiles.id, key: visitFiles.key, contentType: visitFiles.contentType })
    .from(visitFiles)
    .where(eq(visitFiles.idVisita, idVisita))
    .orderBy(asc(visitFiles.orden), asc(visitFiles.id))

  await syncArchivos('visita', idVisita, visita ?? null, rows, async (id, key) => {
    await db.update(visitFiles).set({ key, updatedAt: new Date() }).where(eq(visitFiles.id, id))
  })
}

/** Deja los objetos de R2 del paciente con la key legible `pacientes/p{id}_…`. Correr fuera de la transacción de DB. */
export async function syncArchivosPaciente(idPaciente: number): Promise<void> {
  const [paciente] = await db
    .select({ nombres: patients.nombres, apellidoPaterno: patients.apellidoPaterno })
    .from(patients)
    .where(eq(patients.id, idPaciente))

  const rows = await db
    .select({ id: patientFiles.id, key: patientFiles.key, contentType: patientFiles.contentType })
    .from(patientFiles)
    .where(eq(patientFiles.idPaciente, idPaciente))
    .orderBy(asc(patientFiles.orden), asc(patientFiles.id))

  await syncArchivos('paciente', idPaciente, paciente ?? null, rows, async (id, key) => {
    await db.update(patientFiles).set({ key, updatedAt: new Date() }).where(eq(patientFiles.id, id))
  })
}

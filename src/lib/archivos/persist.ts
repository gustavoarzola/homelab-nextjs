import { eq, inArray } from 'drizzle-orm'
import { visitFiles, patientFiles } from '@/db/schema'
import type { ArchivoItemInput } from '@/lib/validation'
import type { ArchivoTipo } from './nombres'

// El tipo exacto de la transacción de Drizzle es engorroso de nombrar; se acepta
// `any` igual que `PricingDb` en `src/lib/pricing/visitas.ts` (deuda técnica #1).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any

/**
 * Reconcilia las filas de archivos de una entidad contra el payload del formulario:
 * - borra las filas cuya key ya no viene en el payload
 * - inserta las keys nuevas (siempre `tmp/…`)
 * - reordena según la posición en el payload
 *
 * Devuelve las keys de R2 que quedaron huérfanas (borrar tras el commit con
 * `deleteManyFromR2`). El renombrado a la key definitiva lo hace `syncArchivos*`.
 */
export async function reconcileArchivos(args: {
  tx: Tx
  tipo: ArchivoTipo
  entidadId: number
  incoming: ArchivoItemInput[]
}): Promise<string[]> {
  const { tx, tipo, entidadId, incoming } = args

  const existing: { id: number; key: string }[] =
    tipo === 'visita'
      ? await tx
          .select({ id: visitFiles.id, key: visitFiles.key })
          .from(visitFiles)
          .where(eq(visitFiles.idVisita, entidadId))
      : await tx
          .select({ id: patientFiles.id, key: patientFiles.key })
          .from(patientFiles)
          .where(eq(patientFiles.idPaciente, entidadId))

  const incomingKeys = new Set(incoming.map((i) => i.key))
  const toDelete = existing.filter((row) => !incomingKeys.has(row.key))
  const orphaned = toDelete.map((row) => row.key)

  if (toDelete.length > 0) {
    const ids = toDelete.map((row) => row.id)
    if (tipo === 'visita') {
      await tx.delete(visitFiles).where(inArray(visitFiles.id, ids))
    } else {
      await tx.delete(patientFiles).where(inArray(patientFiles.id, ids))
    }
  }

  const existingByKey = new Map(existing.map((row) => [row.key, row.id]))

  for (const [i, item] of incoming.entries()) {
    const orden = i + 1
    const existingId = existingByKey.get(item.key)

    if (existingId === undefined) {
      if (tipo === 'visita') {
        await tx.insert(visitFiles).values({
          idVisita: entidadId,
          key: item.key,
          nombreOriginal: item.nombreOriginal,
          contentType: item.contentType,
          tamano: item.tamano,
          orden,
        })
      } else {
        await tx.insert(patientFiles).values({
          idPaciente: entidadId,
          key: item.key,
          nombreOriginal: item.nombreOriginal,
          contentType: item.contentType,
          tamano: item.tamano,
          orden,
        })
      }
    } else if (tipo === 'visita') {
      await tx
        .update(visitFiles)
        .set({ orden, updatedAt: new Date() })
        .where(eq(visitFiles.id, existingId))
    } else {
      await tx
        .update(patientFiles)
        .set({ orden, updatedAt: new Date() })
        .where(eq(patientFiles.id, existingId))
    }
  }

  return orphaned
}

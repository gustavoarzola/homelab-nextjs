// ─── Renombrado one-off de archivos en R2 ────────────────────────────────────
//
//   pnpm archivos:renombrar
//
// Recorre `archivos_visitas` y `archivos_pacientes` y aplica `syncArchivos*` a
// cada entidad, dejando los objetos de R2 con la key legible
// (`visitas/v123_gustavo_arzola_1.jpg`). Idempotente: si la key ya está en la
// convención no se toca nada. Correr una vez por entorno tras el deploy.

import { db } from '@/db'
import { visitFiles, patientFiles } from '@/db/schema'
import { syncArchivosVisita, syncArchivosPaciente } from '@/lib/archivos/sync'

async function main() {
  const visitaIds = (await db.selectDistinct({ id: visitFiles.idVisita }).from(visitFiles)).map((r) => r.id)
  const pacienteIds = (await db.selectDistinct({ id: patientFiles.idPaciente }).from(patientFiles)).map((r) => r.id)

  console.log(`Visitas con archivos: ${visitaIds.length} · Pacientes con archivos: ${pacienteIds.length}`)

  let ok = 0
  let fail = 0

  for (const id of visitaIds) {
    try {
      await syncArchivosVisita(id)
      ok++
    } catch (err) {
      fail++
      console.error(`  visita ${id} FALLÓ:`, err instanceof Error ? err.message : err)
    }
  }

  for (const id of pacienteIds) {
    try {
      await syncArchivosPaciente(id)
      ok++
    } catch (err) {
      fail++
      console.error(`  paciente ${id} FALLÓ:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`Listo. ${ok} entidades sincronizadas, ${fail} con error.`)
  process.exit(fail > 0 ? 1 : 0)
}

main()

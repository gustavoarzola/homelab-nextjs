'use server'

import { db } from '@/db'
import { visits, visitExams, visitIsapreExams, visitExamResults, exams } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth-guard'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExamenResultadoItem = {
  idExamen: number
  nombre: string
  codigo: string
  grupoExamen: string
  tipo: 'estandar' | 'isapre'
  enviado: boolean
  fechaEnvio: string | null
}

export type VisitaResultadosDetalle = {
  idVisita: number
  enviados: number
  total: number
  items: ExamenResultadoItem[]
}

// ─── getResultadosVisita ──────────────────────────────────────────────────────

export async function getResultadosVisita(
  idVisita: number,
): Promise<VisitaResultadosDetalle | null> {
  await requireSession()

  const [visit] = await db
    .select({ id: visits.id, enviados: visits.resultadosEnviadosCount, total: visits.resultadosTotalCount })
    .from(visits)
    .where(eq(visits.id, idVisita))

  if (!visit) return null

  const [standardRows, isapreRows, resultRows] = await Promise.all([
    db.select({ idExamen: visitExams.idExamen }).from(visitExams).where(eq(visitExams.idVisita, idVisita)),
    db.select({ idExamen: visitIsapreExams.idExamen }).from(visitIsapreExams).where(eq(visitIsapreExams.idVisita, idVisita)),
    db.select({ idExamen: visitExamResults.idExamen, enviado: visitExamResults.enviado, fechaEnvio: visitExamResults.fechaEnvio })
      .from(visitExamResults)
      .where(eq(visitExamResults.idVisita, idVisita)),
  ])

  const allExamIds = [
    ...standardRows.map((r) => r.idExamen),
    ...isapreRows.map((r) => r.idExamen),
  ]
  const uniqueExamIds = [...new Set(allExamIds)]

  const examMeta = uniqueExamIds.length > 0
    ? await db
        .select({ id: exams.id, nombre: exams.nombre, codigo: exams.codigo, grupoExamen: exams.grupoExamen })
        .from(exams)
        .where(inArray(exams.id, uniqueExamIds))
    : []

  const metaMap = new Map(examMeta.map((e) => [e.id, e]))
  const resultMap = new Map(resultRows.map((r) => [r.idExamen, r]))
  const standardSet = new Set(standardRows.map((r) => r.idExamen))

  const seenIds = new Set<number>()
  const items: ExamenResultadoItem[] = []

  for (const { idExamen } of [...standardRows, ...isapreRows]) {
    if (seenIds.has(idExamen)) continue
    seenIds.add(idExamen)
    const meta = metaMap.get(idExamen)
    if (!meta) continue
    const result = resultMap.get(idExamen)
    items.push({
      idExamen,
      nombre: meta.nombre,
      codigo: meta.codigo,
      grupoExamen: meta.grupoExamen,
      tipo: standardSet.has(idExamen) ? 'estandar' : 'isapre',
      enviado: result?.enviado ?? false,
      fechaEnvio: result?.fechaEnvio ?? null,
    })
  }

  return { idVisita, enviados: visit.enviados, total: visit.total, items }
}

// ─── guardarResultadosVisita ──────────────────────────────────────────────────

export async function guardarResultadosVisita(
  fd: FormData,
): Promise<{ success: true; enviados: number; total: number } | { success: false; error: string }> {
  await requireSession()

  const idVisita = Number(fd.get('idVisita'))
  const itemCount = Number(fd.get('itemCount'))

  if (!idVisita || isNaN(idVisita)) return { success: false, error: 'ID de visita inválido' }

  const items: { idExamen: number; enviado: boolean; fechaEnvio: string | null }[] = []
  for (let i = 0; i < itemCount; i++) {
    const idExamen = Number(fd.get(`item_idExamen_${i}`))
    const enviado = fd.get(`item_enviado_${i}`) === 'true'
    const fechaEnvioRaw = fd.get(`item_fechaEnvio_${i}`) as string | null
    const fechaEnvio = fechaEnvioRaw && fechaEnvioRaw.trim() !== '' ? fechaEnvioRaw.trim() : null
    if (idExamen > 0) items.push({ idExamen, enviado, fechaEnvio })
  }

  try {
    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .insert(visitExamResults)
          .values({
            idVisita,
            idExamen: item.idExamen,
            enviado: item.enviado,
            fechaEnvio: item.fechaEnvio,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [visitExamResults.idVisita, visitExamResults.idExamen],
            set: {
              enviado: item.enviado,
              fechaEnvio: item.fechaEnvio,
              updatedAt: new Date(),
            },
          })
      }

      const total = items.length
      const enviados = items.filter((i) => i.enviado).length
      await tx
        .update(visits)
        .set({ resultadosEnviadosCount: enviados, resultadosTotalCount: total, updatedAt: new Date() })
        .where(eq(visits.id, idVisita))
    })

    const enviados = items.filter((i) => i.enviado).length

    revalidatePath('/visitas')
    revalidatePath(`/visitas/${idVisita}`)
    revalidatePath(`/visitas/${idVisita}/resultados`)

    return { success: true, enviados, total: items.length }
  } catch (err) {
    console.error('[guardarResultadosVisita]', err)
    return { success: false, error: 'Error al guardar los resultados' }
  }
}

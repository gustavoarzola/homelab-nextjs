import { and, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm'
import { patients, visits } from '@/db/schema'
import type { SearchParams } from '@/components/data-table'

/**
 * WHERE compartido por el listado de visitas, sus exports y los reportes
 * (`/api/visitas/export`, `/api/reportes/*`). Filtros: `buscar` (nombre/RUT del
 * paciente — requiere join a `pacientes`), `estado` y `enfermera` (listas
 * separadas por coma), `fechaInicio`/`fechaFin` (YYYY-MM-DD, inclusivos).
 */
export function buildVisitasWhere(filters: SearchParams['filters']): SQL | undefined {
  const buscar = (filters.buscar as string | undefined)?.trim()
  const estado = (filters.estado as string | undefined)?.trim()
  const enfermeraId = (filters.enfermera as string | undefined)?.trim()
  const fechaInicio = (filters.fechaInicio as string | undefined)?.trim()
  const fechaFin = (filters.fechaFin as string | undefined)?.trim()

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
  if (estado) {
    const estados = estado.split(',').map((e) => e.trim()).filter(Boolean)
    conditions.push(estados.length > 1 ? inArray(visits.estado, estados) : eq(visits.estado, estados[0]!))
  }
  if (enfermeraId) {
    const enfermeraIds = enfermeraId.split(',').map((e) => Number(e.trim())).filter(Boolean)
    conditions.push(enfermeraIds.length > 1 ? inArray(visits.idEnfermera, enfermeraIds) : eq(visits.idEnfermera, enfermeraIds[0]!))
  }
  if (fechaInicio) conditions.push(gte(visits.fecha, fechaInicio))
  if (fechaFin) conditions.push(lte(visits.fecha, fechaFin))

  return conditions.length ? and(...conditions) : undefined
}

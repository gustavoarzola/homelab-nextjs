import { and, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm'
import { patients } from '@/db/schema'
import { escapeLike, normalizeIdentificador, searchTokens } from '@/lib/search'

/**
 * Condiciones SQL de búsqueda por palabras (ver `src/lib/search.ts`): cada palabra de la
 * consulta debe matchear (AND), en cualquier orden. `tokenCondition` recibe el patrón ILIKE
 * ya escapado (`%palabra%`) y la palabra original, y devuelve la condición para esa palabra
 * (típicamente un OR entre columnas). Devuelve `undefined` si la consulta no tiene palabras.
 */
export function allTokensMatch(
  query: string,
  tokenCondition: (pattern: string, token: string) => SQL | undefined,
): SQL | undefined {
  const conditions = searchTokens(query)
    .map((token) => tokenCondition(`%${escapeLike(token)}%`, token))
    .filter((c): c is SQL => c !== undefined)
  return conditions.length ? and(...conditions) : undefined
}

/** Texto ILIKE sin acentos. Usa `f_unaccent` (inmutable, migración 0001) para que el índice GIN aplique. */
export function unaccentIlike(expr: SQLWrapper, pattern: string): SQL {
  return sql`f_unaccent(${expr}) ILIKE f_unaccent(${pattern})`
}

/**
 * Nombre completo del paciente. Debe ser **la misma expresión** que el índice
 * `pacientes_nombre_trgm_idx` (migración 0001) para que Postgres lo use.
 */
const patientFullName = sql`(${patients.nombres} || ' ' || ${patients.apellidoPaterno} || ' ' || COALESCE(${patients.apellidoMaterno}, ''))`

/**
 * Condición de búsqueda de paciente por nombre o RUT, en orden libre:
 * "maria gonzalez", "gonzalez perez maria", "gonz mar" o "12.345.678-5".
 * `extra` permite sumar columnas por palabra (p.ej. destinatario de una cotización).
 */
export function patientSearchCondition(
  query: string,
  extra?: (pattern: string) => SQL[],
): SQL | undefined {
  const byTokens = allTokensMatch(query, (pattern, token) => {
    const rut = normalizeIdentificador(token)
    return or(
      unaccentIlike(patientFullName, pattern),
      rut ? sql`${patients.identificador} ILIKE ${`%${escapeLike(rut)}%`}` : undefined,
      ...(extra?.(pattern) ?? []),
    )
  })
  if (!byTokens) return undefined

  // RUT escrito con espacios ("12 345 678-5") se parte en varias palabras: se prueba también entero.
  const rutCompleto = normalizeIdentificador(query)
  return rutCompleto
    ? or(byTokens, sql`${patients.identificador} ILIKE ${`%${escapeLike(rutCompleto)}%`}`)
    : byTokens
}

/**
 * Búsqueda de texto "natural": la consulta se parte en palabras y **cada palabra**
 * debe aparecer en el texto, en cualquier orden y sin importar acentos ni mayúsculas.
 * Así "maria gonzalez", "gonzalez maria" o "gonz mar" encuentran a
 * "González Pérez, María José", que con un substring contiguo solo se encontraba
 * escribiendo los nombres en el orden exacto en que se concatenan.
 *
 * Este módulo es puro (sin BD) para poder usarse también en el cliente
 * (`SelectCombobox`). La versión SQL vive en `src/lib/search-sql.ts`.
 */

/** Minúsculas y sin acentos (NFD + quitar diacríticos). */
export function normalizeSearchText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Parte la consulta en palabras: separa por espacios y comas (el listado muestra
 * "Paterno Materno, Nombres", así que la coma no debe ser parte de la palabra),
 * descarta vacías y duplicadas. No normaliza acentos: eso lo hace quien compara.
 */
export function searchTokens(query: string): string[] {
  const tokens = query
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  return [...new Set(tokens)]
}

/** `true` si todas las palabras de `query` aparecen en alguno de los `texts`. */
export function matchesAllTokens(query: string, ...texts: (string | null | undefined)[]): boolean {
  const tokens = searchTokens(normalizeSearchText(query))
  if (tokens.length === 0) return true
  const haystack = normalizeSearchText(texts.filter(Boolean).join(' '))
  return tokens.every((t) => haystack.includes(t))
}

/** Escapa `%`, `_` y `\` para usar un texto literal dentro de un patrón LIKE/ILIKE. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Normaliza un RUT/identificador escrito por el usuario: sin puntos, guiones ni espacios, en mayúsculas. */
export function normalizeIdentificador(s: string): string {
  return s.replace(/[.\-\s]/g, '').toUpperCase()
}

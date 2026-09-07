/**
 * Quita los diacríticos de una cadena: 'Ñuñoa' → 'Nunoa', 'José' → 'Jose'.
 * Base compartida para normalización de texto (comunas) y slugs de nombre de archivo.
 */
export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Slug apto para nombre de archivo: sin acentos, minúsculas, solo `[a-z0-9]`,
 * separador `-`. Devuelve `''` si no queda ningún carácter válido.
 */
export function slugify(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

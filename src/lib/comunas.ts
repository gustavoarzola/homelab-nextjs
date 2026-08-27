/**
 * Normaliza un nombre de comuna para comparación case/acento-insensible
 * (minúsculas + sin diacríticos + espacios colapsados). Usar siempre que se
 * compare texto libre (p.ej. `direcciones.area_administrativa_3`, tomado de
 * Google Maps) contra el catálogo `comunas` — misma lógica que
 * `lower(f_unaccent(...))` en SQL (ver `src/db/migrations/0017_comunas_catalogo_backfill.sql`).
 */
export function normalizeComuna(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacríticos combinantes (tildes, etc.)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

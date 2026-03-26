/** Formatea una fecha almacenada como YYYY-MM-DD → DD-MM-YYYY */
export function formatDate(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}-${m}-${y}`
}

/** Formatea fecha + hora opcional → "DD-MM-YYYY" o "DD-MM-YYYY HH:MM" */
export function formatDateTime(fecha: string, hora: string | null): string {
  const base = formatDate(fecha)
  return hora ? `${base} ${hora.slice(0, 5)}` : base
}

/**
 * Parsea un string YYYY-MM-DD como fecha local (no UTC).
 *
 * `new Date('2026-03-24')` se interpreta como UTC midnight, que en Chile
 * (UTC−3/−4) cae el día anterior. Esta función crea la fecha en zona local
 * evitando ese desplazamiento.
 */
export function parseDateLocal(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DIAS = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
]

/** Formatea YYYY-MM-DD → "24 de marzo de 2026" */
export function formatDateLong(fecha: string): string {
  const d = parseDateLocal(fecha)
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

/** Formatea YYYY-MM-DD → "lunes 24 de marzo de 2026" */
export function formatDateFull(fecha: string): string {
  const d = parseDateLocal(fecha)
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

/** Devuelve la fecha de hoy en zona America/Santiago como YYYY-MM-DD */
export function todaySantiago(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
}

import { stripDiacritics } from '@/lib/slug'

// Dirección del paciente — dos columnas con roles distintos:
//   - `direccion`: lo que se muestra a personas (correo a enfermeras, cotizaciones, formularios).
//     Por defecto es la dirección de Google; si el operador activa "Agregar dirección para la
//     enfermera" (o se activa sola porque Google no trajo el número), es su texto libre.
//   - `direccionFormateada`: respuesta de Google Maps, para geolocalizar.

type DireccionTexto = {
  direccion?: string | null
  direccionFormateada?: string | null
}

type DireccionGeo = DireccionTexto & {
  latitud?: string | number | null
  longitud?: string | number | null
  comuna?: string | null
}

export const DIRECCION_MAX_LENGTH = 200

/** Texto de dirección para mostrar a personas: prioriza lo escrito por el operador. */
export function direccionParaMostrar(a: DireccionTexto): string {
  return a.direccion?.trim() || a.direccionFormateada?.trim() || ''
}

/**
 * Link a Google Maps. Usa coordenadas si existen (evita que "depto 45" confunda la
 * búsqueda); si no, la dirección de Google y, en último caso, el texto del operador.
 */
export function direccionMapsUrl(a: DireccionGeo): string | null {
  const lat = a.latitud != null ? Number(a.latitud) : NaN
  const lng = a.longitud != null ? Number(a.longitud) : NaN
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  const texto = a.direccionFormateada?.trim()
    || [a.direccion?.trim(), a.comuna?.trim()].filter(Boolean).join(', ')
  return texto ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}` : null
}

/** Agrega la comuna al final si el texto no la menciona ya (case/acento-insensible). */
export function direccionConComuna(texto: string, comuna?: string | null): string {
  const c = comuna?.trim()
  if (!c) return texto
  if (!texto) return c
  const norm = (s: string) => stripDiacritics(s).toLowerCase()
  return norm(texto).includes(norm(c)) ? texto : `${texto}, ${c}`
}

type DireccionComponentes = {
  calle?: string | null
  numero?: string | null
  areaAdministrativa3?: string | null // comuna
  direccionFormateada?: string | null
}

/**
 * Versión corta para pre-llenar "Dirección para la enfermera": `calle numero, comuna`, sin código
 * postal, región ni país. `cursor` indica dónde dejar el cursor: tras la calle si falta el número
 * (el operador solo tipea el número), o al final para agregar depto/referencias.
 */
export function direccionCorta(a: DireccionComponentes): { texto: string; cursor: number } {
  const calle = a.calle?.trim()
  if (!calle) {
    const texto = a.direccionFormateada?.trim() ?? ''
    return { texto, cursor: texto.length }
  }
  const numero = a.numero?.trim()
  const comuna = a.areaAdministrativa3?.trim()
  if (numero) {
    const texto = direccionConComuna(`${calle} ${numero}`, comuna)
    return { texto, cursor: texto.length }
  }
  const base = `${calle} `
  return { texto: comuna ? `${base}, ${comuna}` : base, cursor: base.length }
}

/** Limpia el texto final: espacios extra y " ," que queda si no se completó el número. */
export function normalizarDireccion(texto: string): string {
  return texto.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim()
}

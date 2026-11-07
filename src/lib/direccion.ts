import { stripDiacritics } from '@/lib/slug'

// Dirección del paciente — dos fuentes con roles distintos:
//   - `direccion`: texto que escribe el operador (con número, depto, casa, referencias).
//     Es lo que se muestra a personas: correo a enfermeras, cotizaciones, formularios.
//   - `direccionFormateada`: respuesta de Google Maps. Solo para geolocalizar.

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

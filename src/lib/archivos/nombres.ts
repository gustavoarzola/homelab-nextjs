import { slugify } from '@/lib/slug'

export type ArchivoTipo = 'visita' | 'paciente'

type BuildKeyArgs = {
  tipo: ArchivoTipo
  entidadId: number // idVisita o idPaciente
  nombres: string // paciente.nombres (para una visita: el de su paciente)
  apellidoPaterno: string | null
  orden: number // 1-based
  ext: string // 'jpg' | 'pdf' | derivada de la key existente
}

/**
 * Key física en R2 con nombre legible:
 *   visitas/v123_gustavo_arzola_1.jpg
 *   pacientes/p456_gustavo_arzola_1.jpg
 * Se usa solo el primer nombre y el apellido paterno.
 */
export function buildArchivoKey(a: BuildKeyArgs): string {
  const folder = a.tipo === 'visita' ? 'visitas' : 'pacientes'
  const prefix = a.tipo === 'visita' ? 'v' : 'p'
  const primerNombre = slugify(a.nombres.trim().split(/\s+/)[0] ?? '') || 'x'
  const apellido = slugify(a.apellidoPaterno ?? '') || 'x'
  return `${folder}/${prefix}${a.entidadId}_${primerNombre}_${apellido}_${a.orden}.${a.ext}`
}

/** Extensión a partir de una key (`…/x.jpg` → `jpg`) o del content-type; default `jpg`. */
export function extFromKeyOrType(key: string, contentType?: string | null): string {
  const dot = key.lastIndexOf('.')
  if (dot !== -1 && dot > key.lastIndexOf('/')) {
    return key.slice(dot + 1).toLowerCase()
  }
  if (contentType === 'application/pdf') return 'pdf'
  return 'jpg'
}

/** Último segmento de una key: `visitas/v1_juan_perez_1.jpg` → `v1_juan_perez_1.jpg`. */
export function basename(key: string): string {
  return key.split('/').pop() ?? key
}

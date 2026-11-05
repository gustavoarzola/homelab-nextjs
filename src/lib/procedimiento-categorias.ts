// `procedimientos.categoria` es varchar libre (sin enum en DB). Esta lista es la que
// ofrece el catálogo y la que usa el estado de resultados para agrupar.
export const PROCEDIMIENTO_CATEGORIAS = [
  'curaciones',
  'vacunas',
  'endovenosos',
  'inyectables',
  'sondas',
  'ecg',
  'otros',
] as const

export type ProcedimientoCategoria = typeof PROCEDIMIENTO_CATEGORIAS[number]

export const PROCEDIMIENTO_CATEGORIA_LABELS: Record<ProcedimientoCategoria, string> = {
  curaciones: 'Curaciones',
  vacunas: 'Vacunas',
  endovenosos: 'Endovenosos',
  inyectables: 'Inyectables',
  sondas: 'Sondas',
  ecg: 'Electrocardiograma (ECG)',
  otros: 'Otros procedimientos',
}

export function procedimientoCategoriaLabel(categoria: string): string {
  return PROCEDIMIENTO_CATEGORIA_LABELS[categoria as ProcedimientoCategoria] ?? categoria
}

export const PROCEDIMIENTO_CATEGORIA_OPTIONS = PROCEDIMIENTO_CATEGORIAS.map((value) => ({
  value,
  label: PROCEDIMIENTO_CATEGORIA_LABELS[value],
}))

// Dominio cerrado de categorías de previsión de salud.
// La columna `categoria` en `companias_seguros` es varchar libre (sin enum en DB),
// pero en la práctica solo existen estos 3 valores — se fijan aquí para no depender
// de un SELECT DISTINCT sobre datos existentes (que falla con la tabla vacía).
export const PREVISION_CATEGORIAS = ['fonasa', 'isapre', 'particular'] as const
export type PrevisionCategoria = (typeof PREVISION_CATEGORIAS)[number]

export const PREVISION_CATEGORIA_LABELS: Record<PrevisionCategoria, string> = {
  fonasa: 'Fonasa',
  isapre: 'Isapre',
  particular: 'Particular',
}

export const PREVISION_CATEGORIA_OPTIONS = PREVISION_CATEGORIAS.map((value) => ({
  value,
  label: PREVISION_CATEGORIA_LABELS[value],
}))

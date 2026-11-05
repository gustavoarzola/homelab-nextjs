// Categorías de `gastos_mensuales.categoria` (varchar libre en DB). Cada una cae en un
// bloque del estado de resultados:
//   costo_directo      → existe porque hubo visitas; baja el margen de contribución.
//   gasto_operacional  → estructura; existe aunque no haya visitas.
export const GASTO_CATEGORIAS = [
  'costo_laboratorio',
  'costo_insumos',
  'costo_otro',
  'personal',
  'marketing',
  'administracion',
  'otros',
] as const

export type GastoCategoria = typeof GASTO_CATEGORIAS[number]
export type GastoBloque = 'costo_directo' | 'gasto_operacional'

export const GASTO_CATEGORIA_META: Record<GastoCategoria, { label: string; bloque: GastoBloque }> = {
  costo_laboratorio: { label: 'Laboratorios', bloque: 'costo_directo' },
  costo_insumos: { label: 'Insumos y materiales', bloque: 'costo_directo' },
  costo_otro: { label: 'Otros costos directos', bloque: 'costo_directo' },
  personal: { label: 'Personal administrativo', bloque: 'gasto_operacional' },
  marketing: { label: 'Marketing', bloque: 'gasto_operacional' },
  administracion: { label: 'Administración', bloque: 'gasto_operacional' },
  otros: { label: 'Otros gastos', bloque: 'gasto_operacional' },
}

export const GASTO_CATEGORIA_OPTIONS = GASTO_CATEGORIAS.map((value) => ({
  value,
  label: `${GASTO_CATEGORIA_META[value].bloque === 'costo_directo' ? 'Costo directo' : 'Gasto operacional'} · ${GASTO_CATEGORIA_META[value].label}`,
}))

export function isGastoCategoria(value: string): value is GastoCategoria {
  return (GASTO_CATEGORIAS as readonly string[]).includes(value)
}

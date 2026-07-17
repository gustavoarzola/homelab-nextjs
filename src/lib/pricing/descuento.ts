export type DescuentoTipo = 'monto' | 'porcentaje'

export function resolverMontoDescuento(
  costoOriginal: number,
  tipo: DescuentoTipo,
  valor: number,
): number {
  const valorSaneado = Math.max(0, valor)
  const bruto = tipo === 'porcentaje'
    ? Math.round((costoOriginal * Math.min(valorSaneado, 100)) / 100)
    : valorSaneado
  return Math.min(bruto, costoOriginal)
}

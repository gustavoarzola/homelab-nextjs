import { describe, expect, it } from 'vitest'
import { resolverMontoDescuento } from '../descuento'

describe('resolverMontoDescuento', () => {
  it('monto fijo menor al original se aplica tal cual', () => {
    expect(resolverMontoDescuento(30000, 'monto', 5000)).toBe(5000)
  })

  it('monto fijo mayor al original se capea al original', () => {
    expect(resolverMontoDescuento(30000, 'monto', 999999)).toBe(30000)
  })

  it('porcentaje normal se calcula sobre el original', () => {
    expect(resolverMontoDescuento(30000, 'porcentaje', 20)).toBe(6000)
  })

  it('porcentaje mayor a 100 se capea a 100%', () => {
    expect(resolverMontoDescuento(30000, 'porcentaje', 150)).toBe(30000)
  })

  it('valores negativos se tratan como cero', () => {
    expect(resolverMontoDescuento(30000, 'monto', -1000)).toBe(0)
    expect(resolverMontoDescuento(30000, 'porcentaje', -10)).toBe(0)
  })

  it('costo original cero nunca produce descuento positivo', () => {
    expect(resolverMontoDescuento(0, 'monto', 5000)).toBe(0)
    expect(resolverMontoDescuento(0, 'porcentaje', 50)).toBe(0)
  })
})

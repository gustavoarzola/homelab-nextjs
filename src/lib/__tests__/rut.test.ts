import { describe, expect, it } from 'vitest'
import { formatIdentificador, formatRut } from '@/lib/rut'

describe('formatRut', () => {
  it('formatea un RUT almacenado (sin puntos ni guion)', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5')
    expect(formatRut('12345678K')).toBe('12.345.678-K')
    expect(formatRut('9876543K')).toBe('9.876.543-K')
  })

  it('devuelve el valor tal cual si no calza el formato esperado', () => {
    expect(formatRut('12.345.678-5')).toBe('12.345.678-5')
    expect(formatRut('')).toBe('')
  })
})

describe('formatIdentificador', () => {
  it('formatea RUT con puntos y guion', () => {
    expect(formatIdentificador('rut', '123456785')).toBe('12.345.678-5')
  })

  it('prefija los pasaportes', () => {
    expect(formatIdentificador('pasaporte', 'ABC12345')).toBe('Pasaporte ABC12345')
  })

  it('devuelve el valor tal cual para tipos desconocidos', () => {
    expect(formatIdentificador(null, 'X-99')).toBe('X-99')
  })

  it('devuelve string vacío sin valor', () => {
    expect(formatIdentificador('rut', null)).toBe('')
    expect(formatIdentificador('rut', '')).toBe('')
  })
})

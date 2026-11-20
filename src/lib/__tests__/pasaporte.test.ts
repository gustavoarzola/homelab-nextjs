import { describe, it, expect } from 'vitest'
import { validatePasaporte } from '@/lib/rut'

describe('validatePasaporte', () => {
  it.each([
    ['1234567', '1234567'], // Bolivia
    ['123456789', '123456789'], // Perú / Venezuela
    ['AAA123456', 'AAA123456'], // Argentina
    ['rd1234567', 'RD1234567'], // Haití, en minúsculas
    ['AB 123 456', 'AB123456'],
    ['12-345-678', '12345678'],
    [' F12345678 ', 'F12345678'],
  ])('acepta %s', (raw, normalized) => {
    expect(validatePasaporte(raw)).toEqual({ valid: true, normalized })
  })

  it.each(['', '12345', 'AB#12345', 'Ñ1234567', 'A'.repeat(21)])('rechaza %s', (raw) => {
    expect(validatePasaporte(raw)).toEqual({ valid: false })
  })
})

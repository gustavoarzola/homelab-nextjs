import { describe, expect, it } from 'vitest'
import { normalizeComuna } from '@/lib/comunas'

describe('normalizeComuna', () => {
  it('quita tildes', () => {
    expect(normalizeComuna('Ñuñoa')).toBe('nunoa')
    expect(normalizeComuna('Peñalolén')).toBe('penalolen')
  })

  it('normaliza a minúsculas', () => {
    expect(normalizeComuna('SANTIAGO')).toBe('santiago')
  })

  it('colapsa espacios y recorta extremos', () => {
    expect(normalizeComuna('  San   Miguel  ')).toBe('san miguel')
  })

  it('produce el mismo resultado para variantes equivalentes', () => {
    expect(normalizeComuna('Estación Central')).toBe(normalizeComuna('estacion central'))
    expect(normalizeComuna('San José de Maipo')).toBe(normalizeComuna('SAN JOSE DE MAIPO'))
  })
})

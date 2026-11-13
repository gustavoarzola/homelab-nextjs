import { describe, expect, it } from 'vitest'
import { escapeLike, matchesAllTokens, normalizeIdentificador, normalizeSearchText, searchTokens } from '@/lib/search'

describe('searchTokens', () => {
  it('separa por espacios y comas, sin vacíos ni duplicados', () => {
    expect(searchTokens('  González Pérez,  María  maría ')).toEqual(['González', 'Pérez', 'María', 'maría'])
    expect(searchTokens('gonzalez, maria')).toEqual(['gonzalez', 'maria'])
    expect(searchTokens('a a')).toEqual(['a'])
    expect(searchTokens('   ')).toEqual([])
  })
})

describe('normalizeSearchText', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizeSearchText('Muñoz ÁLVAREZ, José')).toBe('munoz alvarez, jose')
  })
})

describe('matchesAllTokens', () => {
  const label = 'González Pérez, María José'

  it('encuentra con las palabras en cualquier orden', () => {
    expect(matchesAllTokens('maria gonzalez', label)).toBe(true)
    expect(matchesAllTokens('gonzalez perez maria', label)).toBe(true)
    expect(matchesAllTokens('jose perez', label)).toBe(true)
    expect(matchesAllTokens('González Pérez, María', label)).toBe(true)
  })

  it('acepta prefijos/fragmentos y es insensible a acentos y mayúsculas', () => {
    expect(matchesAllTokens('GONZ mar', label)).toBe(true)
    expect(matchesAllTokens('perez', label)).toBe(true)
  })

  it('exige todas las palabras', () => {
    expect(matchesAllTokens('maria soto', label)).toBe(false)
  })

  it('busca también en textos adicionales (p.ej. código)', () => {
    expect(matchesAllTokens('glucosa 0302', 'Glucosa en ayunas', '0302047')).toBe(true)
    expect(matchesAllTokens('glucosa', 'Glucosa en ayunas', null)).toBe(true)
  })

  it('consulta vacía matchea todo', () => {
    expect(matchesAllTokens('  ', label)).toBe(true)
  })
})

describe('escapeLike', () => {
  it('escapa comodines de LIKE', () => {
    expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b')
  })
})

describe('normalizeIdentificador', () => {
  it('quita puntos, guiones y espacios', () => {
    expect(normalizeIdentificador('12.345.678-k')).toBe('12345678K')
    expect(normalizeIdentificador('12 345 678-5')).toBe('123456785')
  })
})

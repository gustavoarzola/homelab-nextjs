import { describe, expect, it } from 'vitest'
import { stripDiacritics, slugify } from '@/lib/slug'

describe('stripDiacritics', () => {
  it('quita tildes, diéresis y la virgulilla de la ñ', () => {
    expect(stripDiacritics('José María')).toBe('Jose Maria')
    expect(stripDiacritics('Ñuñoa')).toBe('Nunoa')
    expect(stripDiacritics('Peñalolén')).toBe('Penalolen')
  })
})

describe('slugify', () => {
  it('minúsculas, sin acentos, solo [a-z0-9]', () => {
    expect(slugify('José')).toBe('jose')
    expect(slugify('Ñuñoa')).toBe('nunoa')
    expect(slugify('María José')).toBe('maria-jose')
    expect(slugify("O'Brien")).toBe('o-brien')
    expect(slugify('  Juan  Pablo  ')).toBe('juan-pablo')
  })

  it('devuelve string vacío si no queda nada', () => {
    expect(slugify('   ')).toBe('')
    expect(slugify('***')).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { direccionConComuna, direccionCorta, direccionMapsUrl, direccionParaMostrar, normalizarDireccion } from '@/lib/direccion'

describe('direccionParaMostrar', () => {
  it('prioriza el texto del operador', () => {
    expect(direccionParaMostrar({
      direccion: 'Av. Grecia 1234, depto 45',
      direccionFormateada: 'Av. Grecia, Ñuñoa, Chile',
    })).toBe('Av. Grecia 1234, depto 45')
  })

  it('cae a la dirección de Google si no hay texto del operador', () => {
    expect(direccionParaMostrar({ direccion: '  ', direccionFormateada: 'Av. Grecia, Ñuñoa' }))
      .toBe('Av. Grecia, Ñuñoa')
    expect(direccionParaMostrar({ direccion: null, direccionFormateada: null })).toBe('')
  })
})

describe('direccionMapsUrl', () => {
  it('usa coordenadas cuando existen', () => {
    expect(direccionMapsUrl({ direccion: 'X 1, depto 2', latitud: '-33.45', longitud: '-70.6' }))
      .toBe('https://www.google.com/maps/search/?api=1&query=-33.45,-70.6')
  })

  it('sin coordenadas usa la dirección de Google', () => {
    expect(direccionMapsUrl({ direccion: 'X 1, depto 2', direccionFormateada: 'X 1, Ñuñoa' }))
      .toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('X 1, Ñuñoa')}`)
  })

  it('en último caso usa texto del operador + comuna', () => {
    expect(direccionMapsUrl({ direccion: 'X 1', comuna: 'Ñuñoa', latitud: '', longitud: null }))
      .toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('X 1, Ñuñoa')}`)
  })

  it('devuelve null si no hay nada', () => {
    expect(direccionMapsUrl({})).toBeNull()
  })
})

describe('direccionConComuna', () => {
  it('agrega la comuna si no está', () => {
    expect(direccionConComuna('X 1, depto 2', 'Ñuñoa')).toBe('X 1, depto 2, Ñuñoa')
  })
  it('no duplica la comuna (acento-insensible)', () => {
    expect(direccionConComuna('X 1, Nunoa, Chile', 'Ñuñoa')).toBe('X 1, Nunoa, Chile')
  })
  it('maneja vacíos', () => {
    expect(direccionConComuna('', 'Ñuñoa')).toBe('Ñuñoa')
    expect(direccionConComuna('X 1', null)).toBe('X 1')
  })
})

describe('direccionCorta', () => {
  it('con número: calle número, comuna y cursor al final', () => {
    const r = direccionCorta({ calle: 'Av. Grecia', numero: '1234', areaAdministrativa3: 'Ñuñoa' })
    expect(r).toEqual({ texto: 'Av. Grecia 1234, Ñuñoa', cursor: 'Av. Grecia 1234, Ñuñoa'.length })
  })
  it('sin número: deja el hueco y el cursor tras la calle', () => {
    const r = direccionCorta({ calle: 'Av. Grecia', numero: '', areaAdministrativa3: 'Ñuñoa' })
    expect(r).toEqual({ texto: 'Av. Grecia , Ñuñoa', cursor: 'Av. Grecia '.length })
  })
  it('sin calle: usa la dirección de Google', () => {
    expect(direccionCorta({ direccionFormateada: 'Lo Barnechea, Chile' }))
      .toEqual({ texto: 'Lo Barnechea, Chile', cursor: 19 })
  })
})

describe('normalizarDireccion', () => {
  it('quita espacio antes de coma y espacios dobles', () => {
    expect(normalizarDireccion(' Av. Grecia , Ñuñoa ')).toBe('Av. Grecia, Ñuñoa')
    expect(normalizarDireccion('Av. Grecia  1234,  depto 45')).toBe('Av. Grecia 1234, depto 45')
  })
})

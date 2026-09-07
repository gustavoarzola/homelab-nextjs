import { describe, expect, it } from 'vitest'
import { buildArchivoKey, extFromKeyOrType, basename } from '@/lib/archivos/nombres'

describe('buildArchivoKey', () => {
  it('visita: prefijo v, folder visitas, primer nombre + apellido paterno', () => {
    expect(
      buildArchivoKey({
        tipo: 'visita',
        entidadId: 123,
        nombres: 'Gustavo Andrés',
        apellidoPaterno: 'Arzola',
        orden: 1,
        ext: 'jpg',
      }),
    ).toBe('visitas/v123_gustavo_arzola_1.jpg')
  })

  it('paciente: prefijo p, folder pacientes', () => {
    expect(
      buildArchivoKey({
        tipo: 'paciente',
        entidadId: 456,
        nombres: 'María',
        apellidoPaterno: 'Pérez',
        orden: 3,
        ext: 'pdf',
      }),
    ).toBe('pacientes/p456_maria_perez_3.pdf')
  })

  it('usa "x" cuando falta nombre o apellido', () => {
    expect(
      buildArchivoKey({ tipo: 'visita', entidadId: 1, nombres: '  ', apellidoPaterno: null, orden: 1, ext: 'jpg' }),
    ).toBe('visitas/v1_x_x_1.jpg')
  })

  it('normaliza acentos y caracteres raros', () => {
    expect(
      buildArchivoKey({ tipo: 'visita', entidadId: 9, nombres: 'Ñico', apellidoPaterno: "O'Higgins", orden: 2, ext: 'jpg' }),
    ).toBe('visitas/v9_nico_o-higgins_2.jpg')
  })
})

describe('extFromKeyOrType', () => {
  it('saca la extensión de la key', () => {
    expect(extFromKeyOrType('tmp/abc.PNG')).toBe('png')
    expect(extFromKeyOrType('visitas/v1_a_b_1.jpg')).toBe('jpg')
  })
  it('cae al content-type y luego a jpg', () => {
    expect(extFromKeyOrType('tmp/sinpunto', 'application/pdf')).toBe('pdf')
    expect(extFromKeyOrType('tmp/sinpunto', 'image/jpeg')).toBe('jpg')
    expect(extFromKeyOrType('tmp/sinpunto')).toBe('jpg')
  })
})

describe('basename', () => {
  it('devuelve el último segmento', () => {
    expect(basename('visitas/v1_ana_perez_1.jpg')).toBe('v1_ana_perez_1.jpg')
    expect(basename('sinbarras.jpg')).toBe('sinbarras.jpg')
  })
})

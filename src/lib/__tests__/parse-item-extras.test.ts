import { describe, it, expect } from 'vitest'
import { parseItemExtras } from '../validation'

function fdOf(entries: [string, string][]): FormData {
  const fd = new FormData()
  for (const [k, v] of entries) fd.append(k, v)
  return fd
}

describe('parseItemExtras', () => {
  it('devuelve vacío sin campos', () => {
    const r = parseItemExtras(new FormData(), {})
    expect(r).toEqual({
      procedimientoDescuentos: {},
      tallerPrecios: {},
      isapreExams: [],
      isaprePrevisionId: null,
    })
  })

  it('descuento ausente es null, "0" es 0 y negativos se acotan a 0', () => {
    const fd = fdOf([['procedimiento_descuento_2', '0'], ['procedimiento_descuento_3', '-500'], ['procedimiento_descuento_4', 'abc']])
    const r = parseItemExtras(fd, { procedureIds: [1, 2, 3, 4] })
    expect(r.procedimientoDescuentos).toEqual({ 1: null, 2: 0, 3: 0, 4: 0 })
  })

  it('numberParser distingue Number de parseInt en decimales', () => {
    const fd = fdOf([['taller_precio_1', '1500.7'], ['procedimiento_descuento_1', '300.9']])
    const num = parseItemExtras(fd, { tallerIds: [1], procedureIds: [1] })
    expect(num.tallerPrecios[1]).toBe(1500.7)
    expect(num.procedimientoDescuentos[1]).toBe(300.9)
    const int = parseItemExtras(fd, { tallerIds: [1], procedureIds: [1] }, { numberParser: 'int' })
    expect(int.tallerPrecios[1]).toBe(1500)
    expect(int.procedimientoDescuentos[1]).toBe(300)
  })

  it('precio de taller faltante o inválido es 0', () => {
    const fd = fdOf([['taller_precio_2', 'x']])
    for (const numberParser of ['number', 'int'] as const) {
      const r = parseItemExtras(fd, { tallerIds: [1, 2] }, { numberParser })
      expect(r.tallerPrecios).toEqual({ 1: 0, 2: 0 })
    }
  })

  it('parsea exámenes isapre con previsión compartida e ignora ids inválidos', () => {
    const fd = fdOf([
      ['isapre_exam_ids', '10'],
      ['isapre_exam_ids', '0'],
      ['isapre_exam_ids', '11'],
      ['isapre_prevision_id', '5'],
      ['isapre_exam_valor_10', '8000'],
      ['isapre_exam_valor_pagar_10', '3000'],
      ['isapre_exam_valor_11', 'zz'],
    ])
    const r = parseItemExtras(fd, {})
    expect(r.isaprePrevisionId).toBe(5)
    expect(r.isapreExams).toEqual([
      { idExamen: 10, valorCompleto: 8000, valorPagar: 3000, idPrevision: 5 },
      { idExamen: 11, valorCompleto: 0, valorPagar: 0, idPrevision: 5 },
    ])
  })

  it('previsión vacía es null', () => {
    const r = parseItemExtras(fdOf([['isapre_prevision_id', ''], ['isapre_exam_ids', '1']]), {})
    expect(r.isaprePrevisionId).toBeNull()
    expect(r.isapreExams[0]!.idPrevision).toBeNull()
  })
})

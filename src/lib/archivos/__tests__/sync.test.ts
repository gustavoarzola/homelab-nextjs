import { describe, expect, it } from 'vitest'
import { planRenames, type ArchivoRow } from '@/lib/archivos/sync'

const rows = (...keys: string[]): ArchivoRow[] =>
  keys.map((key, i) => ({ id: i + 1, key, contentType: 'image/jpeg' }))

describe('planRenames', () => {
  it('sin cambios cuando las keys ya coinciden', () => {
    const r = rows('visitas/v1_a_b_1.jpg', 'visitas/v1_a_b_2.jpg')
    expect(planRenames(r, ['visitas/v1_a_b_1.jpg', 'visitas/v1_a_b_2.jpg'])).toEqual([])
  })

  it('renombra keys UUID heredadas', () => {
    const r = rows('visitas/uuid-1.jpg', 'visitas/uuid-2.jpg')
    expect(planRenames(r, ['visitas/v1_a_b_1.jpg', 'visitas/v1_a_b_2.jpg'])).toEqual([
      { id: 1, from: 'visitas/uuid-1.jpg', to: 'visitas/v1_a_b_1.jpg' },
      { id: 2, from: 'visitas/uuid-2.jpg', to: 'visitas/v1_a_b_2.jpg' },
    ])
  })

  it('al borrar el primero de tres, los siguientes se corren (colisión de keys)', () => {
    // Tras borrar el archivo 1, quedan las filas que eran 2 y 3, ahora orden 1 y 2
    const r = rows('visitas/v1_a_b_2.jpg', 'visitas/v1_a_b_3.jpg')
    expect(planRenames(r, ['visitas/v1_a_b_1.jpg', 'visitas/v1_a_b_2.jpg'])).toEqual([
      { id: 1, from: 'visitas/v1_a_b_2.jpg', to: 'visitas/v1_a_b_1.jpg' },
      { id: 2, from: 'visitas/v1_a_b_3.jpg', to: 'visitas/v1_a_b_2.jpg' },
    ])
  })

  it('reordenamiento completo mueve todas las filas', () => {
    const r = rows('visitas/v1_a_b_1.jpg', 'visitas/v1_a_b_2.jpg')
    // el usuario invirtió el orden: la fila 1 ahora va al final
    const moves = planRenames(r, ['visitas/v1_a_b_2.jpg', 'visitas/v1_a_b_1.jpg'])
    expect(moves).toHaveLength(2)
  })
})

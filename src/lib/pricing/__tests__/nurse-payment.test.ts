import { describe, expect, it } from 'vitest'
import { calcNursePayment, calcNursePaymentBase } from '../nurse-payment'

describe('calcNursePaymentBase', () => {
  it('excluye exámenes, talleres y monto de insumos del costo total', () => {
    const costo = 100000
    const examSum = 20000
    const workshopSum = 10000
    const insumosSum = 5000

    const base = calcNursePaymentBase(costo, examSum, workshopSum, insumosSum)

    expect(base).toBe(65000)
  })

  it('el monto de insumos no cambia el pago a la enfermera', () => {
    const examSum = 20000
    const workshopSum = 10000
    const porcentaje = 67.5

    const baseSinInsumos = calcNursePaymentBase(100000, examSum, workshopSum, 0)
    const baseConInsumos = calcNursePaymentBase(105000, examSum, workshopSum, 5000)

    expect(baseConInsumos).toBe(baseSinInsumos)
    expect(calcNursePayment(baseConInsumos, porcentaje)).toBe(calcNursePayment(baseSinInsumos, porcentaje))
  })
})

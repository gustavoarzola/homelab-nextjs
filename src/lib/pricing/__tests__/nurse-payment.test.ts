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

  it('cuando el descuento no afecta el pago, la base se calcula sobre el valor original (revierte el descuento)', () => {
    const examSum = 0
    const workshopSum = 0
    const insumosSum = 0

    // Visita sin descuento: costo = 100000 (feeVisita original)
    const baseSinDescuento = calcNursePaymentBase(100000, examSum, workshopSum, insumosSum)

    // Visita idéntica con 20% de descuento aplicado (costo ya neto = 80000),
    // pero descuentoAfectaPagoEnfermera = false → debe reconstituir la base original
    const baseConDescuentoNoAfecta = calcNursePaymentBase(80000, examSum, workshopSum, insumosSum, 20000, false)

    expect(baseConDescuentoNoAfecta).toBe(baseSinDescuento)
  })

  it('cuando el descuento afecta el pago, la base se calcula sobre el valor ya descontado', () => {
    const base = calcNursePaymentBase(80000, 0, 0, 0, 20000, true)
    expect(base).toBe(80000)
  })
})

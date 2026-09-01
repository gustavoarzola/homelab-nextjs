import { describe, expect, it } from 'vitest'
import { calcNursePayment, calcNursePaymentBase, calcNursePaymentBreakdown } from '../nurse-payment'

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

describe('calcNursePaymentBreakdown', () => {
  // Fixture del plan: fee 30000 con 10% de descuento que SÍ afecta; procedimiento
  // 12000 (bruto) con 2000 de descuento que NO afecta; recargo 6000.
  const input = {
    procSum: 12000,
    surchargeSum: 6000,
    montoVisitaOriginal: 30000,
    montoDescuento: 3000,
    descuentoAfectaPagoEnfermera: true,
    montoDescuentoProcedimientos: 2000,
    descuentoProcedimientosAfectaPagoEnfermera: false,
    porcentaje: 67.5,
  }

  it('la base es fee (neto de su descuento) + procedimientos (neto del suyo) + recargos', () => {
    const bd = calcNursePaymentBreakdown(input)

    expect(bd.base).toBe(45000) // (30000 - 3000) + 12000 + 6000
    expect(bd.pago).toBe(30375) // round(45000 * 0.675)
  })

  it('las líneas del desglose siempre suman la base', () => {
    const bd = calcNursePaymentBreakdown(input)
    expect(bd.feeVisita - bd.descuentoVisita + bd.procedimientos - bd.descuentoProcedimientos + bd.recargos).toBe(bd.base)
  })

  it('solo expone el descuento que efectivamente baja el pago', () => {
    const bd = calcNursePaymentBreakdown(input)

    expect(bd.feeVisita).toBe(30000)
    expect(bd.descuentoVisita).toBe(3000) // afecta → se muestra
    expect(bd.procedimientos).toBe(12000)
    expect(bd.descuentoProcedimientos).toBe(0) // no afecta → 0
  })

  it('cuando el descuento de procedimientos afecta, se descuenta de la base', () => {
    const bd = calcNursePaymentBreakdown({ ...input, descuentoProcedimientosAfectaPagoEnfermera: true })
    expect(bd.descuentoProcedimientos).toBe(2000)
    expect(bd.base).toBe(43000) // 27000 + (12000 - 2000) + 6000
  })
})

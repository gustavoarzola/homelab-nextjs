import { describe, expect, it } from 'vitest'
import { calcularCostoVisitaPreview } from '../visita-preview'

const pricingContext = {
  examPrices: [
    { idExamen: 10, precioActual: 8000 },
    { idExamen: 11, precioActual: 12000 },
  ],
  nursingVisitPrice: 30000,
}

describe('calcularCostoVisitaPreview', () => {
  it('suma procedimientos y exámenes sin visita de enfermería', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [1],
      selectedExamIds: [10],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [{ id: 1, precio: 15000 }],
      pricingContext,
      cobraVisita: false,
    })

    expect(costo.total).toBe(23000)
    expect(costo.costoVisitaEnfermeria).toBe(0)
  })

  it('agrega visita de enfermería cuando solo hay exámenes', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [],
      selectedExamIds: [10, 11],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [],
      pricingContext,
      cobraVisita: true,
    })

    expect(costo.total).toBe(50000)
    expect(costo.costoVisitaEnfermeria).toBe(30000)
  })

  it('usa cero si aplica visita de enfermería pero no hay precio configurado', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [],
      selectedExamIds: [10],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [],
      pricingContext: { examPrices: [{ idExamen: 10, precioActual: 8000 }], nursingVisitPrice: null },
      cobraVisita: true,
    })

    expect(costo.total).toBe(8000)
    expect(costo.precioVisitaConfigurado).toBe(false)
  })

  it('prefiere snapshots existentes sobre precios vigentes', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [1],
      selectedExamIds: [10],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [{ id: 1, precio: 15000 }],
      savedProcedurePrices: [{ idProcedimiento: 1, precio: 10000 }],
      savedExamPrices: [{ idExamen: 10, precio: 5000 }],
      pricingContext,
      cobraVisita: false,
    })

    expect(costo.total).toBe(15000)
  })

  it('visita sin ítems totaliza cero', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [],
      selectedExamIds: [],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [],
      pricingContext,
      cobraVisita: false,
    })

    expect(costo.total).toBe(0)
  })

  it('aplica recargo al total', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [1],
      selectedExamIds: [10],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [{ id: 1, precio: 15000 }],
      pricingContext,
      cobraVisita: false,
      surchargeItems: [{ precio: 5000 }],
    })

    expect(costo.total).toBe(28000)
    expect(costo.subtotalRecargos).toBe(5000)
  })

  it('suma el monto de insumos al total', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [1],
      selectedExamIds: [10],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [{ id: 1, precio: 15000 }],
      pricingContext,
      cobraVisita: false,
      montoInsumos: 3000,
    })

    expect(costo.total).toBe(26000)
    expect(costo.montoInsumos).toBe(3000)
  })

  it('sin monto de insumos, este es cero por defecto', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [],
      selectedExamIds: [],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [],
      pricingContext,
      cobraVisita: false,
    })

    expect(costo.montoInsumos).toBe(0)
  })

  it('aplica descuento porcentual solo sobre la visita de enfermería', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [1],
      selectedExamIds: [10],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [{ id: 1, precio: 15000 }],
      pricingContext,
      cobraVisita: true,
      descuentoTipo: 'porcentaje',
      descuentoValor: 20,
    })

    // costoVisitaEnfermeriaOriginal = 30000, descuento 20% = 6000, neto = 24000
    expect(costo.costoVisitaEnfermeriaOriginal).toBe(30000)
    expect(costo.montoDescuento).toBe(6000)
    expect(costo.costoVisitaEnfermeria).toBe(24000)
    expect(costo.total).toBe(15000 + 8000 + 24000)
  })

  it('aplica descuento de monto fijo, sin afectar procedimientos ni exámenes', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [1],
      selectedExamIds: [10],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [{ id: 1, precio: 15000 }],
      pricingContext,
      cobraVisita: true,
      descuentoTipo: 'monto',
      descuentoValor: 5000,
    })

    expect(costo.montoDescuento).toBe(5000)
    expect(costo.costoVisitaEnfermeria).toBe(25000)
    expect(costo.subtotalProcedimientos).toBe(15000)
    expect(costo.subtotalExamenes).toBe(8000)
  })

  it('capea el descuento de monto fijo para que no supere el valor original', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [],
      selectedExamIds: [],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [],
      pricingContext,
      cobraVisita: true,
      descuentoTipo: 'monto',
      descuentoValor: 999999,
    })

    expect(costo.montoDescuento).toBe(30000)
    expect(costo.costoVisitaEnfermeria).toBe(0)
  })

  it('sin cobrar visita, el descuento configurado no tiene efecto', () => {
    const costo = calcularCostoVisitaPreview({
      selectedProcedureIds: [],
      selectedExamIds: [],
      selectedTallerIds: [],
      tallerPriceMap: {},
      catalogProcedurePrices: [],
      pricingContext,
      cobraVisita: false,
      descuentoTipo: 'porcentaje',
      descuentoValor: 50,
    })

    expect(costo.montoDescuento).toBe(0)
    expect(costo.costoVisitaEnfermeria).toBe(0)
  })
})

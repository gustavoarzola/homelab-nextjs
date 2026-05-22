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
})

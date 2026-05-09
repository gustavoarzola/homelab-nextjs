export type VisitaFormPricingContext = {
  examPrices: { idExamen: number; precioActual: number }[]
  nursingVisitPrice: number | null
}

export type VisitaPreviewInput = {
  selectedProcedureIds: number[]
  selectedExamIds: number[]
  catalogProcedurePrices: { id: number; precio: number }[]
  savedProcedurePrices?: { idProcedimiento: number; precio: number }[]
  savedExamPrices?: { idExamen: number; precio: number }[]
  pricingContext: VisitaFormPricingContext
}

export type VisitaPreviewCosto = {
  subtotalProcedimientos: number
  subtotalExamenes: number
  costoVisitaEnfermeria: number
  total: number
  aplicaVisitaEnfermeria: boolean
  precioVisitaConfigurado: boolean
}

export function calcularCostoVisitaPreview(input: VisitaPreviewInput): VisitaPreviewCosto {
  const catalogProcedurePriceMap = new Map(
    input.catalogProcedurePrices.map((p) => [p.id, p.precio]),
  )
  const savedProcedurePriceMap = new Map(
    (input.savedProcedurePrices ?? []).map((p) => [p.idProcedimiento, p.precio]),
  )
  const savedExamPriceMap = new Map(
    (input.savedExamPrices ?? []).map((e) => [e.idExamen, e.precio]),
  )
  const currentExamPriceMap = new Map(
    input.pricingContext.examPrices.map((e) => [e.idExamen, e.precioActual]),
  )

  const subtotalProcedimientos = input.selectedProcedureIds.reduce(
    (sum, idProcedimiento) =>
      sum + (savedProcedurePriceMap.get(idProcedimiento) ?? catalogProcedurePriceMap.get(idProcedimiento) ?? 0),
    0,
  )
  const subtotalExamenes = input.selectedExamIds.reduce(
    (sum, idExamen) => sum + (savedExamPriceMap.get(idExamen) ?? currentExamPriceMap.get(idExamen) ?? 0),
    0,
  )
  const aplicaVisitaEnfermeria =
    input.selectedProcedureIds.length === 0 && input.selectedExamIds.length > 0
  const precioVisitaConfigurado = input.pricingContext.nursingVisitPrice !== null
  const costoVisitaEnfermeria =
    aplicaVisitaEnfermeria && precioVisitaConfigurado
      ? input.pricingContext.nursingVisitPrice!
      : 0

  return {
    subtotalProcedimientos,
    subtotalExamenes,
    costoVisitaEnfermeria,
    total: subtotalProcedimientos + subtotalExamenes + costoVisitaEnfermeria,
    aplicaVisitaEnfermeria,
    precioVisitaConfigurado,
  }
}

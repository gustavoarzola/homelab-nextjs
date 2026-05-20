export type VisitaFormPricingContext = {
  examPrices: { idExamen: number; precioActual: number }[]
  nursingVisitPrice: number | null
}

export type VisitaPreviewInput = {
  selectedProcedureIds: number[]
  selectedExamIds: number[]
  selectedTallerIds: number[]
  tallerPriceMap: Record<number, string>
  catalogProcedurePrices: { id: number; precio: number }[]
  savedProcedurePrices?: { idProcedimiento: number; precio: number }[]
  savedExamPrices?: { idExamen: number; precio: number }[]
  pricingContext: VisitaFormPricingContext
  cobraVisita: boolean
  montoRecargo?: number
}

export type VisitaPreviewCosto = {
  subtotalProcedimientos: number
  subtotalExamenes: number
  subtotalTalleres: number
  costoVisitaEnfermeria: number
  montoRecargo: number
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
  const subtotalTalleres = input.selectedTallerIds.reduce(
    (sum, idTaller) => sum + (parseInt(input.tallerPriceMap[idTaller] ?? '0') || 0),
    0,
  )
  const aplicaVisitaEnfermeria = input.cobraVisita
  const precioVisitaConfigurado = input.pricingContext.nursingVisitPrice !== null
  const costoVisitaEnfermeria =
    aplicaVisitaEnfermeria && precioVisitaConfigurado
      ? input.pricingContext.nursingVisitPrice!
      : 0
  const montoRecargo = input.montoRecargo ?? 0

  return {
    subtotalProcedimientos,
    subtotalExamenes,
    subtotalTalleres,
    costoVisitaEnfermeria,
    montoRecargo,
    total: subtotalProcedimientos + subtotalExamenes + subtotalTalleres + costoVisitaEnfermeria + montoRecargo,
    aplicaVisitaEnfermeria,
    precioVisitaConfigurado,
  }
}

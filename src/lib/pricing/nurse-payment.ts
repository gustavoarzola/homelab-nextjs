// Base de pago a la enfermera.
//
// EXCLUYE del costo total de la visita: exámenes (regulares E isapre — el
// `valor_pagar` de los exámenes isapre también va al laboratorio, no a la
// enfermera), talleres y monto de insumos.
// INCLUYE: fee de visita + procedimientos + recargos.
//
// Si un descuento (de la visita de enfermería o de procedimientos) no debe
// afectar el pago de la enfermera, se revierte sumando de vuelta el monto
// descontado — el `costo` ya viene neto de ese descuento.

/** Porcentaje de pago por defecto (espejo de `nurses.porcentajePago` default en el schema). */
export const DEFAULT_PORCENTAJE_PAGO = 67.5

export function calcNursePaymentBase(
  costo: number,
  /** Exámenes regulares (`examenes_visitas.precio`) + isapre (`examenes_isapre_visitas.valor_pagar`). */
  examSum: number,
  workshopSum: number,
  insumosSum: number,
  montoDescuento: number = 0,
  descuentoAfectaPagoEnfermera: boolean = false,
): number {
  const ajusteDescuento = descuentoAfectaPagoEnfermera ? 0 : montoDescuento
  return costo - examSum - workshopSum - insumosSum + ajusteDescuento
}

export function calcNursePayment(base: number, porcentaje: number): number {
  return Math.round((base * porcentaje) / 100)
}

// ─── Desglose por visita ──────────────────────────────────────────────────────

export type NursePaymentConceptsInput = {
  /** Σ `procedimientos_visitas.precio` (bruto, sin descuento). */
  procSum: number
  surchargeSum: number
  /** `visits.montoVisitaOriginal` — fee de visita antes de su descuento. */
  montoVisitaOriginal: number
  /** `visits.montoDescuento` — descuento resuelto sobre el fee de visita. */
  montoDescuento: number
  descuentoAfectaPagoEnfermera: boolean
  /** `visits.montoDescuentoProcedimientos` — suma de descuentos por procedimiento. */
  montoDescuentoProcedimientos: number
  descuentoProcedimientosAfectaPagoEnfermera: boolean
}

export type NursePaymentConcepts = {
  /** Fee de visita bruto reconocido a la enfermera (`montoVisitaOriginal`). */
  feeVisita: number
  /** Descuento de visita que efectivamente le baja el pago (>0 solo si afecta). */
  descuentoVisita: number
  /** Procedimientos brutos. */
  procedimientos: number
  /** Descuento de procedimientos que efectivamente le baja el pago (>0 solo si afecta). */
  descuentoProcedimientos: number
  recargos: number
  base: number
}

export type NursePaymentBreakdown = NursePaymentConcepts & {
  porcentaje: number
  pago: number
}

/**
 * Conceptos que componen el pago a la enfermera para una visita. Único lugar
 * donde se resuelve el par revertir-descuento / derivar-base.
 *
 * La base se arma sumando sus componentes (fee + procedimientos + recargos, cada
 * uno neto solo del descuento que le afecta) para que las líneas del desglose
 * siempre sumen el total. Es algebraicamente idéntica a
 * `calcNursePaymentBase(costo, examSum, workshopSum, insumosSum, revert)` cuando
 * `costo` viene de `computeCostoVisita()` (siempre, en producción).
 */
export function calcNursePaymentConcepts(i: NursePaymentConceptsInput): NursePaymentConcepts {
  const descuentoVisita = i.descuentoAfectaPagoEnfermera ? i.montoDescuento : 0
  const descuentoProcedimientos = i.descuentoProcedimientosAfectaPagoEnfermera ? i.montoDescuentoProcedimientos : 0
  const base =
    (i.montoVisitaOriginal - descuentoVisita)
    + (i.procSum - descuentoProcedimientos)
    + i.surchargeSum
  return {
    feeVisita: i.montoVisitaOriginal,
    descuentoVisita,
    procedimientos: i.procSum,
    descuentoProcedimientos,
    recargos: i.surchargeSum,
    base,
  }
}

/**
 * Desglose completo con el monto final a pagar (`base × porcentaje`). Lo consume
 * la página `/pagos-enfermeras` y el reporte Excel. El correo de programación usa
 * solo `calcNursePaymentConcepts` — no muestra el monto final.
 */
export function calcNursePaymentBreakdown(
  i: NursePaymentConceptsInput & { porcentaje: number },
): NursePaymentBreakdown {
  const concepts = calcNursePaymentConcepts(i)
  return {
    ...concepts,
    porcentaje: i.porcentaje,
    pago: calcNursePayment(concepts.base, i.porcentaje),
  }
}

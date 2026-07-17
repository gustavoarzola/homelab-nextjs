// Nurse payment base excludes: exámenes (exams), talleres (workshops) and monto de insumos
// Includes: fee visita + procedimientos + recargos
// Si el descuento de la visita de enfermería no debe afectar el pago de la enfermera,
// se revierte sumando de vuelta el monto descontado (costo ya viene neto de descuento).

export function calcNursePaymentBase(
  costo: number,
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

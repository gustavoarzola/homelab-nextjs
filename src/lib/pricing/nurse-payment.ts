// Nurse payment base excludes: exámenes (exams), talleres (workshops) and monto de insumos
// Includes: fee visita + procedimientos + recargos

export function calcNursePaymentBase(
  costo: number,
  examSum: number,
  workshopSum: number,
  insumosSum: number,
): number {
  return costo - examSum - workshopSum - insumosSum
}

export function calcNursePayment(base: number, porcentaje: number): number {
  return Math.round((base * porcentaje) / 100)
}

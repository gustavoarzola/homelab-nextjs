// Nurse payment base excludes: exámenes (exams) and talleres (workshops)
// Includes: fee visita + procedimientos + recargos

export function calcNursePaymentBase(
  costo: number,
  examSum: number,
  workshopSum: number,
): number {
  return costo - examSum - workshopSum
}

export function calcNursePayment(base: number, porcentaje: number): number {
  return Math.round((base * porcentaje) / 100)
}

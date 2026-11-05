export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

/** Primer y último día del mes como `YYYY-MM-DD` (mismo formato que `visitas.fecha`). */
export function monthRange(year: number, month: number) {
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` }
}

export function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

/** Interpreta `?month=&year=` con los mismos límites que `/pagos-enfermeras`; cae al mes actual. */
export function parsePeriodo(params: { month?: string; year?: string }, now = new Date()) {
  const m = Number(params.month)
  const y = Number(params.year)
  return {
    month: m >= 1 && m <= 12 ? m : now.getMonth() + 1,
    year: y >= 2000 && y <= 2100 ? y : now.getFullYear(),
  }
}

// Reporte financiero de visitas — cálculo puro (sin BD).
//
// Principio: cada columna $ es 1:1 con un concepto real de la visita, y las
// columnas de ingreso suman exactamente el "Total boleta" (los descuentos van
// en negativo). Ver el mapa completo de conceptos en CLAUDE.md, sección
// "Reporte financiero".
//
// Reglas por estado:
// - `no_realizada`: los ítems (procedimientos, exámenes, talleres, recargos,
//   insumos y el fee de visita) NO se hicieron, así que no suman. El único
//   ingreso es el cobro registrado al marcarla (`visitas.costo_traslado`) y la
//   enfermera recibe su porcentaje sobre ese cobro.
// - `cancelada`: todo en 0.
// - resto (`programada`, `confirmada`, `realizada`, `completada`): montos tal
//   como están registrados en la visita.

import type { ExcelColumn } from '@/lib/excel/build-excel'
import { EXAM_GRUPOS, EXAM_GRUPO_META } from '@/lib/exam-grupos'
import { parseDateLocal } from '@/lib/format'
import {
  calcNursePayment,
  calcNursePaymentBreakdown,
  DEFAULT_PORCENTAJE_PAGO,
} from '@/lib/pricing/nurse-payment'

export const CATEGORIA_CURACIONES = 'curaciones'

/** Grupos de examen que se cobran vía `examenes_visitas.precio` (no isapre). */
export const GRUPOS_EXAMEN_CATALOGO = EXAM_GRUPOS.filter((g) => EXAM_GRUPO_META[g].tipo === 'catalogo')
/** Bucket para exámenes con un `grupo_examen` fuera del catálogo conocido — así el total siempre cuadra. */
export const GRUPO_EXAMEN_OTRO = '__otro__'

export const ESTADOS_REPORTE_FINANCIERO_DEFAULT = ['realizada', 'completada', 'no_realizada'] as const

// ─── Input / output ───────────────────────────────────────────────────────────

export type VisitaFinancieraInput = {
  estado: string
  /** `visitas.monto_visita_original` — fee antes de descuento (0 si no cobra visita). */
  montoVisitaOriginal: number
  /** `visitas.monto_descuento`. */
  montoDescuento: number
  descuentoAfectaPagoEnfermera: boolean
  descuentoProcedimientosAfectaPagoEnfermera: boolean
  procedimientos: { precio: number; descuento: number; categoria: string }[]
  examenes: { precio: number; grupoExamen: string }[]
  examenesIsapre: { valorPagar: number; valorCompleto: number }[]
  talleres: number[]
  recargos: number[]
  montoInsumos: number
  /** `visitas.costo_traslado` — cobro de una visita no realizada. */
  costoTraslado: number
  /** `visitas.costo` tal como está guardado (para el control de descuadre). */
  costoRegistrado: number
  tieneEnfermera: boolean
  /** `enfermeras.porcentaje_pago` ACTUAL (no histórico — ver deuda técnica). */
  porcentajePago: number | null
}

export type MontosFinancieros = {
  visitaBruto: number
  /** Negativo. */
  descuentoVisita: number
  /** null si no hay descuento. */
  descuentoVisitaAfectaEnfermera: boolean | null
  curacionesBruto: number
  /** Negativo. */
  descuentoCuraciones: number
  otrosProcedimientosBruto: number
  /** Negativo. */
  descuentoOtrosProcedimientos: number
  /** null si no hay descuento de procedimientos. */
  descuentoProcedimientosAfectaEnfermera: boolean | null
  recargos: number
  talleres: number
  /** Por grupo (`GRUPOS_EXAMEN_CATALOGO` + `GRUPO_EXAMEN_OTRO`). */
  examenesPorGrupo: Record<string, number>
  /** `valor_pagar` — lo que paga el paciente; suma al total. */
  examenesIsapreBono: number
  /** `valor_completo` — solo informativo, NO suma al total. */
  examenesIsapreValorCompleto: number
  insumos: number
  cobroNoRealizada: number
  /** Suma de todas las columnas de ingreso (descuentos ya en negativo). */
  totalBoleta: number
  porcentajeEnfermera: number | null
  pagoEnfermera: number
  /**
   * `visitas.costo` − total calculado desde los ítems. Debería ser 0; ≠ 0 indica
   * un costo guardado desactualizado (p.ej. migrado del sistema legacy).
   * null en no realizadas/canceladas (no aplica).
   */
  descuadreCostoRegistrado: number | null
}

function emptyGrupos(): Record<string, number> {
  return Object.fromEntries([...GRUPOS_EXAMEN_CATALOGO, GRUPO_EXAMEN_OTRO].map((g) => [g, 0]))
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Mismo tope que `computeCostoVisita`: el descuento de una línea no supera su precio. */
const descuentoLinea = (p: { precio: number; descuento: number }) => Math.min(Math.max(0, p.descuento), p.precio)

export function computeMontosFinancieros(v: VisitaFinancieraInput): MontosFinancieros {
  const porcentaje = v.tieneEnfermera ? Number(v.porcentajePago ?? DEFAULT_PORCENTAJE_PAGO) : null
  const base: MontosFinancieros = {
    visitaBruto: 0,
    descuentoVisita: 0,
    descuentoVisitaAfectaEnfermera: null,
    curacionesBruto: 0,
    descuentoCuraciones: 0,
    otrosProcedimientosBruto: 0,
    descuentoOtrosProcedimientos: 0,
    descuentoProcedimientosAfectaEnfermera: null,
    recargos: 0,
    talleres: 0,
    examenesPorGrupo: emptyGrupos(),
    examenesIsapreBono: 0,
    examenesIsapreValorCompleto: 0,
    insumos: 0,
    cobroNoRealizada: 0,
    totalBoleta: 0,
    porcentajeEnfermera: porcentaje,
    pagoEnfermera: 0,
    descuadreCostoRegistrado: null,
  }

  if (v.estado === 'cancelada') return base

  if (v.estado === 'no_realizada') {
    const cobro = Math.max(0, v.costoTraslado)
    return {
      ...base,
      cobroNoRealizada: cobro,
      totalBoleta: cobro,
      pagoEnfermera: porcentaje !== null ? calcNursePayment(cobro, porcentaje) : 0,
    }
  }

  const curaciones = v.procedimientos.filter((p) => p.categoria === CATEGORIA_CURACIONES)
  const otros = v.procedimientos.filter((p) => p.categoria !== CATEGORIA_CURACIONES)
  const montoDescuentoProcedimientos = sum(v.procedimientos.map(descuentoLinea))

  const examenesPorGrupo = emptyGrupos()
  for (const e of v.examenes) {
    const key = (GRUPOS_EXAMEN_CATALOGO as readonly string[]).includes(e.grupoExamen) ? e.grupoExamen : GRUPO_EXAMEN_OTRO
    examenesPorGrupo[key] = (examenesPorGrupo[key] ?? 0) + e.precio
  }

  const m: MontosFinancieros = {
    ...base,
    visitaBruto: v.montoVisitaOriginal,
    descuentoVisita: -v.montoDescuento,
    descuentoVisitaAfectaEnfermera: v.montoDescuento > 0 ? v.descuentoAfectaPagoEnfermera : null,
    curacionesBruto: sum(curaciones.map((p) => p.precio)),
    descuentoCuraciones: -sum(curaciones.map(descuentoLinea)),
    otrosProcedimientosBruto: sum(otros.map((p) => p.precio)),
    descuentoOtrosProcedimientos: -sum(otros.map(descuentoLinea)),
    descuentoProcedimientosAfectaEnfermera:
      montoDescuentoProcedimientos > 0 ? v.descuentoProcedimientosAfectaPagoEnfermera : null,
    recargos: sum(v.recargos),
    talleres: sum(v.talleres),
    examenesPorGrupo,
    examenesIsapreBono: sum(v.examenesIsapre.map((e) => e.valorPagar)),
    examenesIsapreValorCompleto: sum(v.examenesIsapre.map((e) => e.valorCompleto)),
    insumos: v.montoInsumos,
  }

  m.totalBoleta = sumIngresos(m)
  m.descuadreCostoRegistrado = v.costoRegistrado - m.totalBoleta
  m.pagoEnfermera = porcentaje !== null
    ? calcNursePaymentBreakdown({
        procSum: m.curacionesBruto + m.otrosProcedimientosBruto,
        surchargeSum: m.recargos,
        montoVisitaOriginal: v.montoVisitaOriginal,
        montoDescuento: v.montoDescuento,
        descuentoAfectaPagoEnfermera: v.descuentoAfectaPagoEnfermera,
        montoDescuentoProcedimientos,
        descuentoProcedimientosAfectaPagoEnfermera: v.descuentoProcedimientosAfectaPagoEnfermera,
        porcentaje,
      }).pago
    : 0
  return m
}

// ─── Conceptos de ingreso (fuente única para columnas, total y resumen) ──────

export type ConceptoIngreso = {
  key: string
  label: string
  get: (m: MontosFinancieros) => number
}

export function grupoExamenLabel(grupo: string): string {
  if (grupo === GRUPO_EXAMEN_OTRO) return 'Exámenes (otro grupo)'
  return `Exámenes ${EXAM_GRUPO_META[grupo as keyof typeof EXAM_GRUPO_META]?.label ?? grupo}`
}

/** Orden = orden de columnas en el Excel y de filas en el resumen. Su suma = Total boleta. */
export const CONCEPTOS_INGRESO: ConceptoIngreso[] = [
  { key: 'visitaBruto', label: 'Visita enfermería (bruto)', get: (m) => m.visitaBruto },
  { key: 'descuentoVisita', label: 'Descuento visita (−)', get: (m) => m.descuentoVisita },
  { key: 'curacionesBruto', label: 'Curaciones (bruto)', get: (m) => m.curacionesBruto },
  { key: 'descuentoCuraciones', label: 'Descuento curaciones (−)', get: (m) => m.descuentoCuraciones },
  { key: 'otrosProcedimientosBruto', label: 'Otros procedimientos (bruto)', get: (m) => m.otrosProcedimientosBruto },
  { key: 'descuentoOtrosProcedimientos', label: 'Descuento otros procedimientos (−)', get: (m) => m.descuentoOtrosProcedimientos },
  { key: 'recargos', label: 'Recargos', get: (m) => m.recargos },
  { key: 'talleres', label: 'Talleres', get: (m) => m.talleres },
  ...[...GRUPOS_EXAMEN_CATALOGO, GRUPO_EXAMEN_OTRO].map((g) => ({
    key: `examenes:${g}`,
    label: grupoExamenLabel(g),
    get: (m: MontosFinancieros) => m.examenesPorGrupo[g] ?? 0,
  })),
  { key: 'examenesIsapreBono', label: 'Exámenes Imalab · Isapre (bono a pagar)', get: (m) => m.examenesIsapreBono },
  { key: 'insumos', label: 'Insumos', get: (m) => m.insumos },
  { key: 'cobroNoRealizada', label: 'Cobro visita no realizada', get: (m) => m.cobroNoRealizada },
]

function sumIngresos(m: MontosFinancieros): number {
  return sum(CONCEPTOS_INGRESO.map((c) => c.get(m)))
}

// ─── Fila del Excel ───────────────────────────────────────────────────────────

export type ReporteFinancieroRow = {
  id: number
  fecha: string
  estado: string
  paciente: string | null
  rut: string | null
  comuna: string | null
  enfermera: string | null
  origenContacto: string | null
  prevision: string | null
  hogar: string | null
  procedimientos: string
  examenes: string
  talleres: string
  recargos: string
  conceptoNoRealizada: string | null
  tipoDocumento: string | null
  numeroDocumento: string | null
  pagado: boolean
  fechaPago: string | null
  metodoPago: string | null
  montos: MontosFinancieros
}

export type ReporteColumn = ExcelColumn<ReporteFinancieroRow> & { key: string }

const siNo = (v: boolean | null) => (v === null ? null : v ? 'SI' : 'NO')

const ingresoColumns: ReporteColumn[] = CONCEPTOS_INGRESO.map((c) => ({
  key: c.key,
  header: c.label,
  accessor: (r: ReporteFinancieroRow) => c.get(r.montos),
  width: 18,
  format: 'currency-clp' as const,
}))

function insertAfter(cols: ReporteColumn[], afterKey: string, col: ReporteColumn): ReporteColumn[] {
  const i = cols.findIndex((c) => c.key === afterKey)
  return [...cols.slice(0, i + 1), col, ...cols.slice(i + 1)]
}

let columnasIngreso = ingresoColumns
columnasIngreso = insertAfter(columnasIngreso, 'descuentoVisita', {
  key: 'descuentoVisitaAfectaEnfermera',
  header: 'Desc. visita afecta enfermera?',
  accessor: (r) => siNo(r.montos.descuentoVisitaAfectaEnfermera),
  width: 14,
})
columnasIngreso = insertAfter(columnasIngreso, 'descuentoOtrosProcedimientos', {
  key: 'descuentoProcedimientosAfectaEnfermera',
  header: 'Desc. procedimientos afecta enfermera?',
  accessor: (r) => siNo(r.montos.descuentoProcedimientosAfectaEnfermera),
  width: 14,
})
columnasIngreso = insertAfter(columnasIngreso, 'examenesIsapreBono', {
  key: 'examenesIsapreValorCompleto',
  header: 'Exámenes Imalab · Isapre valor completo (informativo, no suma)',
  accessor: (r) => r.montos.examenesIsapreValorCompleto,
  width: 20,
  format: 'currency-clp',
})

/** Registro de columnas de la hoja "Visitas" — lo usan el route de descarga y los checkboxes de `/reportes`. */
export const REPORTE_FINANCIERO_COLUMNS: ReporteColumn[] = [
  { key: 'id', header: 'ID', accessor: (r) => r.id, width: 8, format: 'integer' },
  { key: 'fecha', header: 'Fecha', accessor: (r) => parseDateLocal(r.fecha), width: 12, format: 'date' },
  { key: 'estado', header: 'Estado', accessor: (r) => r.estado, width: 14 },
  { key: 'paciente', header: 'Paciente', accessor: (r) => r.paciente, width: 30 },
  { key: 'rut', header: 'RUT', accessor: (r) => r.rut, width: 14 },
  { key: 'comuna', header: 'Comuna', accessor: (r) => r.comuna, width: 18 },
  { key: 'prevision', header: 'Previsión paciente', accessor: (r) => r.prevision, width: 18 },
  { key: 'hogar', header: 'Hogar', accessor: (r) => r.hogar, width: 20 },
  { key: 'enfermera', header: 'Enfermera', accessor: (r) => r.enfermera, width: 28 },
  { key: 'origenContacto', header: 'Forma de contacto', accessor: (r) => r.origenContacto, width: 18 },
  { key: 'detalleProcedimientos', header: 'Detalle procedimientos', accessor: (r) => r.procedimientos, width: 30, wrap: true },
  { key: 'detalleExamenes', header: 'Detalle exámenes', accessor: (r) => r.examenes, width: 30, wrap: true },
  { key: 'detalleTalleres', header: 'Detalle talleres', accessor: (r) => r.talleres, width: 24, wrap: true },
  { key: 'detalleRecargos', header: 'Detalle recargos', accessor: (r) => r.recargos, width: 24, wrap: true },
  { key: 'conceptoNoRealizada', header: 'Concepto no realizada', accessor: (r) => r.conceptoNoRealizada, width: 22 },
  ...columnasIngreso,
  { key: 'totalBoleta', header: 'Total boleta', accessor: (r) => r.montos.totalBoleta, width: 16, format: 'currency-clp' },
  { key: 'porcentajeEnfermera', header: '% enfermera (actual)', accessor: (r) => r.montos.porcentajeEnfermera, width: 12 },
  { key: 'pagoEnfermera', header: 'Pago enfermera', accessor: (r) => r.montos.pagoEnfermera, width: 16, format: 'currency-clp' },
  { key: 'tipoDocumento', header: 'Tipo documento', accessor: (r) => r.tipoDocumento, width: 12 },
  { key: 'numeroDocumento', header: 'N° documento', accessor: (r) => r.numeroDocumento, width: 14 },
  { key: 'pagado', header: 'Pagado', accessor: (r) => (r.pagado ? 'SI' : 'NO'), width: 10 },
  { key: 'fechaPago', header: 'Fecha de pago', accessor: (r) => (r.fechaPago ? parseDateLocal(r.fechaPago) : null), width: 14, format: 'date' },
  { key: 'metodoPago', header: 'Forma de pago', accessor: (r) => r.metodoPago, width: 16 },
  {
    key: 'descuadreCostoRegistrado',
    header: 'Control: descuadre vs costo registrado',
    accessor: (r) => r.montos.descuadreCostoRegistrado,
    width: 18,
    format: 'currency-clp',
  },
]

// ─── Resumen mensual (estado de resultados) ──────────────────────────────────

export type CostoMensualItem = { anio: number; mes: number; categoria: string; monto: number }

export type ResumenRow = { concepto: string; valores: Record<string, number>; total: number; bold?: boolean }

export const periodoKey = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}`

/** Meses `YYYY-MM` entre dos fechas `YYYY-MM-DD` (inclusive). */
export function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  let y = Number(desde.slice(0, 4))
  let m = Number(desde.slice(5, 7))
  const yEnd = Number(hasta.slice(0, 4))
  const mEnd = Number(hasta.slice(5, 7))
  while (y < yEnd || (y === yEnd && m <= mEnd)) {
    out.push(periodoKey(y, m))
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

export function buildResumenMensual(opts: {
  rows: ReporteFinancieroRow[]
  costos: CostoMensualItem[]
  /** Categorías de costo a mostrar (en orden), aunque no tengan monto. */
  categorias: string[]
  meses: string[]
}): ResumenRow[] {
  const { rows, costos, categorias, meses } = opts
  const mk = (concepto: string, porMes: Map<string, number>, bold = false): ResumenRow => {
    const valores = Object.fromEntries(meses.map((p) => [p, porMes.get(p) ?? 0]))
    return { concepto, valores, total: sum(Object.values(valores)), bold }
  }
  const acumular = (get: (m: MontosFinancieros) => number) => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const p = r.fecha.slice(0, 7)
      map.set(p, (map.get(p) ?? 0) + get(r.montos))
    }
    return map
  }
  const restar = (a: ResumenRow, b: ResumenRow, concepto: string): ResumenRow => {
    const valores = Object.fromEntries(meses.map((p) => [p, (a.valores[p] ?? 0) - (b.valores[p] ?? 0)]))
    return { concepto, valores, total: a.total - b.total, bold: true }
  }

  const out: ResumenRow[] = []
  out.push({ concepto: 'INGRESOS', valores: {}, total: 0, bold: true })
  for (const c of CONCEPTOS_INGRESO) out.push(mk(c.label, acumular(c.get)))
  const totalIngresos = mk('Total ingresos', acumular((m) => m.totalBoleta), true)
  out.push(totalIngresos)

  out.push({ concepto: 'EGRESOS', valores: {}, total: 0, bold: true })
  const egresos: ResumenRow[] = [mk('Pago enfermeras', acumular((m) => m.pagoEnfermera))]
  for (const cat of categorias) {
    const map = new Map<string, number>()
    for (const c of costos) {
      if (c.categoria !== cat) continue
      const p = periodoKey(c.anio, c.mes)
      map.set(p, (map.get(p) ?? 0) + c.monto)
    }
    egresos.push(mk(cat, map))
  }
  out.push(...egresos)
  const totalEgresos: ResumenRow = {
    concepto: 'Total egresos',
    valores: Object.fromEntries(meses.map((p) => [p, sum(egresos.map((e) => e.valores[p] ?? 0))])),
    total: sum(egresos.map((e) => e.total)),
    bold: true,
  }
  out.push(totalEgresos)

  out.push(restar(totalIngresos, totalEgresos, 'RESULTADO'))

  out.push({ concepto: '', valores: {}, total: 0 })
  out.push(mk('Informativo: exámenes Imalab · Isapre valor completo', acumular((m) => m.examenesIsapreValorCompleto)))
  return out
}

export function resumenColumns(meses: string[]): ExcelColumn<ResumenRow>[] {
  const isHeading = (r: ResumenRow) => r.concepto === '' || r.concepto === 'INGRESOS' || r.concepto === 'EGRESOS'
  return [
    { header: 'Concepto', accessor: (r) => r.concepto, width: 52 },
    ...meses.map((p) => ({
      header: p,
      accessor: (r: ResumenRow) => (isHeading(r) ? null : r.valores[p] ?? 0),
      width: 14,
      format: 'currency-clp' as const,
    })),
    { header: 'Total', accessor: (r) => (isHeading(r) ? null : r.total), width: 16, format: 'currency-clp' },
  ]
}

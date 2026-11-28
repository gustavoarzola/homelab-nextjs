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
  conteo: ConteoVisita
}

/**
 * Conteo de "pacientes" por tipo de atención — misma regla que la card "Ítems atendidos"
 * del dashboard (`getDashboardVisitsByDay`): se cuentan VISITAS realizadas/completadas, no
 * ítems; una visita puede sumar en varios tipos; una visita sin exámenes, procedimientos
 * ni talleres (convenio) cuenta como "Otros procedimientos".
 */
export type ConteoVisita = {
  efectiva: boolean
  noRealizada: boolean
  examen: boolean
  curacion: boolean
  otroProcedimiento: boolean
  taller: boolean
}

/** Estados que cuentan como visita efectivamente atendida (espejo de `ESTADOS_VISITA_EFECTIVA` del dashboard). */
export const ESTADOS_VISITA_EFECTIVA = ['realizada', 'completada']

function computeConteo(v: VisitaFinancieraInput): ConteoVisita {
  const efectiva = ESTADOS_VISITA_EFECTIVA.includes(v.estado)
  const tieneExamen = v.examenes.length > 0 || v.examenesIsapre.length > 0
  const sinItems = !tieneExamen && v.procedimientos.length === 0 && v.talleres.length === 0
  return {
    efectiva,
    noRealizada: v.estado === 'no_realizada',
    examen: efectiva && tieneExamen,
    curacion: efectiva && v.procedimientos.some((p) => p.categoria === CATEGORIA_CURACIONES),
    otroProcedimiento: efectiva && (v.procedimientos.some((p) => p.categoria !== CATEGORIA_CURACIONES) || sinItems),
    taller: efectiva && v.talleres.length > 0,
  }
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
    conteo: computeConteo(v),
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

// ─── Producción (bloque "Utilidad antes de costos" del Resumen) ──────────────
//
// Cuadre: totalBoleta = produccionExamenes + IMED a pagar (examenesIsapreBono)
//                      + produccionVisitas + insumos.

/** Exámenes de catálogo (Imalab + Imalab Fonasa 3 + Integramédica [+ otro grupo]). */
export const produccionExamenes = (m: MontosFinancieros) => sum(Object.values(m.examenesPorGrupo))

/** Visita + curaciones + otros procedimientos + talleres + recargos + cobro no realizada, neto de descuentos. Sin insumos. */
export const produccionVisitas = (m: MontosFinancieros) =>
  m.visitaBruto + m.descuentoVisita
  + m.curacionesBruto + m.descuentoCuraciones
  + m.otrosProcedimientosBruto + m.descuentoOtrosProcedimientos
  + m.talleres + m.recargos + m.cobroNoRealizada

// ─── Fila del Excel ───────────────────────────────────────────────────────────

export type ReporteFinancieroRow = {
  id: number
  fecha: string
  estado: string
  paciente: string | null
  rut: string | null
  comuna: string | null
  idEnfermera: number | null
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

// ─── Resumen mensual (formato del informe de fin de mes) ─────────────────────

export type CostoMensualItem = { anio: number; mes: number; categoria: string; monto: number }

/** Categoría de costo con su grupo, en el orden del Resumen (grupo.orden → orden → nombre). */
export type CategoriaResumen = { categoria: string; grupo: string }

/**
 * - heading: título de bloque, sin valores.
 * - value / count: valores por mes ($ o cantidad).
 * - manual: celda vacía (amarilla) que el usuario llena a mano.
 * - blank: separador.
 */
export type ResumenRowKind = 'heading' | 'value' | 'count' | 'manual' | 'blank'

export type ResumenRow = {
  concepto: string
  kind: ResumenRowKind
  bold?: boolean
  indent?: number
  valores: Record<string, number>
  total: number
}

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
  /** Categorías a mostrar (aunque no tengan monto), ya ordenadas por grupo. */
  categorias: CategoriaResumen[]
  meses: string[]
}): ResumenRow[] {
  const { rows, costos, categorias, meses } = opts

  const fromMap = (map: Map<string, number>) => Object.fromEntries(meses.map((p) => [p, map.get(p) ?? 0]))
  const row = (
    concepto: string,
    valores: Record<string, number>,
    extra: { kind?: ResumenRowKind; bold?: boolean; indent?: number } = {},
  ): ResumenRow => ({ concepto, kind: extra.kind ?? 'value', bold: extra.bold, indent: extra.indent, valores, total: sum(Object.values(valores)) })
  const acumular = (get: (r: ReporteFinancieroRow) => number, filtro: (r: ReporteFinancieroRow) => boolean = () => true) => {
    const map = new Map<string, number>()
    for (const r of rows) {
      if (!filtro(r)) continue
      const p = r.fecha.slice(0, 7)
      map.set(p, (map.get(p) ?? 0) + get(r))
    }
    return fromMap(map)
  }
  const restar = (a: Record<string, number>, b: Record<string, number>) =>
    Object.fromEntries(meses.map((p) => [p, (a[p] ?? 0) - (b[p] ?? 0)]))
  const sumar = (xs: Record<string, number>[]) =>
    Object.fromEntries(meses.map((p) => [p, sum(xs.map((x) => x[p] ?? 0))]))
  const heading = (concepto: string): ResumenRow => ({ concepto, kind: 'heading', bold: true, valores: {}, total: 0 })
  const manual = (concepto: string, bold = false): ResumenRow => ({ concepto, kind: 'manual', bold, valores: {}, total: 0 })
  const blank: ResumenRow = { concepto: '', kind: 'blank', valores: {}, total: 0 }
  const count = (concepto: string, filtro: (c: ConteoVisita) => boolean, indent?: number) =>
    row(concepto, acumular(() => 1, (r) => filtro(r.montos.conteo)), { kind: 'count', indent })

  // Enfermeras con producción o pago en el período (alfabético); "Sin enfermera" al final si aplica.
  const enfermeras = new Map<number | null, { nombre: string; porcentaje: number | null }>()
  for (const r of rows) {
    if (produccionVisitas(r.montos) === 0 && r.montos.pagoEnfermera === 0) continue
    if (!enfermeras.has(r.idEnfermera)) {
      enfermeras.set(r.idEnfermera, {
        nombre: r.idEnfermera === null ? 'Sin enfermera' : (r.enfermera ?? `Enfermera #${r.idEnfermera}`),
        porcentaje: r.montos.porcentajeEnfermera,
      })
    }
  }
  const listaEnfermeras = [...enfermeras.entries()].sort(([idA, a], [idB, b]) =>
    idA === null ? 1 : idB === null ? -1 : a.nombre.localeCompare(b.nombre, 'es'))
  const pct = (n: number | null) => (n === null ? '' : ` (${n.toLocaleString('es-CL')}%)`)

  const out: ResumenRow[] = []

  // ── Pacientes (conteos, misma regla que el dashboard)
  out.push(heading('PACIENTES'))
  out.push(count('Total de pacientes (realizadas + completadas)', (c) => c.efectiva))
  out.push(count('Exámenes (incluye isapre)', (c) => c.examen, 1))
  out.push(count('Curaciones', (c) => c.curacion, 1))
  out.push(count('Otros procedimientos (incluye visitas sin ítems)', (c) => c.otroProcedimiento, 1))
  out.push(count('Talleres', (c) => c.taller, 1))
  out.push(count('Visitas no realizadas', (c) => c.noRealizada))
  out.push(blank)

  // ── Ingresos (detalle 1:1; "otro grupo" de exámenes solo si tiene montos)
  out.push(heading('INGRESOS'))
  for (const c of CONCEPTOS_INGRESO) {
    const r = row(c.label, acumular((x) => c.get(x.montos)), { indent: 1 })
    if (c.key === `examenes:${GRUPO_EXAMEN_OTRO}` && Object.values(r.valores).every((v) => v === 0)) continue
    out.push(r)
  }
  out.push(row('Total ingresos', acumular((x) => x.montos.totalBoleta), { bold: true }))
  out.push(blank)

  // ── Utilidad antes de costos
  const prodVisitas = acumular((x) => produccionVisitas(x.montos))
  const pagos = acumular((x) => x.montos.pagoEnfermera)
  out.push(heading('UTILIDAD ANTES DE COSTOS'))
  out.push(row('Producción Exámenes', acumular((x) => produccionExamenes(x.montos))))
  out.push(row('Producción IMED producción', acumular((x) => x.montos.examenesIsapreValorCompleto)))
  out.push(row('Producción de IMED a pagar', acumular((x) => x.montos.examenesIsapreBono)))
  out.push(row('Producción Visitas', prodVisitas, { bold: true }))
  for (const [id, e] of listaEnfermeras) {
    out.push(row(e.nombre, acumular((x) => produccionVisitas(x.montos), (x) => x.idEnfermera === id), { indent: 1 }))
  }
  out.push(manual('Total Facturado'))
  out.push(row('Retención Visitas (Producción Visitas − pago enfermeras)', restar(prodVisitas, pagos)))
  out.push(manual('Retención Exámenes'))
  out.push(manual('Retención Impuestos Visitas'))
  out.push(manual('Utilidad antes de los costos', true))
  out.push(blank)

  // ── Costos totales
  out.push(heading('COSTOS TOTALES'))
  const subtotales: Record<string, number>[] = [pagos]
  out.push(row('Enfermeras visitas', pagos, { bold: true }))
  for (const [id, e] of listaEnfermeras) {
    if (id === null) continue
    out.push(row(`${e.nombre}${pct(e.porcentaje)}`, acumular((x) => x.montos.pagoEnfermera, (x) => x.idEnfermera === id), { indent: 1 }))
  }
  const montoCategoria = (categoria: string) => {
    const map = new Map<string, number>()
    for (const c of costos) {
      if (c.categoria !== categoria) continue
      const p = periodoKey(c.anio, c.mes)
      map.set(p, (map.get(p) ?? 0) + c.monto)
    }
    return fromMap(map)
  }
  const grupos: { grupo: string; categorias: string[] }[] = []
  for (const c of categorias) {
    const last = grupos[grupos.length - 1]
    if (last && last.grupo === c.grupo) last.categorias.push(c.categoria)
    else grupos.push({ grupo: c.grupo, categorias: [c.categoria] })
  }
  for (const g of grupos) {
    const hijos = g.categorias.map((cat) => row(cat, montoCategoria(cat), { indent: 1 }))
    const subtotal = sumar(hijos.map((h) => h.valores))
    subtotales.push(subtotal)
    out.push(row(g.grupo, subtotal, { bold: true }), ...hijos)
  }
  out.push(row('Costos totales', sumar(subtotales), { bold: true }))
  out.push(blank)

  // ── Utilidad antes de impuestos
  out.push(heading('UTILIDAD ANTES DE IMPUESTOS'))
  out.push(manual('Utilidad antes de impuestos', true))
  out.push(row('Insumos recuperados', acumular((x) => x.montos.insumos)))
  out.push(blank)
  out.push(manual('Utilidad antes de impuestos + materiales', true))
  return out
}

/** Estilo por fila para `buildExcelWorkbook` (rowStyle). */
export function resumenRowStyle(r: ResumenRow) {
  return {
    bold: r.bold,
    indent: r.indent,
    fill: r.kind === 'manual' ? 'FFFFF2CC' : r.kind === 'heading' ? 'FFDDEBF7' : undefined,
    numFmt: r.kind === 'count' ? 'integer' as const : undefined,
  }
}

export function resumenColumns(meses: string[]): ExcelColumn<ResumenRow>[] {
  const sinValor = (r: ResumenRow) => r.kind === 'heading' || r.kind === 'manual' || r.kind === 'blank'
  return [
    { header: 'Concepto', accessor: (r) => r.concepto, width: 56 },
    ...meses.map((p) => ({
      header: p,
      accessor: (r: ResumenRow) => (sinValor(r) ? null : r.valores[p] ?? 0),
      width: 14,
      format: 'currency-clp' as const,
    })),
    // Con un solo mes la columna Total repetiría los mismos valores.
    ...(meses.length > 1
      ? [{ header: 'Total', accessor: (r: ResumenRow) => (sinValor(r) ? null : r.total), width: 16, format: 'currency-clp' as const }]
      : []),
  ]
}

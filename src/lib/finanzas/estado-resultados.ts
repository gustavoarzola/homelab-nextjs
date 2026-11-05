// Estado de resultados mensual. Función pura: recibe agregados ya sumados y devuelve
// las filas en cascada (ingresos → costos directos → margen → gastos → resultado).
// No hace I/O; lo consumen la página `/estado-resultados` y el export a Excel.
//
// Convenciones:
//  - Todos los montos son pesos enteros.
//  - Los descuentos se restan de los ingresos (no son un gasto). `ingresos.totalCobrado`
//    (Σ visitas.costo, ya neto de descuentos) es la cifra autoritativa de ingresos netos.
//  - Los honorarios de enfermeras son costo directo por su monto BRUTO. La retención del
//    SII se informa aparte: parte ese mismo costo, no lo aumenta.

import { EXAM_GRUPO_LABELS, type ExamGrupo } from '@/lib/exam-grupos'
import { procedimientoCategoriaLabel } from '@/lib/procedimiento-categorias'

import {
  GASTO_CATEGORIAS,
  GASTO_CATEGORIA_META,
  isGastoCategoria,
  type GastoCategoria,
} from './categorias-gasto'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EerrGasto = {
  categoria: string
  descripcion: string
  monto: number
  /** Laboratorio (`examenes.grupo_examen`) al que se imputa un `costo_laboratorio`. */
  grupoExamen: string | null
}

export type EerrInput = {
  ingresos: {
    /** Σ `visitas.monto_visita_original` (fee de visita antes de su descuento). */
    feeVisita: number
    /** Σ `procedimientos_visitas.precio` (bruto) por categoría de procedimiento. */
    procedimientos: { categoria: string; monto: number }[]
    recargos: number
    /** Exámenes regulares + isapre, sumados por laboratorio (`examenes.grupo_examen`). */
    examenesPorLab: { grupo: string; monto: number }[]
    talleres: number
    insumos: number
    descuentoVisita: number
    descuentoProcedimientos: number
    /** Σ `visitas.costo`: lo efectivamente cobrado. */
    totalCobrado: number
  }
  honorarios: { enfermera: string; pago: number }[]
  /** Retención de honorarios vigente en el mes (porcentaje, p.ej. 15.25). */
  tasaRetencion: number
  gastos: EerrGasto[]
}

export type EerrRowKind = 'section' | 'line' | 'subtotal' | 'total' | 'info'

export type EerrRow = {
  key: string
  label: string
  /** `null` en filas de encabezado. */
  monto: number | null
  kind: EerrRowKind
  /** Sangría visual: 0 sin sangría, 1 y 2 anidadas. */
  nivel: 0 | 1 | 2
  /** Monto como % de los ingresos netos (`null` si no aplica o no hay ingresos). */
  pctIngresos: number | null
  nota?: string
}

export type EerrTotales = {
  ingresosBrutos: number
  descuentos: number
  ingresosNetos: number
  honorarios: number
  costosDirectos: number
  margenContribucion: number
  gastosOperacionales: number
  resultado: number
  retencionHonorarios: number
  /** Ingresos netos − (brutos − descuentos). Distinto de 0 solo si los componentes no cuadran con `costo`. */
  ajusteCuadratura: number
}

export type EstadoResultados = {
  rows: EerrRow[]
  totales: EerrTotales
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function examGrupoLabel(grupo: string): string {
  return EXAM_GRUPO_LABELS[grupo as ExamGrupo] ?? grupo
}

function groupSum<T>(items: T[], keyOf: (t: T) => string, valueOf: (t: T) => number): Map<string, number> {
  const out = new Map<string, number>()
  for (const item of items) {
    const k = keyOf(item)
    out.set(k, (out.get(k) ?? 0) + valueOf(item))
  }
  return out
}

const byLabel = (a: [string, number], b: [string, number]) => a[0].localeCompare(b[0], 'es')

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildEstadoResultados(input: EerrInput): EstadoResultados {
  const { ingresos, honorarios, tasaRetencion, gastos } = input

  // Ingresos por línea de negocio
  const procPorCategoria = [...groupSum(ingresos.procedimientos, (p) => p.categoria, (p) => p.monto)].sort(byLabel)
  const procedimientosTotal = sum(procPorCategoria.map(([, m]) => m))
  const examenesPorLab = [...groupSum(ingresos.examenesPorLab, (e) => e.grupo, (e) => e.monto)].sort(byLabel)
  const examenesTotal = sum(examenesPorLab.map(([, m]) => m))

  const ingresosBrutos =
    ingresos.feeVisita + procedimientosTotal + ingresos.recargos + examenesTotal + ingresos.talleres + ingresos.insumos
  const descuentos = ingresos.descuentoVisita + ingresos.descuentoProcedimientos
  const ingresosNetos = ingresos.totalCobrado
  const ajusteCuadratura = ingresosNetos - (ingresosBrutos - descuentos)

  // Costos directos
  const honorariosTotal = sum(honorarios.map((h) => h.pago))
  const gastosDe = (c: GastoCategoria) => gastos.filter((g) => g.categoria === c)
  // Gastos con una categoría desconocida (dato viejo / manual) no se pierden: caen en "Otros gastos".
  const gastosOtrosExtra = gastos.filter((g) => !isGastoCategoria(g.categoria))

  const costoCategorias = GASTO_CATEGORIAS.filter((c) => GASTO_CATEGORIA_META[c].bloque === 'costo_directo')
  const gastoCategorias = GASTO_CATEGORIAS.filter((c) => GASTO_CATEGORIA_META[c].bloque === 'gasto_operacional')

  const itemsDe = (c: GastoCategoria): EerrGasto[] => (c === 'otros' ? [...gastosDe(c), ...gastosOtrosExtra] : gastosDe(c))
  const totalDe = (c: GastoCategoria) => sum(itemsDe(c).map((g) => g.monto))

  const costosDirectosNoHonorarios = sum(costoCategorias.map(totalDe))
  const costosDirectos = honorariosTotal + costosDirectosNoHonorarios
  const margenContribucion = ingresosNetos - costosDirectos
  const gastosOperacionales = sum(gastoCategorias.map(totalDe))
  const resultado = margenContribucion - gastosOperacionales
  const retencionHonorarios = Math.round((honorariosTotal * tasaRetencion) / 100)

  const pct = (monto: number | null): number | null =>
    monto === null || ingresosNetos === 0 ? null : (monto / ingresosNetos) * 100

  const rows: EerrRow[] = []
  const push = (
    key: string,
    label: string,
    monto: number | null,
    kind: EerrRowKind,
    nivel: 0 | 1 | 2,
    nota?: string,
  ) => rows.push({ key, label, monto, kind, nivel, pctIngresos: kind === 'section' ? null : pct(monto), nota })

  // ── Ingresos ───────────────────────────────────────────────────────────────
  push('ingresos', 'Ingresos', null, 'section', 0)
  push('ing-visitas', 'Visitas de enfermería', ingresos.feeVisita, 'line', 1)
  push('ing-procedimientos', 'Procedimientos', procedimientosTotal, 'line', 1)
  for (const [cat, monto] of procPorCategoria) {
    push(`ing-proc-${cat}`, procedimientoCategoriaLabel(cat), monto, 'line', 2)
  }
  push('ing-recargos', 'Recargos', ingresos.recargos, 'line', 1)
  push('ing-examenes', 'Exámenes', examenesTotal, 'line', 1)
  for (const [grupo, monto] of examenesPorLab) {
    push(`ing-examenes-${grupo}`, examGrupoLabel(grupo), monto, 'line', 2)
  }
  push('ing-talleres', 'Talleres', ingresos.talleres, 'line', 1)
  push('ing-insumos', 'Insumos', ingresos.insumos, 'line', 1)
  push('ing-brutos', 'Ingresos brutos', ingresosBrutos, 'subtotal', 0)
  push('desc-visitas', 'Descuentos en visitas', -ingresos.descuentoVisita, 'line', 1)
  push('desc-procedimientos', 'Descuentos en procedimientos', -ingresos.descuentoProcedimientos, 'line', 1)
  if (ajusteCuadratura !== 0) {
    push(
      'ing-ajuste',
      'Ajuste de cuadratura',
      ajusteCuadratura,
      'line',
      1,
      'Diferencia entre lo cobrado (suma de costos de visitas) y la suma de sus componentes. Debería ser 0.',
    )
  }
  push('ing-netos', 'Ingresos netos', ingresosNetos, 'total', 0)

  // ── Costos directos ────────────────────────────────────────────────────────
  push('costos', 'Costos directos', null, 'section', 0)
  push(
    'cd-honorarios',
    'Honorarios de enfermeras',
    honorariosTotal,
    'line',
    1,
    `Monto bruto de las boletas de honorarios · ${honorarios.length} ${honorarios.length === 1 ? 'enfermera' : 'enfermeras'} · detalle en Pagos enfermeras`,
  )
  for (const c of costoCategorias) {
    const items = itemsDe(c)
    push(`cd-${c}`, GASTO_CATEGORIA_META[c].label, totalDe(c), 'line', 1)
    for (const g of items) {
      const lab = c === 'costo_laboratorio' && g.grupoExamen ? `${examGrupoLabel(g.grupoExamen)} · ` : ''
      push(`cd-${c}-${rows.length}`, `${lab}${g.descripcion}`, g.monto, 'line', 2)
    }
  }
  push('costos-directos', 'Costos directos', costosDirectos, 'subtotal', 0)
  push('margen', 'Margen de contribución', margenContribucion, 'total', 0)

  // ── Margen por línea de negocio ────────────────────────────────────────────
  push('lineas', 'Margen por línea de negocio', null, 'section', 0)
  const ingresosVisitasNetos =
    ingresos.feeVisita + procedimientosTotal + ingresos.recargos - ingresos.descuentoVisita - ingresos.descuentoProcedimientos
  push('ml-visitas', 'Visitas y procedimientos (neto de descuentos, menos honorarios)', ingresosVisitasNetos - honorariosTotal, 'line', 1)
  const costoLabPorGrupo = groupSum(
    itemsDe('costo_laboratorio'),
    (g) => g.grupoExamen ?? '',
    (g) => g.monto,
  )
  const labs = new Set<string>([...examenesPorLab.map(([g]) => g), ...[...costoLabPorGrupo.keys()].filter((g) => g !== '')])
  for (const grupo of [...labs].sort((a, b) => examGrupoLabel(a).localeCompare(examGrupoLabel(b), 'es'))) {
    const ingreso = examenesPorLab.find(([g]) => g === grupo)?.[1] ?? 0
    push(`ml-lab-${grupo}`, `Exámenes · ${examGrupoLabel(grupo)}`, ingreso - (costoLabPorGrupo.get(grupo) ?? 0), 'line', 1)
  }
  const labSinAsignar = costoLabPorGrupo.get('') ?? 0
  if (labSinAsignar !== 0) {
    push('ml-lab-sin-asignar', 'Costo de laboratorio sin asignar a un laboratorio', -labSinAsignar, 'line', 1)
  }
  push('ml-talleres', 'Talleres', ingresos.talleres, 'line', 1)
  push('ml-insumos', 'Insumos (ingreso menos compras)', ingresos.insumos - totalDe('costo_insumos'), 'line', 1)
  const otrosCostos = totalDe('costo_otro')
  if (otrosCostos !== 0) push('ml-otros', 'Otros costos directos', -otrosCostos, 'line', 1)

  // ── Gastos operacionales ───────────────────────────────────────────────────
  push('gastos', 'Gastos operacionales', null, 'section', 0)
  for (const c of gastoCategorias) {
    const items = itemsDe(c)
    push(`go-${c}`, GASTO_CATEGORIA_META[c].label, totalDe(c), 'line', 1)
    for (const g of items) push(`go-${c}-${rows.length}`, g.descripcion, g.monto, 'line', 2)
  }
  push('gastos-operacionales', 'Gastos operacionales', gastosOperacionales, 'subtotal', 0)
  push('resultado', 'Resultado antes de impuesto', resultado, 'total', 0)

  // ── Informativo ────────────────────────────────────────────────────────────
  push('info', 'Informativo', null, 'section', 0)
  push(
    'info-retencion',
    `Retención de honorarios por enterar al SII (${tasaRetencion.toLocaleString('es-CL')} %)`,
    retencionHonorarios,
    'info',
    1,
    'Ya está incluida en los honorarios: parte ese costo entre la enfermera y el SII, no lo aumenta.',
  )
  push('info-liquido', 'Líquido transferido a enfermeras', honorariosTotal - retencionHonorarios, 'info', 1)

  return {
    rows,
    totales: {
      ingresosBrutos,
      descuentos,
      ingresosNetos,
      honorarios: honorariosTotal,
      costosDirectos,
      margenContribucion,
      gastosOperacionales,
      resultado,
      retencionHonorarios,
      ajusteCuadratura,
    },
  }
}

// ─── Indicadores ──────────────────────────────────────────────────────────────

export type IndicadorFormato = 'entero' | 'clp' | 'porcentaje'

export type Indicador = { key: string; label: string; valor: number; formato: IndicadorFormato }

export type IndicadoresInput = {
  visitas: number
  pacientes: number
  pacientesNuevos: number
  pacientesWeb: number
  visitasConExamenes: number
  examenes: number
  vacunas: number
  curaciones: number
  ecg: number
  otrosProcedimientos: number
  talleres: number
  facturadoConBoleta: number
  traslados: number
}

export function buildIndicadores(input: IndicadoresInput, t: Pick<EerrTotales, 'ingresosBrutos' | 'descuentos' | 'ingresosNetos' | 'margenContribucion'>): Indicador[] {
  const div = (a: number, b: number) => (b === 0 ? 0 : a / b)
  return [
    { key: 'visitas', label: 'Visitas completadas', valor: input.visitas, formato: 'entero' },
    { key: 'pacientes', label: 'Pacientes atendidos', valor: input.pacientes, formato: 'entero' },
    { key: 'pacientes-nuevos', label: 'Pacientes nuevos', valor: input.pacientesNuevos, formato: 'entero' },
    { key: 'pacientes-web', label: 'Pacientes por sitio web', valor: input.pacientesWeb, formato: 'entero' },
    { key: 'visitas-examenes', label: 'Visitas con exámenes', valor: input.visitasConExamenes, formato: 'entero' },
    { key: 'examenes', label: 'Exámenes realizados', valor: input.examenes, formato: 'entero' },
    { key: 'vacunas', label: 'Vacunas', valor: input.vacunas, formato: 'entero' },
    { key: 'curaciones', label: 'Curaciones', valor: input.curaciones, formato: 'entero' },
    { key: 'ecg', label: 'Electrocardiogramas', valor: input.ecg, formato: 'entero' },
    { key: 'otros-proc', label: 'Otros procedimientos', valor: input.otrosProcedimientos, formato: 'entero' },
    { key: 'talleres', label: 'Talleres', valor: input.talleres, formato: 'entero' },
    { key: 'ticket', label: 'Ticket promedio por visita', valor: Math.round(div(t.ingresosNetos, input.visitas)), formato: 'clp' },
    { key: 'margen-visita', label: 'Margen de contribución por visita', valor: Math.round(div(t.margenContribucion, input.visitas)), formato: 'clp' },
    { key: 'pct-descuento', label: 'Descuentos sobre ingresos brutos', valor: div(t.descuentos, t.ingresosBrutos) * 100, formato: 'porcentaje' },
    { key: 'facturado', label: 'Facturado con boleta o factura', valor: input.facturadoConBoleta, formato: 'clp' },
    { key: 'traslados', label: 'Traslados de visitas no realizadas (no incluidos)', valor: input.traslados, formato: 'clp' },
  ]
}

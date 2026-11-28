import { describe, expect, it } from 'vitest'
import {
  buildResumenMensual,
  resumenColumns,
  computeMontosFinancieros,
  CONCEPTOS_INGRESO,
  produccionExamenes,
  produccionVisitas,
  GRUPO_EXAMEN_OTRO,
  mesesEntre,
  REPORTE_FINANCIERO_COLUMNS,
  type ReporteFinancieroRow,
  type VisitaFinancieraInput,
} from '../financiero'

const base: VisitaFinancieraInput = {
  estado: 'realizada',
  montoVisitaOriginal: 20000,
  montoDescuento: 5000,
  descuentoAfectaPagoEnfermera: false,
  descuentoProcedimientosAfectaPagoEnfermera: true,
  procedimientos: [
    { precio: 10000, descuento: 2000, categoria: 'curaciones' },
    { precio: 8000, descuento: 1000, categoria: 'otros' },
    { precio: 3000, descuento: 9999, categoria: 'otros' }, // descuento topado al precio
  ],
  examenes: [
    { precio: 4000, grupoExamen: 'imalab' },
    { precio: 6000, grupoExamen: 'imalab fonasa 3' },
    { precio: 7000, grupoExamen: 'integramédica' },
    { precio: 500, grupoExamen: 'grupo-legacy' },
  ],
  examenesIsapre: [{ valorPagar: 3000, valorCompleto: 12000 }],
  talleres: [15000],
  recargos: [2500, 1500],
  montoInsumos: 1200,
  costoTraslado: 9000,
  costoRegistrado: 0,
  tieneEnfermera: true,
  porcentajePago: 50,
}

const sumIngresos = (m: ReturnType<typeof computeMontosFinancieros>) =>
  CONCEPTOS_INGRESO.reduce((acc, c) => acc + c.get(m), 0)

describe('computeMontosFinancieros', () => {
  it('separa cada concepto 1:1 y las columnas de ingreso suman el total', () => {
    const m = computeMontosFinancieros(base)
    expect(m.visitaBruto).toBe(20000)
    expect(m.descuentoVisita).toBe(-5000)
    expect(m.descuentoVisitaAfectaEnfermera).toBe(false)
    expect(m.curacionesBruto).toBe(10000)
    expect(m.descuentoCuraciones).toBe(-2000)
    expect(m.otrosProcedimientosBruto).toBe(11000)
    expect(m.descuentoOtrosProcedimientos).toBe(-4000)
    expect(m.descuentoProcedimientosAfectaEnfermera).toBe(true)
    expect(m.recargos).toBe(4000)
    expect(m.talleres).toBe(15000)
    expect(m.examenesPorGrupo).toEqual({
      imalab: 4000,
      'imalab fonasa 3': 6000,
      'integramédica': 7000,
      [GRUPO_EXAMEN_OTRO]: 500,
    })
    expect(m.examenesIsapreBono).toBe(3000)
    expect(m.examenesIsapreValorCompleto).toBe(12000)
    expect(m.insumos).toBe(1200)
    expect(m.cobroNoRealizada).toBe(0) // costoTraslado no aplica si se realizó

    const esperado = 20000 - 5000 + 10000 - 2000 + 11000 - 4000 + 4000 + 15000 + 4000 + 6000 + 7000 + 500 + 3000 + 1200
    expect(m.totalBoleta).toBe(esperado)
    expect(sumIngresos(m)).toBe(m.totalBoleta)
    // El valor completo isapre es informativo: no suma.
    expect(CONCEPTOS_INGRESO.some((c) => c.key === 'examenesIsapreValorCompleto')).toBe(false)
  })

  it('pago enfermera: fee + procedimientos + recargos, neto solo de los descuentos que afectan', () => {
    const m = computeMontosFinancieros(base)
    // fee 20000 (desc no afecta) + proc 21000 − 6000 (desc afecta) + recargos 4000 = 39000 × 50%
    expect(m.pagoEnfermera).toBe(19500)
    expect(m.porcentajeEnfermera).toBe(50)
  })

  it('sin enfermera no hay pago ni porcentaje', () => {
    const m = computeMontosFinancieros({ ...base, tieneEnfermera: false })
    expect(m.pagoEnfermera).toBe(0)
    expect(m.porcentajeEnfermera).toBeNull()
  })

  it('descuadre = costo registrado − total calculado', () => {
    const total = computeMontosFinancieros(base).totalBoleta
    expect(computeMontosFinancieros({ ...base, costoRegistrado: total }).descuadreCostoRegistrado).toBe(0)
    expect(computeMontosFinancieros({ ...base, costoRegistrado: total + 100 }).descuadreCostoRegistrado).toBe(100)
  })

  it('no realizada: los ítems no suman, solo el cobro registrado; la enfermera recibe su % de ese cobro', () => {
    const m = computeMontosFinancieros({ ...base, estado: 'no_realizada' })
    expect(m.cobroNoRealizada).toBe(9000)
    expect(m.totalBoleta).toBe(9000)
    expect(sumIngresos(m)).toBe(9000)
    expect(m.visitaBruto).toBe(0)
    expect(m.curacionesBruto + m.otrosProcedimientosBruto + m.recargos + m.talleres + m.insumos).toBe(0)
    expect(Object.values(m.examenesPorGrupo).every((v) => v === 0)).toBe(true)
    expect(m.examenesIsapreBono + m.examenesIsapreValorCompleto).toBe(0)
    expect(m.pagoEnfermera).toBe(4500)
    expect(m.descuadreCostoRegistrado).toBeNull()
  })

  it('cancelada: todo en 0', () => {
    const m = computeMontosFinancieros({ ...base, estado: 'cancelada' })
    expect(m.totalBoleta).toBe(0)
    expect(m.cobroNoRealizada).toBe(0)
    expect(m.pagoEnfermera).toBe(0)
  })

  it('sin descuentos, los flags "afecta enfermera" quedan vacíos', () => {
    const m = computeMontosFinancieros({
      ...base,
      montoDescuento: 0,
      procedimientos: base.procedimientos.map((p) => ({ ...p, descuento: 0 })),
    })
    expect(m.descuentoVisitaAfectaEnfermera).toBeNull()
    expect(m.descuentoProcedimientosAfectaEnfermera).toBeNull()
  })
})

describe('REPORTE_FINANCIERO_COLUMNS', () => {
  it('keys únicas y una columna por concepto de ingreso', () => {
    const keys = REPORTE_FINANCIERO_COLUMNS.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const c of CONCEPTOS_INGRESO) expect(keys).toContain(c.key)
    expect(keys).toContain('examenesIsapreValorCompleto')
    expect(keys).toContain('totalBoleta')
  })
})

describe('mesesEntre', () => {
  it('incluye ambos extremos y cruza años', () => {
    expect(mesesEntre('2025-11-15', '2026-02-03')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(mesesEntre('2026-03-01', '2026-03-31')).toEqual(['2026-03'])
  })
})

describe('producción', () => {
  it('Producción Visitas = neto de visita + procedimientos + talleres + recargos (sin insumos ni exámenes)', () => {
    const m = computeMontosFinancieros(base)
    // 20000−5000 + 10000−2000 + 11000−4000 + talleres 15000 + recargos 4000
    expect(produccionVisitas(m)).toBe(49000)
    expect(produccionExamenes(m)).toBe(4000 + 6000 + 7000 + 500)
  })

  it('cuadre: Total boleta = Prod. exámenes + IMED a pagar + Prod. visitas + insumos', () => {
    for (const estado of ['realizada', 'no_realizada', 'cancelada']) {
      const m = computeMontosFinancieros({ ...base, estado })
      expect(produccionExamenes(m) + m.examenesIsapreBono + produccionVisitas(m) + m.insumos).toBe(m.totalBoleta)
    }
  })

  it('no realizada: la producción de visitas es el cobro', () => {
    expect(produccionVisitas(computeMontosFinancieros({ ...base, estado: 'no_realizada' }))).toBe(9000)
  })
})

describe('conteo (regla del dashboard)', () => {
  const sinItems = { procedimientos: [], examenes: [], examenesIsapre: [], talleres: [] }

  it('una visita puede sumar en varios tipos', () => {
    const c = computeMontosFinancieros(base).conteo
    expect(c).toEqual({ efectiva: true, noRealizada: false, examen: true, curacion: true, otroProcedimiento: true, taller: true })
  })

  it('visita sin ítems (convenio) cuenta como Otros procedimientos; recargos no cuentan como ítem', () => {
    const c = computeMontosFinancieros({ ...base, ...sinItems }).conteo
    expect(c).toMatchObject({ efectiva: true, examen: false, curacion: false, otroProcedimiento: true, taller: false })
  })

  it('solo isapre cuenta como Exámenes', () => {
    const c = computeMontosFinancieros({ ...base, ...sinItems, examenesIsapre: [{ valorPagar: 1, valorCompleto: 2 }] }).conteo
    expect(c).toMatchObject({ examen: true, otroProcedimiento: false })
  })

  it('no realizadas aparte; canceladas, programadas y confirmadas no cuentan', () => {
    expect(computeMontosFinancieros({ ...base, estado: 'no_realizada' }).conteo).toMatchObject({ efectiva: false, noRealizada: true, examen: false })
    for (const estado of ['cancelada', 'programada', 'confirmada']) {
      expect(computeMontosFinancieros({ ...base, estado }).conteo).toMatchObject({ efectiva: false, noRealizada: false, examen: false, otroProcedimiento: false })
    }
    expect(computeMontosFinancieros({ ...base, estado: 'completada' }).conteo.efectiva).toBe(true)
  })
})

describe('buildResumenMensual', () => {
  const row = (fecha: string, input: Partial<VisitaFinancieraInput>, enf: { id: number | null; nombre?: string } = { id: 1, nombre: 'Ana Pérez' }): ReporteFinancieroRow => ({
    id: 1, fecha, estado: input.estado ?? 'realizada', paciente: null, rut: null, comuna: null,
    idEnfermera: enf.id, enfermera: enf.nombre ?? null,
    origenContacto: null, prevision: null, hogar: null, procedimientos: '', examenes: '', talleres: '', recargos: '',
    conceptoNoRealizada: null, tipoDocumento: null, numeroDocumento: null, pagado: false, fechaPago: null, metodoPago: null,
    montos: computeMontosFinancieros({ ...base, ...input, tieneEnfermera: enf.id !== null }),
  })

  const sinOtro = { examenes: base.examenes.filter((e) => e.grupoExamen !== 'grupo-legacy') }
  const rows = [
    row('2026-01-10', sinOtro),
    row('2026-01-20', { ...sinOtro, porcentajePago: 60 }, { id: 2, nombre: 'Bea Soto' }),
    row('2026-02-05', { estado: 'no_realizada' }),
    row('2026-02-06', { ...sinOtro, procedimientos: [], examenes: [], examenesIsapre: [], talleres: [] }, { id: null }),
  ]
  const resumen = buildResumenMensual({
    rows,
    gastos: [
      { anio: 2026, mes: 1, categoria: 'Factura Imalab', monto: 30000 },
      { anio: 2026, mes: 2, categoria: 'Contador', monto: 10000 },
    ],
    categorias: [
      { categoria: 'Factura Imalab', grupo: 'Facturas laboratorio' },
      { categoria: 'Factura ELSA', grupo: 'Facturas laboratorio' },
      { categoria: 'Contador', grupo: 'Gastos fijos' },
    ],
    meses: ['2026-01', '2026-02'],
  })
  const by = (c: string) => {
    const r = resumen.find((x) => x.concepto === c)
    if (!r) throw new Error(`fila no encontrada: ${c}`)
    return r
  }
  const idx = (c: string) => resumen.findIndex((x) => x.concepto === c)

  it('bloques en el orden del informe de fin de mes', () => {
    const headings = resumen.filter((r) => r.kind === 'heading').map((r) => r.concepto)
    expect(headings).toEqual(['PACIENTES', 'INGRESOS', 'UTILIDAD ANTES DE GASTOS', 'GASTOS TOTALES', 'UTILIDAD ANTES DE IMPUESTOS'])
    expect(resumen.at(-1)).toMatchObject({ concepto: 'Utilidad antes de impuestos + materiales', kind: 'manual' })
  })

  it('conteos por mes', () => {
    expect(by('Total de pacientes (realizadas + completadas)').valores).toEqual({ '2026-01': 2, '2026-02': 1 })
    expect(by('Otros procedimientos (incluye visitas sin ítems)').valores).toEqual({ '2026-01': 2, '2026-02': 1 })
    expect(by('Exámenes (incluye isapre)').valores).toEqual({ '2026-01': 2, '2026-02': 0 })
    expect(by('Visitas no realizadas').valores).toEqual({ '2026-01': 0, '2026-02': 1 })
    expect(by('Visitas no realizadas').kind).toBe('count')
  })

  it('"Exámenes (otro grupo)" no aparece si es 0, y sí si tiene montos', () => {
    expect(resumen.some((r) => r.concepto === 'Exámenes (otro grupo)')).toBe(false)
    const conOtro = buildResumenMensual({ rows: [row('2026-01-10', {})], gastos: [], categorias: [], meses: ['2026-01'] })
    expect(conOtro.find((r) => r.concepto === 'Exámenes (otro grupo)')?.total).toBe(500)
  })

  it('cuadre: Total ingresos = Prod. exámenes + IMED a pagar + Prod. visitas + insumos recuperados', () => {
    for (const p of ['2026-01', '2026-02']) {
      expect(by('Total ingresos').valores[p]).toBe(
        by('Producción Exámenes').valores[p]! + by('Producción de IMED a pagar').valores[p]!
        + by('Producción Visitas').valores[p]! + by('Insumos recuperados').valores[p]!,
      )
    }
    expect(by('Producción IMED producción').valores['2026-01']).toBe(24000)
  })

  it('producción por enfermera suma Producción Visitas (con "Sin enfermera")', () => {
    const a = idx('Producción Visitas')
    const hijos = resumen.slice(a + 1, idx('Total Facturado'))
    expect(hijos.map((h) => h.concepto)).toEqual(['Ana Pérez', 'Bea Soto', 'Sin enfermera'])
    for (const p of ['2026-01', '2026-02']) {
      expect(hijos.reduce((acc, h) => acc + h.valores[p]!, 0)).toBe(by('Producción Visitas').valores[p])
    }
  })

  it('Retención Visitas = Producción Visitas − pago enfermeras; manuales vacías', () => {
    const ret = by('Retención Visitas (Producción Visitas − pago enfermeras)')
    for (const p of ['2026-01', '2026-02']) {
      expect(ret.valores[p]).toBe(by('Producción Visitas').valores[p]! - by('Enfermeras visitas').valores[p]!)
    }
    for (const c of ['Total Facturado', 'Retención Exámenes', 'Retención Impuestos Visitas', 'Utilidad antes de los gastos', 'Utilidad antes de impuestos']) {
      expect(by(c)).toMatchObject({ kind: 'manual', valores: {} })
    }
  })

  it('gastos: pago por enfermera con su %, grupos con subtotal y Gastos totales', () => {
    expect(by('Ana Pérez (50%)').valores).toEqual({ '2026-01': 19500, '2026-02': 4500 })
    expect(by('Bea Soto (60%)').valores['2026-01']).toBe(23400)
    expect(by('Enfermeras visitas').valores).toEqual({ '2026-01': 42900, '2026-02': 4500 })
    expect(by('Facturas laboratorio').valores).toEqual({ '2026-01': 30000, '2026-02': 0 })
    expect(by('Factura ELSA').total).toBe(0)
    expect(idx('Factura Imalab')).toBe(idx('Facturas laboratorio') + 1)
    expect(by('Gastos totales').valores).toEqual({ '2026-01': 72900, '2026-02': 14500 })
  })
})

describe('resumenColumns', () => {
  it('sin columna Total cuando hay un solo mes', () => {
    expect(resumenColumns(['2026-03']).map((c) => c.header)).toEqual(['Concepto', '2026-03'])
    expect(resumenColumns(['2026-02', '2026-03']).map((c) => c.header)).toEqual(['Concepto', '2026-02', '2026-03', 'Total'])
  })
})

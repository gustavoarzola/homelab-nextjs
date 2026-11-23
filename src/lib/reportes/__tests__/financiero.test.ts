import { describe, expect, it } from 'vitest'
import {
  buildResumenMensual,
  computeMontosFinancieros,
  CONCEPTOS_INGRESO,
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

describe('buildResumenMensual', () => {
  const row = (fecha: string, input: Partial<VisitaFinancieraInput>): ReporteFinancieroRow => ({
    id: 1, fecha, estado: input.estado ?? 'realizada', paciente: null, rut: null, comuna: null, enfermera: null,
    origenContacto: null, prevision: null, hogar: null, procedimientos: '', examenes: '', talleres: '', recargos: '',
    conceptoNoRealizada: null, tipoDocumento: null, numeroDocumento: null, pagado: false, fechaPago: null, metodoPago: null,
    montos: computeMontosFinancieros({ ...base, ...input }),
  })

  it('arma ingresos, egresos (pago enfermeras + costos) y resultado por mes', () => {
    const rows = [row('2026-01-10', {}), row('2026-02-05', { estado: 'no_realizada' })]
    const resumen = buildResumenMensual({
      rows,
      costos: [
        { anio: 2026, mes: 1, categoria: 'Laboratorio', monto: 30000 },
        { anio: 2026, mes: 2, categoria: 'Arriendo', monto: 10000 },
      ],
      categorias: ['Arriendo', 'Laboratorio', 'Sin uso'],
      meses: ['2026-01', '2026-02'],
    })
    const by = (c: string) => resumen.find((r) => r.concepto === c)!
    const totalEne = rows[0]!.montos.totalBoleta
    expect(by('Total ingresos').valores).toEqual({ '2026-01': totalEne, '2026-02': 9000 })
    expect(by('Pago enfermeras').valores).toEqual({ '2026-01': 19500, '2026-02': 4500 })
    expect(by('Laboratorio').valores).toEqual({ '2026-01': 30000, '2026-02': 0 })
    expect(by('Sin uso').total).toBe(0)
    expect(by('Total egresos').valores).toEqual({ '2026-01': 49500, '2026-02': 14500 })
    expect(by('RESULTADO').valores).toEqual({ '2026-01': totalEne - 49500, '2026-02': 9000 - 14500 })
    expect(by('RESULTADO').total).toBe(totalEne + 9000 - 49500 - 14500)
  })
})

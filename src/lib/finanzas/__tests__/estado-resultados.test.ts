import { describe, expect, it } from 'vitest'
import { buildEstadoResultados, buildIndicadores, type EerrInput } from '../estado-resultados'

function base(over: Partial<EerrInput> = {}): EerrInput {
  return {
    ingresos: {
      feeVisita: 100_000,
      procedimientos: [
        { categoria: 'curaciones', monto: 30_000 },
        { categoria: 'vacunas', monto: 20_000 },
      ],
      recargos: 7_000,
      examenesPorLab: [
        { grupo: 'imalab', monto: 50_000 },
        { grupo: 'integramédica', monto: 25_000 },
      ],
      talleres: 40_000,
      insumos: 5_000,
      descuentoVisita: 10_000,
      descuentoProcedimientos: 5_000,
      // brutos 277.000 − descuentos 15.000
      totalCobrado: 262_000,
    },
    honorarios: [
      { enfermera: 'Ana Pérez', pago: 60_000 },
      { enfermera: 'Beatriz Soto', pago: 40_000 },
    ],
    tasaRetencion: 15.25,
    gastos: [],
    ...over,
  }
}

const row = (r: ReturnType<typeof buildEstadoResultados>, key: string) => r.rows.find((x) => x.key === key)

describe('buildEstadoResultados', () => {
  it('ingresos netos = brutos − descuentos y cuadra con lo cobrado', () => {
    const r = buildEstadoResultados(base())
    expect(r.totales.ingresosBrutos).toBe(277_000)
    expect(r.totales.descuentos).toBe(15_000)
    expect(r.totales.ingresosNetos).toBe(262_000)
    expect(r.totales.ajusteCuadratura).toBe(0)
    expect(row(r, 'ing-ajuste')).toBeUndefined()
  })

  it('los descuentos se muestran negativos y no cuentan como gasto', () => {
    const r = buildEstadoResultados(base())
    expect(row(r, 'desc-visitas')?.monto).toBe(-10_000)
    expect(row(r, 'desc-procedimientos')?.monto).toBe(-5_000)
    expect(r.totales.gastosOperacionales).toBe(0)
  })

  it('si lo cobrado no cuadra con los componentes, lo muestra como ajuste y mantiene los ingresos netos', () => {
    const input = base()
    input.ingresos.totalCobrado = 262_500
    const r = buildEstadoResultados(input)
    expect(r.totales.ingresosNetos).toBe(262_500)
    expect(r.totales.ajusteCuadratura).toBe(500)
    expect(row(r, 'ing-ajuste')?.monto).toBe(500)
  })

  it('honorarios entran por su monto bruto y la retención no es un costo adicional', () => {
    const r = buildEstadoResultados(base())
    expect(r.totales.honorarios).toBe(100_000)
    expect(r.totales.costosDirectos).toBe(100_000)
    expect(r.totales.retencionHonorarios).toBe(15_250)
    expect(row(r, 'info-liquido')?.monto).toBe(84_750)
    expect(r.totales.margenContribucion).toBe(162_000)
  })

  it('costos directos suman honorarios + laboratorios + insumos + otros', () => {
    const r = buildEstadoResultados(
      base({
        gastos: [
          { categoria: 'costo_laboratorio', descripcion: 'Factura Imalab', monto: 30_000, grupoExamen: 'imalab' },
          { categoria: 'costo_insumos', descripcion: 'Dipromed', monto: 8_000, grupoExamen: null },
          { categoria: 'costo_otro', descripcion: 'Arriendo ECG', monto: 2_000, grupoExamen: null },
        ],
      }),
    )
    expect(r.totales.costosDirectos).toBe(140_000)
    expect(r.totales.margenContribucion).toBe(122_000)
    expect(r.totales.resultado).toBe(122_000)
  })

  it('gastos operacionales bajan el margen y llegan al resultado', () => {
    const r = buildEstadoResultados(
      base({
        gastos: [
          { categoria: 'personal', descripcion: 'Sueldo administración', monto: 50_000, grupoExamen: null },
          { categoria: 'marketing', descripcion: 'Google Ads', monto: 10_000, grupoExamen: null },
        ],
      }),
    )
    expect(r.totales.gastosOperacionales).toBe(60_000)
    expect(r.totales.resultado).toBe(162_000 - 60_000)
  })

  it('una categoría de gasto desconocida cae en "Otros gastos" y no se pierde', () => {
    const r = buildEstadoResultados(
      base({ gastos: [{ categoria: 'legacy', descripcion: 'Dato viejo', monto: 1_234, grupoExamen: null }] }),
    )
    expect(r.totales.gastosOperacionales).toBe(1_234)
    expect(row(r, 'go-otros')?.monto).toBe(1_234)
  })

  it('margen por laboratorio = ingreso del lab − su costo; el costo sin laboratorio se muestra aparte', () => {
    const r = buildEstadoResultados(
      base({
        gastos: [
          { categoria: 'costo_laboratorio', descripcion: 'Imalab', monto: 30_000, grupoExamen: 'imalab' },
          { categoria: 'costo_laboratorio', descripcion: 'Sin lab', monto: 4_000, grupoExamen: null },
        ],
      }),
    )
    expect(row(r, 'ml-lab-imalab')?.monto).toBe(20_000)
    expect(row(r, 'ml-lab-integramédica')?.monto).toBe(25_000)
    expect(row(r, 'ml-lab-sin-asignar')?.monto).toBe(-4_000)
  })

  it('margen de visitas y procedimientos descuenta los descuentos y los honorarios', () => {
    const r = buildEstadoResultados(base())
    // (100.000 + 50.000 + 7.000) − 15.000 − 100.000
    expect(row(r, 'ml-visitas')?.monto).toBe(42_000)
  })

  it('porcentaje sobre ingresos netos; null si no hay ingresos', () => {
    const r = buildEstadoResultados(base())
    expect(row(r, 'margen')?.pctIngresos).toBeCloseTo((162_000 / 262_000) * 100)
    const vacio = buildEstadoResultados({
      ingresos: { feeVisita: 0, procedimientos: [], recargos: 0, examenesPorLab: [], talleres: 0, insumos: 0, descuentoVisita: 0, descuentoProcedimientos: 0, totalCobrado: 0 },
      honorarios: [],
      tasaRetencion: 15.25,
      gastos: [],
    })
    expect(row(vacio, 'margen')?.pctIngresos).toBeNull()
    expect(vacio.totales.resultado).toBe(0)
  })

  it('suma exámenes de un mismo laboratorio repetido y usa la etiqueta del laboratorio', () => {
    const input = base()
    input.ingresos.examenesPorLab = [
      { grupo: 'imalab isapre', monto: 10_000 },
      { grupo: 'imalab isapre', monto: 5_000 },
    ]
    const r = buildEstadoResultados(input)
    expect(row(r, 'ing-examenes')?.monto).toBe(15_000)
    expect(row(r, 'ing-examenes-imalab isapre')?.label).toBe('Imalab · Isapre')
  })

  it('las claves de fila son únicas aunque haya gastos repetidos', () => {
    const r = buildEstadoResultados(
      base({
        gastos: [
          { categoria: 'marketing', descripcion: 'Ads', monto: 1, grupoExamen: null },
          { categoria: 'marketing', descripcion: 'Ads', monto: 1, grupoExamen: null },
        ],
      }),
    )
    const keys = r.rows.map((x) => x.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('buildIndicadores', () => {
  const totales = { ingresosBrutos: 200_000, descuentos: 20_000, ingresosNetos: 180_000, margenContribucion: 90_000 }
  const input = {
    visitas: 3, pacientes: 3, pacientesNuevos: 1, pacientesWeb: 1, visitasConExamenes: 2, examenes: 7,
    vacunas: 1, curaciones: 2, ecg: 0, otrosProcedimientos: 1, talleres: 0, facturadoConBoleta: 150_000, traslados: 0,
  }

  it('calcula ticket promedio, margen por visita y % de descuento', () => {
    const ind = Object.fromEntries(buildIndicadores(input, totales).map((i) => [i.key, i.valor]))
    expect(ind['ticket']).toBe(60_000)
    expect(ind['margen-visita']).toBe(30_000)
    expect(ind['pct-descuento']).toBeCloseTo(10)
  })

  it('no divide por cero sin visitas ni ingresos', () => {
    const ind = Object.fromEntries(
      buildIndicadores({ ...input, visitas: 0 }, { ingresosBrutos: 0, descuentos: 0, ingresosNetos: 0, margenContribucion: 0 }).map((i) => [i.key, i.valor]),
    )
    expect(ind['ticket']).toBe(0)
    expect(ind['pct-descuento']).toBe(0)
  })
})

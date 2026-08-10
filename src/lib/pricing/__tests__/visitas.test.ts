import { describe, expect, it } from 'vitest'
import { computeCostoVisita } from '../visitas'

// `computeCostoVisita` es el núcleo puro extraído de `calcularCostoVisitaPersistida`
// (ver src/lib/pricing/visitas.ts). Los casos acá espejan los escenarios cubiertos
// con BD real en `src/lib/actions/__tests__/visitas-pricing.test.ts` — mismos
// insumos, mismo total esperado — para verificar que la extracción no introdujo
// ninguna desviación respecto a la fórmula persistida que usa la app. Es también
// el cálculo que usa el seed (`src/db/seed/operacion.ts`) al construir cada visita
// en memoria, sin releer la BD.

function base() {
  return {
    procedimientos: [] as { precio: number; descuento: number }[],
    examenes: [] as { precio: number }[],
    exameneIsapre: [] as { valorPagar: number }[],
    talleres: [] as { precio: number }[],
    recargos: [] as { precio: number }[],
    aplicaVisitaEnfermeria: false,
    precioVisita: null as number | null,
    descuentoTipo: 'monto' as const,
    descuentoValor: 0,
    montoInsumos: 0,
  }
}

describe('computeCostoVisita', () => {
  it('suma procedimientos y exámenes sin costo de visita', () => {
    const costo = computeCostoVisita({
      ...base(),
      procedimientos: [{ precio: 12000, descuento: 0 }],
      examenes: [{ precio: 8000 }],
    })

    expect(costo.total).toBe(20000)
    expect(costo.costoVisitaEnfermeria).toBe(0)
  })

  it('agrega costo de visita por comuna cuando solo hay exámenes', () => {
    const costo = computeCostoVisita({
      ...base(),
      examenes: [{ precio: 9000 }],
      aplicaVisitaEnfermeria: true,
      precioVisita: 42000,
    })

    expect(costo.total).toBe(51000)
    expect(costo.costoVisitaEnfermeria).toBe(42000)
  })

  it('sin precio de visita configurado, precioVisitaConfigurado queda en false y no suma nada', () => {
    const costo = computeCostoVisita({
      ...base(),
      examenes: [{ precio: 7000 }],
      aplicaVisitaEnfermeria: true,
      precioVisita: null,
    })

    expect(costo.total).toBe(7000)
    expect(costo.precioVisitaConfigurado).toBe(false)
  })

  it('solo procedimientos suma procedimientos y aplicaVisitaEnfermeria queda en false', () => {
    const costo = computeCostoVisita({
      ...base(),
      procedimientos: [{ precio: 14000, descuento: 0 }],
    })

    expect(costo.total).toBe(14000)
    expect(costo.aplicaVisitaEnfermeria).toBe(false)
  })

  it('visita sin items totaliza cero', () => {
    const costo = computeCostoVisita(base())

    expect(costo.total).toBe(0)
  })

  it('suma el monto de insumos al total', () => {
    const costo = computeCostoVisita({
      ...base(),
      examenes: [{ precio: 9000 }],
      montoInsumos: 4000,
    })

    expect(costo.montoInsumos).toBe(4000)
    expect(costo.total).toBe(13000)
  })

  it('aplica descuento de monto sobre un procedimiento', () => {
    const costo = computeCostoVisita({
      ...base(),
      procedimientos: [{ precio: 14000, descuento: 4000 }],
    })

    expect(costo.subtotalProcedimientosOriginal).toBe(14000)
    expect(costo.montoDescuentoProcedimientos).toBe(4000)
    expect(costo.subtotalProcedimientos).toBe(10000)
    expect(costo.total).toBe(10000)
  })

  it('suma descuentos de varios procedimientos y capea al precio de cada línea', () => {
    const costo = computeCostoVisita({
      ...base(),
      procedimientos: [
        { precio: 10000, descuento: 3000 },
        { precio: 5000, descuento: 999999 }, // descuento excede el precio, se capea
      ],
    })

    expect(costo.subtotalProcedimientosOriginal).toBe(15000)
    expect(costo.montoDescuentoProcedimientos).toBe(8000) // 3000 + 5000 (capeado)
    expect(costo.subtotalProcedimientos).toBe(7000)
  })

  it('aplica descuento porcentual sobre el precio de visita', () => {
    const costo = computeCostoVisita({
      ...base(),
      aplicaVisitaEnfermeria: true,
      precioVisita: 30000,
      descuentoTipo: 'porcentaje',
      descuentoValor: 20,
    })

    expect(costo.costoVisitaEnfermeriaOriginal).toBe(30000)
    expect(costo.montoDescuento).toBe(6000)
    expect(costo.costoVisitaEnfermeria).toBe(24000)
    expect(costo.total).toBe(24000)
  })

  it('suma talleres, recargos y exámenes isapre al total', () => {
    const costo = computeCostoVisita({
      ...base(),
      talleres: [{ precio: 20000 }],
      recargos: [{ precio: 5000 }],
      exameneIsapre: [{ valorPagar: 3000 }],
      examenes: [{ precio: 2000 }],
    })

    expect(costo.subtotalTalleres).toBe(20000)
    expect(costo.subtotalRecargos).toBe(5000)
    expect(costo.subtotalExamenes).toBe(5000) // 2000 examen regular + 3000 isapre
    expect(costo.total).toBe(30000)
  })
})

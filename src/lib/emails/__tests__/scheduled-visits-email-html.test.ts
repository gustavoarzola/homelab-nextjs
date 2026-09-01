import { describe, expect, it } from 'vitest'
import type { VisitaConDetalles } from '@/lib/actions/visitas-asignacion-email'
import { calcNursePaymentBreakdown } from '@/lib/pricing/nurse-payment'
import { generateScheduledVisitsHTML } from '../scheduled-visits-email-html'

type PagoInput = Parameters<typeof calcNursePaymentBreakdown>[0]

function visita(overrides: Partial<VisitaConDetalles> & { pagoInput?: Partial<PagoInput> } = {}): VisitaConDetalles {
  const { pagoInput, ...rest } = overrides
  const pago = calcNursePaymentBreakdown({
    procSum: 0,
    surchargeSum: 0,
    montoVisitaOriginal: 0,
    montoDescuento: 0,
    descuentoAfectaPagoEnfermera: false,
    montoDescuentoProcedimientos: 0,
    descuentoProcedimientosAfectaPagoEnfermera: false,
    porcentaje: 67.5,
    ...pagoInput,
  })
  return {
    id: 1,
    idEnfermera: 10,
    keyOrdenMedica: null,
    fecha: '2026-09-15',
    hora: '09:00',
    paciente: {
      nombres: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: null,
      tipoIdentificador: 'rut', identificador: '11.111.111-1', fechaNacimiento: null,
      correo: null, informacionAdicional: null, previsión: null,
    },
    telefonos: [],
    dirección: { dirección: 'Calle 1', comuna: 'Santiago', areaAdministrativa1: null, areaAdministrativa2: null },
    procedimientos: [],
    exámenes: [],
    talleres: [],
    residenciaAdultoMayor: null,
    informacionAdicional: null,
    costo: 0,
    costoTraslado: 0,
    recargos: [],
    pago,
    ...rest,
  }
}

describe('generateScheduledVisitsHTML — desglose de pago', () => {
  it('renombra la fila de costo del paciente a "Total paciente"', () => {
    const html = generateScheduledVisitsHTML([visita({ costo: 50000 })])
    expect(html).toContain('Total paciente')
    expect(html).not.toMatch(/>Costo</)
  })

  it('muestra la fila de pago estimado con el porcentaje de la enfermera', () => {
    const html = generateScheduledVisitsHTML([
      visita({ pagoInput: { montoVisitaOriginal: 30000, porcentaje: 67.5 } }),
    ])
    expect(html).toContain('Pago estimado (67,5%)')
    expect(html).toContain('$20.250') // 30000 * 0.675
  })

  it('omite las líneas del desglose que están en cero', () => {
    const html = generateScheduledVisitsHTML([
      visita({ pagoInput: { montoVisitaOriginal: 25000 } }),
    ])
    expect(html).toContain('>Visita</td>')
    expect(html).not.toContain('Procedimientos</td>')
    expect(html).not.toContain('Descuento visita')
  })

  it('desglosa visita, descuento, procedimientos y recargo cuando aplican', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        recargos: [{ nombre: 'Recargo nocturno', precio: 6000 }],
        pagoInput: {
          procSum: 12000,
          surchargeSum: 6000,
          montoVisitaOriginal: 30000,
          montoDescuento: 3000,
          descuentoAfectaPagoEnfermera: true,
          montoDescuentoProcedimientos: 2000,
          descuentoProcedimientosAfectaPagoEnfermera: false,
          porcentaje: 67.5,
        },
      }),
    ])
    expect(html).toContain('>Visita</td>')
    expect(html).toContain('Descuento visita')
    expect(html).toContain('−$3.000')
    expect(html).toContain('Procedimientos</td>')
    expect(html).toContain('Recargo (Recargo nocturno)')
    expect(html).toContain('Total estimado a recibir: $30.375') // base 45000 * 0.675
  })

  it('escapa los nombres de recargo', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        recargos: [{ nombre: '<script>x</script>', precio: 1000 }],
        pagoInput: { surchargeSum: 1000, montoVisitaOriginal: 1000 },
      }),
    ])
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('suma el total del día sobre todas las visitas', () => {
    const html = generateScheduledVisitsHTML([
      visita({ id: 1, pagoInput: { montoVisitaOriginal: 20000 } }),
      visita({ id: 2, pagoInput: { montoVisitaOriginal: 40000 } }),
    ])
    // (20000 + 40000) * 0.675 = 40500
    expect(html).toContain('Total estimado a recibir: $40.500')
  })
})

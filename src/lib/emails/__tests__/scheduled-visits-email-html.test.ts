import { describe, expect, it } from 'vitest'
import type { VisitaConDetalles } from '@/lib/actions/visitas-asignacion-email'
import { calcNursePaymentConcepts } from '@/lib/pricing/nurse-payment'
import { generateScheduledVisitsHTML } from '../scheduled-visits-email-html'

type PagoInput = Parameters<typeof calcNursePaymentConcepts>[0]

function visita(overrides: Partial<VisitaConDetalles> & { pagoInput?: Partial<PagoInput> } = {}): VisitaConDetalles {
  const { pagoInput, ...rest } = overrides
  const pago = calcNursePaymentConcepts({
    procSum: 0,
    surchargeSum: 0,
    montoVisitaOriginal: 0,
    montoDescuento: 0,
    descuentoAfectaPagoEnfermera: false,
    montoDescuentoProcedimientos: 0,
    descuentoProcedimientosAfectaPagoEnfermera: false,
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

  it('no muestra las filas de traslado ni de monto de pago', () => {
    const html = generateScheduledVisitsHTML([
      visita({ pagoInput: { montoVisitaOriginal: 30000 } }),
    ])
    expect(html).not.toContain('Traslado')
    expect(html).not.toContain('Pago estimado')
    expect(html).not.toContain('Total estimado a recibir')
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
        },
      }),
    ])
    expect(html).toContain('>Visita</td>')
    expect(html).toContain('$30.000')
    expect(html).toContain('Descuento visita')
    expect(html).toContain('−$3.000')
    expect(html).toContain('Procedimientos</td>')
    expect(html).toContain('Recargo (Recargo nocturno)')
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

  it('el desglose foota su base sin exponer un monto final de pago', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        pagoInput: { montoVisitaOriginal: 20000, procSum: 15000, surchargeSum: 5000 },
      }),
    ])
    expect(html).toContain('$20.000')
    expect(html).toContain('$15.000')
    expect(html).toContain('$5.000')
    expect(html).not.toContain('$27.000') // no aparece base × porcentaje
  })
})

import { describe, expect, it } from 'vitest'
import type { MontosCorreo, VisitaConDetalles } from '@/lib/actions/visitas-asignacion-email'
import { generateScheduledVisitsHTML } from '../scheduled-visits-email-html'

function visita(overrides: Partial<VisitaConDetalles> & { montosInput?: Partial<MontosCorreo> } = {}): VisitaConDetalles {
  const { montosInput, ...rest } = overrides
  return {
    id: 1,
    idEnfermera: 10,
    archivos: [],
    fecha: '2026-09-15',
    hora: '09:00',
    paciente: {
      nombres: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: null,
      tipoIdentificador: 'rut', identificador: '11.111.111-1', fechaNacimiento: null,
      correo: null, informacionAdicional: null, previsión: null,
    },
    telefonos: [],
    dirección: { dirección: 'Calle 1', mapsUrl: null, comuna: 'Santiago', areaAdministrativa1: null, areaAdministrativa2: null },
    procedimientos: [],
    exámenes: [],
    talleres: [],
    residenciaAdultoMayor: null,
    informacionAdicional: null,
    costo: 0,
    recargos: [],
    montos: { visita: 0, procedimientos: 0, recargos: 0, insumos: 0, ...montosInput },
    ...rest,
  }
}

/** Contenido de la fila con el rótulo dado (primera columna de visita). */
const fila = (html: string, label: string) => html.split(`>${label}</td>`)[1]?.split('</tr>')[0] ?? ''
/** Tabla anidada del "Detalle pago" (sus filas internas tienen su propio `</tr>`). */
const detallePago = (html: string) => html.split('>Detalle pago</td>')[1]?.split('</table>')[0] ?? ''

describe('generateScheduledVisitsHTML — montos', () => {
  it('renombra la fila de costo del paciente a "Total paciente"', () => {
    const html = generateScheduledVisitsHTML([visita({ costo: 50000 })])
    expect(html).toContain('Total paciente')
    expect(html).not.toMatch(/>Costo</)
  })

  it('no muestra las filas de traslado ni de monto de pago', () => {
    const html = generateScheduledVisitsHTML([visita({ montosInput: { visita: 30000 } })])
    expect(html).not.toContain('Traslado')
    expect(html).not.toContain('Pago estimado')
    expect(html).not.toContain('Total estimado a recibir')
  })

  it('omite las líneas del detalle que están en cero', () => {
    const html = generateScheduledVisitsHTML([visita({ montosInput: { visita: 25000 } })])
    const detalle = detallePago(html)
    expect(detalle).toContain('>Visita</td>')
    expect(detalle).not.toContain('Procedimientos')
    expect(detalle).not.toContain('Recargos')
    expect(detalle).not.toContain('Insumos')
  })

  it('el detalle muestra una sola línea neta por concepto, sin líneas de descuento', () => {
    const html = generateScheduledVisitsHTML([
      visita({ montosInput: { visita: 27000, procedimientos: 10000, recargos: 6000, insumos: 4000 } }),
    ])
    const detalle = detallePago(html)
    expect(detalle).toContain('>Visita</td>')
    expect(detalle).toContain('$27.000')
    expect(detalle).toContain('>Procedimientos</td>')
    expect(detalle).toContain('$10.000')
    expect(detalle).toContain('>Recargos</td>')
    expect(detalle).toContain('$6.000')
    expect(detalle).toContain('>Insumos</td>')
    expect(detalle).toContain('$4.000')
    expect(html).not.toContain('Descuento')
    expect(html).not.toContain('−')
  })

  it('el detalle no expone un monto final de pago (base × porcentaje)', () => {
    const html = generateScheduledVisitsHTML([
      visita({ montosInput: { visita: 20000, procedimientos: 15000, recargos: 5000 } }),
    ])
    expect(html).not.toContain('$27.000')
  })
})

describe('generateScheduledVisitsHTML — procedimientos, talleres y recargos', () => {
  it('lista procedimientos uno por línea con código y precio neto, sin subtítulo de categoría', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        procedimientos: [
          { codigo: 'CUR1', nombre: 'Curación simple', precio: 10000 },
          { codigo: 'INY', nombre: 'Inyección', precio: 5000 },
        ],
      }),
    ])
    const cell = fila(html, 'Procedimiento(s)')
    expect(cell).toContain('>CUR1</span> Curación simple')
    expect(cell).toContain('— $10.000')
    expect(cell).toContain('>INY</span> Inyección')
    expect(cell).toContain('— $5.000')
    expect(cell.match(/<div /g)?.length).toBe(2)
  })

  it('lista talleres con código y precio', () => {
    const html = generateScheduledVisitsHTML([
      visita({ talleres: [{ codigo: 'TAL', nombre: 'Taller cuidadores', precio: 8000 }] }),
    ])
    const cell = fila(html, 'Taller(es)')
    expect(cell).toContain('>TAL</span> Taller cuidadores')
    expect(cell).toContain('— $8.000')
  })

  it('lista recargos uno por línea con su precio', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        recargos: [
          { nombre: 'Recargo nocturno', precio: 6000 },
          { nombre: 'Fin de semana', precio: 3000 },
        ],
      }),
    ])
    const cell = fila(html, 'Recargo(s)')
    expect(cell).toContain('Recargo nocturno')
    expect(cell).toContain('— $6.000')
    expect(cell).toContain('Fin de semana')
    expect(cell).toContain('— $3.000')
  })

  it('sin ítems las celdas siguen siendo —', () => {
    const html = generateScheduledVisitsHTML([visita()])
    expect(fila(html, 'Procedimiento(s)')).toContain('—')
    expect(fila(html, 'Taller(es)')).toContain('—')
    expect(fila(html, 'Recargo(s)')).toContain('—')
  })

  it('escapa nombres y códigos', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        recargos: [{ nombre: '<script>x</script>', precio: 1000 }],
        procedimientos: [{ codigo: '<b>', nombre: '<i>p</i>', precio: 1000 }],
      }),
    ])
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<i>p</i>')
  })
})

describe('generateScheduledVisitsHTML — adjuntos', () => {
  it('lista los adjuntos de la visita por su nombre de archivo', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        archivos: [
          { key: 'visitas/v1_ana_perez_1.jpg', contentType: 'image/jpeg' },
          { key: 'visitas/v1_ana_perez_2.jpg', contentType: 'image/jpeg' },
        ],
      }),
    ])
    expect(html).toContain('>Adjuntos</td>')
    expect(html).toContain('v1_ana_perez_1.jpg')
    expect(html).toContain('v1_ana_perez_2.jpg')
  })
})

describe('generateScheduledVisitsHTML — exámenes por laboratorio', () => {
  const examen = (o: Partial<VisitaConDetalles['exámenes'][number]> = {}) => ({
    nombre: 'Hemograma', codigo: '0302019', precio: 5000, isapre: false, grupoExamen: 'imalab',
    ...o,
  })

  it('agrupa exámenes del mismo laboratorio bajo un solo subtítulo', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        exámenes: [
          examen({ nombre: 'Hemograma', codigo: 'A1' }),
          examen({ nombre: 'Perfil bioquímico', codigo: 'A2' }),
        ],
      }),
    ])
    expect(html.match(/>Imalab</g)?.length).toBe(1)
    expect(html).toContain('Hemograma')
    expect(html).toContain('Perfil bioquímico')
  })

  it('muestra los subtítulos en el orden de EXAM_GRUPOS (imalab antes que integramédica)', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        exámenes: [
          examen({ codigo: 'IM1', grupoExamen: 'integramédica', nombre: 'Vitamina D' }),
          examen({ codigo: 'A1', grupoExamen: 'imalab', nombre: 'Hemograma' }),
        ],
      }),
    ])
    expect(html).toContain('>Imalab<')
    expect(html).toContain('>Integramédica<')
    expect(html.indexOf('>Imalab<')).toBeLessThan(html.indexOf('>Integramédica<'))
  })

  it('los exámenes isapre van al final y no repiten el sufijo (isapre)', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        exámenes: [
          examen({ codigo: 'ISA', grupoExamen: 'imalab isapre', nombre: 'TSH', isapre: true }),
          examen({ codigo: 'A1', grupoExamen: 'imalab', nombre: 'Hemograma' }),
        ],
      }),
    ])
    expect(html).toContain('Imalab · Isapre')
    expect(html.indexOf('>Imalab<')).toBeLessThan(html.indexOf('Imalab · Isapre'))
    expect(html).not.toContain('(isapre)')
  })

  it('renderiza un grupoExamen desconocido con su valor crudo, al final', () => {
    const html = generateScheduledVisitsHTML([
      visita({
        exámenes: [
          examen({ codigo: 'X1', grupoExamen: 'otro lab', nombre: 'Cultivo' }),
          examen({ codigo: 'A1', grupoExamen: 'imalab', nombre: 'Hemograma' }),
        ],
      }),
    ])
    expect(html).toContain('otro lab')
    expect(html.indexOf('>Imalab<')).toBeLessThan(html.indexOf('otro lab'))
  })

  it('sin exámenes la celda sigue siendo —', () => {
    const html = generateScheduledVisitsHTML([visita({ exámenes: [] })])
    const cell = html.split('>Examen(es)</td>')[1]?.split('</tr>')[0] ?? ''
    expect(cell).toContain('—')
  })
})

describe('generateScheduledVisitsHTML — sin visitas', () => {
  it('dice en el cuerpo que no hay visitas asignadas, con la fecha y el logo', () => {
    const html = generateScheduledVisitsHTML([], '2099-07-17')
    expect(html).toContain('No tienes visitas asignadas')
    expect(html).toContain('cid:')
    expect(html).not.toContain('Visita #')
    expect(html).not.toContain('Detalle pago')
  })
})

import { formatDate, formatDateFull } from '@/lib/format'
import { formatNombre } from '@/lib/paciente'
import { esc, pesos } from '@/lib/cotizacion-html'
import { BRAND_HEX, LOGO_RENDER_WIDTH, LOGO_RENDER_HEIGHT } from '@/lib/brand'
import { EMAIL_LOGO_CID } from '@/lib/email-logo'
import type { VisitaConDetalles } from '@/lib/actions/visitas-asignacion-email'

/**
 * HTML del correo de programación de visitas a una enfermera. La tabla está
 * transpuesta: cada fila es un atributo, cada columna una visita.
 *
 * Módulo puro (sin `'use server'`, sin acceso a BD) para poder testear el
 * markup y previsualizarlo — mismo patrón que `buildCotizacionHTML`.
 */
export function generateScheduledVisitsHTML(visitas: VisitaConDetalles[]): string {
  if (!visitas.length) {
    return '<p>Sin visitas asignadas.</p>'
  }

  const font = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"
  const labelColStyle = `width:150px;min-width:150px;padding:8px 12px;background:${BRAND_HEX.surfaceMuted};font-size:11px;font-weight:600;color:${BRAND_HEX.fgMuted};text-transform:uppercase;letter-spacing:0.06em;vertical-align:middle;border:1px solid ${BRAND_HEX.border};font-family:${font};`
  const dataColStyle = `min-width:180px;padding:8px 12px;font-size:13px;color:${BRAND_HEX.fg};vertical-align:middle;border:1px solid ${BRAND_HEX.border};font-family:${font};`
  const headerColStyle = `min-width:180px;padding:10px 12px;background:${BRAND_HEX.surfaceMuted};font-size:12px;font-weight:600;color:${BRAND_HEX.fg};text-align:center;border:1px solid ${BRAND_HEX.border};font-family:${font};`
  const costoLabelStyle = `width:150px;min-width:150px;padding:8px 12px;background:${BRAND_HEX.surfaceMuted};font-size:11px;color:${BRAND_HEX.fgMuted};text-transform:uppercase;letter-spacing:0.06em;vertical-align:middle;border:1px solid ${BRAND_HEX.border};font-weight:700;font-family:${font};`
  const costoDataStyle = `min-width:180px;padding:8px 12px;font-size:13px;color:${BRAND_HEX.fg};font-weight:700;text-align:right;vertical-align:middle;border:1px solid ${BRAND_HEX.border};font-family:${font};`
  const codeChipStyle = `display:inline-block;padding:1px 5px;border-radius:4px;background:${BRAND_HEX.surfaceMuted};border:1px solid ${BRAND_HEX.border};font-family:'JetBrains Mono',ui-monospace,'SF Mono',monospace;font-size:11px;color:${BRAND_HEX.fgMuted};`
  const examLineStyle = `margin:0 0 3px 0;font-size:13px;color:${BRAND_HEX.fg};`
  const examMutedStyle = `color:${BRAND_HEX.fgMuted};white-space:nowrap;`
  const pagoRowLabelStyle = `padding:1px 10px 1px 0;font-size:13px;color:${BRAND_HEX.fg};`
  const pagoRowAmountStyle = `padding:1px 0;font-size:13px;color:${BRAND_HEX.fgMuted};text-align:right;white-space:nowrap;`

  // Helper to get cell value for each row
  const getValue = (v: VisitaConDetalles, rowIndex: number): string => {
    switch (rowIndex) {
      case 0: return v.hora ?? '—'
      case 1: return formatNombre(v.paciente)
      case 2: return v.paciente.identificador ?? '—'
      case 3: return v.paciente.fechaNacimiento ? formatDate(v.paciente.fechaNacimiento) : '—'
      case 4: return v.telefonos.join(' / ') || '—'
      case 5: return v.paciente.correo
          ? `<a href="mailto:${v.paciente.correo}" style="color:${BRAND_HEX.blue};text-decoration:none;">${v.paciente.correo}</a>`
          : '—'
      case 6: {
          const query = encodeURIComponent(
            [v.dirección.dirección, v.dirección.comuna].filter(Boolean).join(', '),
          )
          const mapsUrl = `https://maps.google.com/?q=${query}`
          return `${v.dirección.dirección} <a href="${mapsUrl}" style="color:${BRAND_HEX.blue};text-decoration:none;font-size:14px;" title="Abrir en Maps">📍</a>`
        }
      case 7: return v.dirección.comuna ?? '—'
      case 8: return v.paciente.previsión ?? '—'
      case 9: return v.residenciaAdultoMayor ?? '—'
      case 10: return v.procedimientos.join(', ') || '—'
      case 11: {
          if (!v.exámenes.length) return '—'
          return v.exámenes
            .map((e) =>
              `<div style="${examLineStyle}">`
              + `<span style="${codeChipStyle}">${esc(e.codigo)}</span> `
              + `${esc(e.nombre)}${e.isapre ? ` <span style="${examMutedStyle}">(isapre)</span>` : ''} `
              + `<span style="${examMutedStyle}">— ${pesos(e.precio)}</span>`
              + `</div>`,
            )
            .join('')
        }
      case 12: return v.talleres.join(', ') || '—'
      case 13: return v.paciente.informacionAdicional || '—'
      case 14: return v.informacionAdicional || '—'
      default: return '—'
    }
  }

  const rowLabels = [
    'Hora de atención',
    'Nombre completo',
    'RUT / Identificador',
    'Fecha de nacimiento',
    'Teléfono(s)',
    'Correo electrónico',
    'Dirección',
    'Comuna',
    'Previsión de salud',
    'Residencia',
    'Procedimiento(s)',
    'Examen(es)',
    'Taller(es)',
    'Notas paciente',
    'Información adicional',
  ]

  // Header row: "Visita #ID", one per visit
  const headerCells = visitas
    .map((v) => `<td style="${headerColStyle}">Visita #${v.id}</td>`)
    .join('')

  // Data rows
  const dataRows = rowLabels
    .map((label, rowIndex) => {
      const dataCells = visitas
        .map((v) => `<td style="${dataColStyle}">${getValue(v, rowIndex)}</td>`)
        .join('')
      return `<tr><td style="${labelColStyle}">${label}</td>${dataCells}</tr>`
    })
    .join('')

  const money = (n: number) => `$${n.toLocaleString('es-CL')}`

  // Filas de montos del paciente (bold, distinct style)
  const costoCells = visitas
    .map((v) => `<td style="${costoDataStyle}">${money(v.costo)}</td>`)
    .join('')
  const costoRow = `<tr><td style="${costoLabelStyle}">Total paciente</td>${costoCells}</tr>`

  const trasladoCells = visitas
    .map((v) => `<td style="${costoDataStyle}">${v.costoTraslado > 0 ? money(v.costoTraslado) : '—'}</td>`)
    .join('')
  const trasladoRow = `<tr><td style="${costoLabelStyle}">Traslado</td>${trasladoCells}</tr>`

  const recargoCells = visitas
    .map((v) => {
      if (!v.recargos.length) return `<td style="${costoDataStyle}">—</td>`
      const total = v.recargos.reduce((s, r) => s + r.precio, 0)
      const names = v.recargos.map((r) => esc(r.nombre)).join(', ')
      return `<td style="${costoDataStyle}">${money(total)} (${names})</td>`
    })
    .join('')
  const recargoRow = `<tr><td style="${costoLabelStyle}">Recargo</td>${recargoCells}</tr>`

  // ── Desglose del pago a la enfermera ──
  const desglosePagoCell = (v: VisitaConDetalles): string => {
    const { pago } = v
    const lineas: Array<[string, number]> = []
    if (pago.feeVisita > 0) lineas.push(['Visita', pago.feeVisita])
    if (pago.descuentoVisita > 0) lineas.push(['Descuento visita', -pago.descuentoVisita])
    if (pago.procedimientos > 0) lineas.push(['Procedimientos', pago.procedimientos])
    if (pago.descuentoProcedimientos > 0) lineas.push(['Descuento procedimientos', -pago.descuentoProcedimientos])
    if (pago.recargos > 0) {
      const nombres = v.recargos.map((r) => r.nombre).join(', ')
      lineas.push([nombres ? `Recargo (${esc(nombres)})` : 'Recargo', pago.recargos])
    }
    if (!lineas.length) return '—'
    const filas = lineas
      .map(([label, monto]) =>
        `<tr>`
        + `<td style="${pagoRowLabelStyle}">${label}</td>`
        + `<td style="${pagoRowAmountStyle}">${monto < 0 ? '−' : ''}${money(Math.abs(monto))}</td>`
        + `</tr>`,
      )
      .join('')
    return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tbody>${filas}</tbody></table>`
  }

  const desglosePagoCells = visitas
    .map((v) => `<td style="${dataColStyle}">${desglosePagoCell(v)}</td>`)
    .join('')
  const desglosePagoRow = `<tr><td style="${labelColStyle}">Detalle pago</td>${desglosePagoCells}</tr>`

  const porcentaje = visitas[0]?.pago.porcentaje ?? 0
  const porcentajeLabel = porcentaje.toLocaleString('es-CL', { maximumFractionDigits: 2 })
  const pagoCells = visitas
    .map((v) => `<td style="${costoDataStyle}">${money(v.pago.pago)}</td>`)
    .join('')
  const pagoRow = `<tr><td style="${costoLabelStyle}">Pago estimado (${porcentajeLabel}%)</td>${pagoCells}</tr>`

  const totalPagoDia = visitas.reduce((s, v) => s + v.pago.pago, 0)

  const table = `
    <div style="overflow-x:auto;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${font};">
        <tr>
          <td style="width:150px;min-width:150px;padding:10px 12px;background:${BRAND_HEX.surfaceMuted};border:1px solid ${BRAND_HEX.border};"></td>
          ${headerCells}
        </tr>
        ${dataRows}
        ${costoRow}
        ${trasladoRow}
        ${recargoRow}
        ${desglosePagoRow}
        ${pagoRow}
      </table>
    </div>
  `

  return `
    <div style="max-width:100%;margin:0 auto;background:${BRAND_HEX.surface};font-family:${font};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_HEX.surface};border-bottom:2px solid ${BRAND_HEX.blue};margin-bottom:16px;">
        <tr>
          <td style="padding:20px 24px;vertical-align:middle;">
            <img src="cid:${EMAIL_LOGO_CID}" alt="HomeLab" width="${LOGO_RENDER_WIDTH}" height="${LOGO_RENDER_HEIGHT}" style="display:block;height:${LOGO_RENDER_HEIGHT}px;width:auto;border:0;" />
          </td>
          <td style="padding:20px 24px;vertical-align:middle;text-align:right;">
            <p style="margin:0 0 4px 0;font-size:16px;font-weight:600;color:${BRAND_HEX.fg};letter-spacing:-0.01em;">Programación de Visitas</p>
            <p style="margin:0;font-size:12px;color:${BRAND_HEX.fgMuted};">${formatDateFull(visitas[0]?.fecha ?? '')}</p>
          </td>
        </tr>
      </table>

      ${table}

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background:${BRAND_HEX.surfaceMuted};border:1px solid ${BRAND_HEX.border};border-radius:6px;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:${BRAND_HEX.fg};">
              Total estimado a recibir: ${money(totalPagoDia)}
            </p>
            <p style="margin:0;font-size:11px;color:${BRAND_HEX.fgMuted};line-height:1.5;">
              Monto <strong>estimado</strong>: las visitas aún no se realizan y el total puede cambiar si
              se agregan o quitan ítems. Se calcula sobre el valor de visita, procedimientos y recargos
              (${porcentajeLabel}%); no incluye exámenes, talleres ni insumos.
            </p>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BRAND_HEX.border};margin-top:16px;">
        <tr>
          <td style="padding:16px;font-size:11px;color:${BRAND_HEX.fgSubtle};text-align:center;">
            <p style="margin:0 0 4px 0;">Este es un correo automático de programación de visitas.</p>
            <p style="margin:0;">Por favor, no responda a este correo.</p>
          </td>
        </tr>
      </table>
    </div>
  `
}

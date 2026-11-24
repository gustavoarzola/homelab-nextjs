import { formatDate, formatDateFull } from '@/lib/format'
import { formatNombre } from '@/lib/paciente'
import { formatRut } from '@/lib/rut'
import { esc, pesos } from '@/lib/cotizacion-html'
import { basename } from '@/lib/archivos/nombres'
import { BRAND_HEX, LOGO_RENDER_WIDTH, LOGO_RENDER_HEIGHT } from '@/lib/brand'
import { EMAIL_LOGO_CID } from '@/lib/email-logo'
import { EXAM_GRUPOS, EXAM_GRUPO_LABELS, EXAM_GRUPO_META, type ExamGrupo } from '@/lib/exam-grupos'
import type { ExamenCorreo, ItemCorreo, VisitaConDetalles } from '@/lib/actions/visitas-asignacion-email'

/**
 * HTML del correo de programación de visitas a una enfermera. La tabla está
 * transpuesta: cada fila es un atributo, cada columna una visita.
 *
 * Módulo puro (sin `'use server'`, sin acceso a BD) para poder testear el
 * markup y previsualizarlo — mismo patrón que `buildCotizacionHTML`.
 */
export function generateScheduledVisitsHTML(
  visitas: VisitaConDetalles[],
  fecha: string = visitas[0]?.fecha ?? '',
): string {
  const font = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"

  const header = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_HEX.surface};border-bottom:2px solid ${BRAND_HEX.blue};margin-bottom:16px;">
        <tr>
          <td style="padding:20px 24px;vertical-align:middle;">
            <img src="cid:${EMAIL_LOGO_CID}" alt="HomeLab" width="${LOGO_RENDER_WIDTH}" height="${LOGO_RENDER_HEIGHT}" style="display:block;height:${LOGO_RENDER_HEIGHT}px;width:auto;border:0;" />
          </td>
          <td style="padding:20px 24px;vertical-align:middle;text-align:right;">
            <p style="margin:0 0 4px 0;font-size:16px;font-weight:600;color:${BRAND_HEX.fg};letter-spacing:-0.01em;">Programación de Visitas</p>
            <p style="margin:0;font-size:12px;color:${BRAND_HEX.fgMuted};">${formatDateFull(fecha)}</p>
          </td>
        </tr>
      </table>`

  const footer = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BRAND_HEX.border};margin-top:16px;">
        <tr>
          <td style="padding:16px;font-size:11px;color:${BRAND_HEX.fgSubtle};text-align:center;">
            <p style="margin:0 0 4px 0;">Este es un correo automático de programación de visitas.</p>
            <p style="margin:0;">Por favor, no responda a este correo.</p>
          </td>
        </tr>
      </table>`

  if (!visitas.length) {
    return `
    <div style="max-width:100%;margin:0 auto;background:${BRAND_HEX.surface};font-family:${font};">
      ${header}

      <div style="padding:32px 24px;text-align:center;">
        <p style="margin:0 0 8px 0;font-size:18px;font-weight:600;color:${BRAND_HEX.fg};">
          No tienes visitas asignadas para el ${formatDateFull(fecha)}.
        </p>
        <p style="margin:0;font-size:13px;color:${BRAND_HEX.fgMuted};line-height:1.5;">
          Si crees que es un error, comunícate con coordinación.
        </p>
      </div>

      ${footer}
    </div>
  `
  }
  const labelColStyle = `width:150px;min-width:150px;padding:8px 12px;background:${BRAND_HEX.surfaceMuted};font-size:11px;font-weight:600;color:${BRAND_HEX.fgMuted};text-transform:uppercase;letter-spacing:0.06em;vertical-align:middle;border:1px solid ${BRAND_HEX.border};font-family:${font};`
  const dataColStyle = `min-width:180px;padding:8px 12px;font-size:13px;color:${BRAND_HEX.fg};vertical-align:middle;border:1px solid ${BRAND_HEX.border};font-family:${font};`
  const headerColStyle = `min-width:180px;padding:10px 12px;background:${BRAND_HEX.surfaceMuted};font-size:12px;font-weight:600;color:${BRAND_HEX.fg};text-align:center;border:1px solid ${BRAND_HEX.border};font-family:${font};`
  const costoLabelStyle = `width:150px;min-width:150px;padding:8px 12px;background:${BRAND_HEX.surfaceMuted};font-size:11px;color:${BRAND_HEX.fgMuted};text-transform:uppercase;letter-spacing:0.06em;vertical-align:middle;border:1px solid ${BRAND_HEX.border};font-weight:700;font-family:${font};`
  const costoDataStyle = `min-width:180px;padding:8px 12px;font-size:13px;color:${BRAND_HEX.fg};font-weight:700;text-align:right;vertical-align:middle;border:1px solid ${BRAND_HEX.border};font-family:${font};`
  const codeChipStyle = `display:inline-block;padding:1px 5px;border-radius:4px;background:${BRAND_HEX.surfaceMuted};border:1px solid ${BRAND_HEX.border};font-family:'JetBrains Mono',ui-monospace,'SF Mono',monospace;font-size:11px;color:${BRAND_HEX.fgMuted};`
  const examLineStyle = `margin:0 0 3px 0;font-size:13px;color:${BRAND_HEX.fg};`
  const examMutedStyle = `color:${BRAND_HEX.fgMuted};white-space:nowrap;`
  const examGroupStyle = `margin:6px 0 2px 0;font-size:11px;font-weight:600;color:${BRAND_HEX.fgMuted};text-transform:uppercase;letter-spacing:0.06em;`
  const examGroupFirstStyle = examGroupStyle.replace('margin:6px 0 2px 0', 'margin:0 0 2px 0')
  /** Una línea por ítem: `[código] Nombre (sufijo) — $precio`. Mismo formato para exámenes, procedimientos, talleres y recargos. */
  const itemLinea = (i: { codigo?: string; nombre: string; precio: number; sufijo?: string }) =>
    `<div style="${examLineStyle}">`
    + (i.codigo ? `<span style="${codeChipStyle}">${esc(i.codigo)}</span> ` : '')
    + `${esc(i.nombre)}${i.sufijo ? ` <span style="${examMutedStyle}">${esc(i.sufijo)}</span>` : ''} `
    + `<span style="${examMutedStyle}">— ${pesos(i.precio)}</span>`
    + `</div>`
  const itemsCell = (items: ItemCorreo[]) => (items.length ? items.map(itemLinea).join('') : '—')

  const pagoRowLabelStyle = `padding:1px 10px 1px 0;font-size:13px;color:${BRAND_HEX.fg};`
  const pagoRowAmountStyle = `padding:1px 0;font-size:13px;color:${BRAND_HEX.fgMuted};text-align:right;white-space:nowrap;`

  // Helper to get cell value for each row
  const getValue = (v: VisitaConDetalles, rowIndex: number): string => {
    switch (rowIndex) {
      case 0: return v.hora ?? '—'
      case 1: return formatNombre(v.paciente)
      case 2:
        if (!v.paciente.identificador) return '—'
        return v.paciente.tipoIdentificador === 'rut'
          ? formatRut(v.paciente.identificador)
          : v.paciente.identificador
      case 3: return v.paciente.fechaNacimiento ? formatDate(v.paciente.fechaNacimiento) : '—'
      case 4: return v.telefonos.join(' / ') || '—'
      case 5: return v.paciente.correo
          ? `<a href="mailto:${v.paciente.correo}" style="color:${BRAND_HEX.blue};text-decoration:none;">${v.paciente.correo}</a>`
          : '—'
      case 6: {
          if (!v.dirección.dirección) return '—'
          const texto = esc(v.dirección.dirección)
          if (!v.dirección.mapsUrl) return texto
          return `${texto} <a href="${esc(v.dirección.mapsUrl)}" style="color:${BRAND_HEX.blue};text-decoration:none;font-size:14px;" title="Abrir en Maps">📍</a>`
        }
      case 7: return v.dirección.comuna ?? '—'
      case 8: return v.paciente.previsión ?? '—'
      case 9: return v.residenciaAdultoMayor ?? '—'
      case 10: return itemsCell(v.procedimientos)
      case 11: {
          if (!v.exámenes.length) return '—'

          // Agrupar por laboratorio (`grupoExamen`), preservando el orden de llegada.
          const porGrupo = new Map<string, ExamenCorreo[]>()
          for (const e of v.exámenes) {
            const arr = porGrupo.get(e.grupoExamen) ?? []
            arr.push(e)
            porGrupo.set(e.grupoExamen, arr)
          }

          // Orden de grupos: el de EXAM_GRUPOS; los desconocidos van al final.
          const grupoRank = (g: string) => {
            const i = (EXAM_GRUPOS as readonly string[]).indexOf(g)
            return i === -1 ? EXAM_GRUPOS.length : i
          }
          const grupos = [...porGrupo.keys()].sort((a, b) => grupoRank(a) - grupoRank(b))

          const examLinea = (e: ExamenCorreo, grupoEsIsapre: boolean) =>
            itemLinea({ ...e, sufijo: e.isapre && !grupoEsIsapre ? '(isapre)' : undefined })

          return grupos
            .map((grupo, idx) => {
              const label = EXAM_GRUPO_LABELS[grupo as ExamGrupo] ?? grupo
              const grupoEsIsapre = EXAM_GRUPO_META[grupo as ExamGrupo]?.tipo === 'isapre'
              const heading = `<div style="${idx === 0 ? examGroupFirstStyle : examGroupStyle}">${esc(label)}</div>`
              const lineas = porGrupo.get(grupo)!.map((e) => examLinea(e, grupoEsIsapre)).join('')
              return heading + lineas
            })
            .join('')
        }
      case 12: return itemsCell(v.talleres)
      case 13: return v.paciente.informacionAdicional || '—'
      case 14: return v.informacionAdicional || '—'
      case 15:
        return v.archivos.length
          ? v.archivos
              .map((a) => `<div style="${examLineStyle}">${esc(basename(a.key))}</div>`)
              .join('')
          : '—'
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
    'Adjuntos',
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

  const recargoCells = visitas
    .map((v) => `<td style="${dataColStyle}">${v.recargos.length ? v.recargos.map(itemLinea).join('') : '—'}</td>`)
    .join('')
  const recargoRow = `<tr><td style="${labelColStyle}">Recargo(s)</td>${recargoCells}</tr>`

  // ── Detalle de montos (todos netos de descuentos) ──
  const desglosePagoCell = (v: VisitaConDetalles): string => {
    const { montos } = v
    const lineas: Array<[string, number]> = []
    if (montos.visita > 0) lineas.push(['Visita', montos.visita])
    if (montos.procedimientos > 0) lineas.push(['Procedimientos', montos.procedimientos])
    if (montos.examenes > 0) lineas.push(['Exámenes', montos.examenes])
    if (montos.talleres > 0) lineas.push(['Talleres', montos.talleres])
    if (montos.recargos > 0) lineas.push(['Recargos', montos.recargos])
    if (montos.insumos > 0) lineas.push(['Insumos', montos.insumos])
    if (!lineas.length) return '—'
    const filas = lineas
      .map(([label, monto]) =>
        `<tr>`
        + `<td style="${pagoRowLabelStyle}">${label}</td>`
        + `<td style="${pagoRowAmountStyle}">${money(monto)}</td>`
        + `</tr>`,
      )
      .join('')
    return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tbody>${filas}</tbody></table>`
  }

  const desglosePagoCells = visitas
    .map((v) => `<td style="${dataColStyle}">${desglosePagoCell(v)}</td>`)
    .join('')
  const desglosePagoRow = `<tr><td style="${labelColStyle}">Detalle pago</td>${desglosePagoCells}</tr>`

  const table = `
    <div style="overflow-x:auto;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${font};">
        <tr>
          <td style="width:150px;min-width:150px;padding:10px 12px;background:${BRAND_HEX.surfaceMuted};border:1px solid ${BRAND_HEX.border};"></td>
          ${headerCells}
        </tr>
        ${dataRows}
        ${recargoRow}
        ${costoRow}
        ${desglosePagoRow}
      </table>
    </div>
  `

  return `
    <div style="max-width:100%;margin:0 auto;background:${BRAND_HEX.surface};font-family:${font};">
      ${header}

      ${table}

      <p style="margin:8px 0 0 0;font-size:11px;color:${BRAND_HEX.fgMuted};line-height:1.5;">
        Todos los valores incluyen los descuentos aplicados. El <strong>Detalle pago</strong> suma el
        Total paciente. Puede variar si la visita cambia antes de realizarse.
      </p>

      ${footer}
    </div>
  `
}

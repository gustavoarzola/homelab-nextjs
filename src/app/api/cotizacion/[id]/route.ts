import { getCotizacionVisita } from '@/lib/actions/precios'
import { formatDate, formatDateLong } from '@/lib/format'
import { formatRut } from '@/lib/rut'
import type { CotizacionVisita, ItemCotizacion } from '@/lib/actions/precios'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const data = await getCotizacionVisita(Number(id))

  if (!data) {
    return new Response('Visita no encontrada', { status: 404 })
  }

  const html = buildCotizacionHTML(data)

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatId(tipo: string | null, valor: string | null): string {
  if (!valor) return ''
  if (tipo === 'rut') return esc(formatRut(valor))
  if (tipo === 'pasaporte') return `Pasaporte ${esc(valor)}`
  return esc(valor)
}

function pesos(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}

const PREVISION_LABELS: Record<string, string> = {
  fonasa: 'Fonasa',
  isapre: 'Isapre',
  particular: 'Particular',
}

// ─── Main HTML builder ────────────────────────────────────────────────────────

function buildCotizacionHTML(data: CotizacionVisita): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  const numeroDoc = `COT-${String(data.id).padStart(5, '0')}`
  const visitaRef = `VIS-${String(data.id).padStart(5, '0')}`

  const examenes = data.items.filter((i) => i.tipo === 'examen')
  const procedimientos = data.items.filter((i) => i.tipo === 'procedimiento')
  const visitaItem = data.items.find((i) => i.tipo === 'visita')

  // ── Campos paciente ──
  const pacienteFields = [
    { label: 'Nombre completo', value: esc(data.paciente.nombreCompleto) },
    data.paciente.identificador
      ? { label: data.paciente.tipoIdentificador === 'rut' ? 'RUT' : data.paciente.tipoIdentificador === 'pasaporte' ? 'Pasaporte' : 'Identificador', value: formatId(data.paciente.tipoIdentificador, data.paciente.identificador) }
      : null,
    data.paciente.fechaNacimiento
      ? { label: 'Fecha de nacimiento', value: esc(formatDate(data.paciente.fechaNacimiento)) }
      : null,
    data.paciente.prevision
      ? { label: 'Previsión', value: `${esc(data.paciente.prevision)} <span style="font-size:11px;color:#94a3b8;">(${PREVISION_LABELS[data.tipoPrevision] ?? ''})</span>` }
      : null,
    data.paciente.direccion
      ? { label: 'Dirección', value: esc(data.paciente.direccion), small: true }
      : null,
  ]
    .filter(Boolean)
    .map(
      (f) =>
        `<div style="margin-bottom:8px;">
          <span style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:1px;">${f!.label}</span>
          <span style="font-size:${f!.small ? 12 : 13}px;color:#1e2835;font-weight:500;">${f!.value}</span>
        </div>`,
    )
    .join('')

  // ── Campos visita ──
  const visitaFields = [
    { label: 'Fecha', value: esc(formatDateLong(data.fecha)) },
    data.hora ? { label: 'Hora', value: esc(data.hora.slice(0, 5)) } : null,
    data.enfermera ? { label: 'Enfermera', value: esc(data.enfermera) } : null,
    data.laboratorio ? { label: 'Laboratorio', value: esc(data.laboratorio), small: true } : null,
    { label: 'N° de referencia', value: `<span style="font-family:monospace;font-size:12px;">${esc(visitaRef)}</span>` },
  ]
    .filter(Boolean)
    .map(
      (f) =>
        `<div style="margin-bottom:8px;">
          <span style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:1px;">${f!.label}</span>
          <span style="font-size:${f!.small ? 12 : 13}px;color:#1e2835;font-weight:500;">${f!.value}</span>
        </div>`,
    )
    .join('')

  // ── Filas de ítems ──
  function itemRows(items: ItemCotizacion[], startIdx: number, noPrice: boolean): string {
    return items
      .map((item, i) => {
        const precioCell = noPrice
          ? `<span style="font-size:11px;color:#94a3b8;">incluido</span>`
          : item.precio !== null
            ? `<strong>${esc(pesos(item.precio))}</strong>`
            : `<span style="font-size:11px;color:#94a3b8;">Sin precio configurado</span>`
        return `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:11px 14px;color:#94a3b8;font-size:12px;text-align:right;padding-right:16px;">${startIdx + i + 1}</td>
            <td style="padding:11px 14px;color:#1e2835;font-size:13px;">${esc(item.descripcion)}</td>
            <td style="padding:11px 14px;color:#94a3b8;font-size:11px;font-family:monospace;">${esc(item.codigo)}</td>
            <td style="padding:11px 14px;text-align:right;font-variant-numeric:tabular-nums;font-size:13px;">${precioCell}</td>
          </tr>`
      })
      .join('')
  }

  function groupHeader(label: string): string {
    return `<tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      <td colspan="4" style="padding:7px 14px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;">${label}</td>
    </tr>`
  }

  function subtotalRow(label: string, amount: number): string {
    return `<tr style="background:#f8fafc;border-top:1px solid #e2e8f0;">
      <td colspan="3" style="padding:10px 14px;font-size:12px;color:#64748b;">${label}</td>
      <td style="padding:10px 14px;text-align:right;font-weight:600;font-size:13px;color:#1e2835;">${pesos(amount)}</td>
    </tr>`
  }

  let itemsHTML = ''
  let idx = 0

  if (examenes.length > 0) {
    itemsHTML += groupHeader('Exámenes de laboratorio')
    itemsHTML += itemRows(examenes, idx, false)
    idx += examenes.length
  }

  if (procedimientos.length > 0) {
    itemsHTML += groupHeader('Procedimientos de enfermería')
    itemsHTML += itemRows(procedimientos, idx, false)
    idx += procedimientos.length
  }

  if (visitaItem) {
    itemsHTML += groupHeader('Traslado y atención')
    itemsHTML += itemRows([visitaItem], idx, false)
  }

  if (examenes.length > 0 && data.subtotalExamenes > 0) {
    itemsHTML += subtotalRow('Subtotal exámenes', data.subtotalExamenes)
  }
  const subtotalProcedimientos = procedimientos.reduce((s, p) => s + (p.precio ?? 0), 0)
  if (subtotalProcedimientos > 0) {
    itemsHTML += subtotalRow('Subtotal procedimientos', subtotalProcedimientos)
  }
  if (data.costoVisitaEnfermeria > 0) {
    itemsHTML += subtotalRow('Visita de enfermería', data.costoVisitaEnfermeria)
  }
  if (data.montoRecargo > 0 && data.razonRecargo) {
    itemsHTML += subtotalRow(data.razonRecargo, data.montoRecargo)
  }

  const totalCell =
    data.total > 0
      ? `<span style="font-size:20px;font-weight:700;">${pesos(data.total)}</span>`
      : `<span style="font-size:13px;font-weight:400;color:#94a3b8;">Sin precios configurados</span>`

  itemsHTML += `<tr style="background:#1e2835;">
    <td colspan="3" style="padding:14px;font-size:11px;font-weight:600;letter-spacing:0.5px;color:#ffffff;">Total cotización</td>
    <td style="padding:14px;text-align:right;color:#ffffff;">${totalCell}</td>
  </tr>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cotización ${esc(numeroDoc)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #1e2835;
      background: #f0f2f5;
      line-height: 1.5;
    }
    .print-bar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: #1e2835;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-bar p { font-size: 12px; color: #94a3b8; }
    .print-bar button {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      color: #1e2835;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .page {
      max-width: 800px;
      margin: 32px auto;
      background: #ffffff;
      box-shadow: 0 4px 32px rgba(0,0,0,0.10);
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .notes {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 11px;
      color: #92400e;
      line-height: 1.6;
    }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { background: #ffffff; }
      .page { margin: 0; padding: 1.5cm 2cm; box-shadow: none; max-width: none; }
      .print-bar { display: none; }
      @page { margin: 0; }
    }
    @media (max-width: 640px) {
      .info-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <!-- Print bar -->
  <div class="print-bar">
    <p>Cotización ${esc(numeroDoc)} &middot; ${esc(data.paciente.nombreCompleto)}</p>
    <button onclick="window.print()">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      Imprimir / Descargar PDF
    </button>
  </div>

  <div class="page">
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e2835;">
      <tr>
        <td style="padding:28px 40px;">
          <p style="margin:0 0 3px;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Homelab</p>
          <p style="margin:0;font-size:11px;color:#94a3b8;letter-spacing:0.5px;">Atención de Enfermería a Domicilio</p>
        </td>
        <td style="padding:28px 40px;text-align:right;">
          <span style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:2px;">Cotización</span>
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${esc(numeroDoc)}</span>
          <p style="margin:4px 0 0;font-size:11px;color:#cbd5e1;">Emitida el ${esc(formatDateLong(today))}</p>
        </td>
      </tr>
    </table>

    <!-- Body -->
    <div style="padding:36px 40px;">

      <!-- Info grid -->
      <div class="info-grid" style="margin-bottom:32px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;">
          <p style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin-bottom:10px;">Paciente</p>
          ${pacienteFields}
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;">
          <p style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin-bottom:10px;">Datos de la visita</p>
          ${visitaFields}
        </div>
      </div>

      <!-- Items table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 14px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;border-bottom:1px solid #e2e8f0;width:44px;">#</th>
            <th style="padding:10px 14px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:left;">Descripción</th>
            <th style="padding:10px 14px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;border-bottom:1px solid #e2e8f0;width:90px;">Código</th>
            <th style="padding:10px 14px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:right;width:120px;">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <!-- Notes -->
      <div class="notes" style="margin-top:32px;">
        <strong>Nota:</strong> Esta cotización es referencial y tiene una validez de 30 días desde su emisión. Los precios pueden variar según disponibilidad. Para confirmar su visita, contáctenos al número indicado.
      </div>

      <!-- Footer -->
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <p style="font-size:10px;color:#94a3b8;">Homelab &middot; Atención de Enfermería a Domicilio</p>
        <p style="font-size:10px;color:#94a3b8;">Emitida el ${esc(formatDateLong(today))}</p>
      </div>

    </div>
  </div>
</body>
</html>`
}

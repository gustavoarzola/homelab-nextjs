import { db } from '@/db'
import {
  quotations,
  quotationExams,
  quotationProcedures,
  patients,
  surchargeTypes,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { formatDateLong, todaySantiago } from '@/lib/format'
import { formatNombre } from '@/lib/paciente'
import { getPrecioVisitaEnfermeria } from '@/lib/pricing/visitas'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const cotizacionId = Number(id)
  if (isNaN(cotizacionId)) {
    return new Response('ID inválido', { status: 400 })
  }

  // Load quotation
  const [quotation] = await db.select().from(quotations).where(eq(quotations.id, cotizacionId))
  if (!quotation) {
    return new Response('Cotización no encontrada', { status: 404 })
  }

  // Load items, patient, surcharge type in parallel
  const [examItems, procItems, patientRow, surchargeRow] = await Promise.all([
    db
      .select({ descripcion: quotationExams.descripcion, codigo: quotationExams.codigo, precio: quotationExams.precio })
      .from(quotationExams)
      .where(eq(quotationExams.idCotizacion, cotizacionId)),
    db
      .select({ descripcion: quotationProcedures.descripcion, codigo: quotationProcedures.codigo, precio: quotationProcedures.precio })
      .from(quotationProcedures)
      .where(eq(quotationProcedures.idCotizacion, cotizacionId)),
    quotation.idPaciente
      ? db.select().from(patients).where(eq(patients.id, quotation.idPaciente)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    quotation.idTipoRecargo
      ? db.select({ label: surchargeTypes.nombre }).from(surchargeTypes).where(eq(surchargeTypes.id, quotation.idTipoRecargo)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ])

  // Get nursing visit price for display
  const precioVisita = quotation.cobraVisita && quotation.comuna
    ? (await getPrecioVisitaEnfermeria(db, quotation.comuna)) ?? 0
    : 0

  const html = buildHTML({
    quotation,
    examItems,
    procItems,
    patient: patientRow,
    surchargeLabel: surchargeRow?.label ?? null,
    precioVisita,
  })

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Item = { descripcion: string; codigo: string | null; precio: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pesos(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHTML({
  quotation,
  examItems,
  procItems,
  patient,
  surchargeLabel,
  precioVisita,
}: {
  quotation: {
    id: number
    estado: string
    idPaciente: number | null
    nombreDestinatario: string | null
    emailDestinatario: string | null
    telefonoDestinatario: string | null
    identificacionDestinatario: string | null
    comuna: string | null
    cobraVisita: boolean
    montoRecargo: number | null
    total: number | null
    notas: string | null
    createdAt: Date
  }
  examItems: Item[]
  procItems: Item[]
  patient: { nombres: string; apellidoPaterno: string | null; apellidoMaterno: string | null; identificador: string | null; tipoIdentificador: string | null } | null
  surchargeLabel: string | null
  precioVisita: number
}): string {
  const today = todaySantiago()
  const numeroDoc = `COT-${String(quotation.id).padStart(5, '0')}`

  // Determine recipient name and labeled fields
  let recipientName: string
  type Field = { label: string; value: string }
  const destinatarioRows: (Field | null)[] = []

  if (patient) {
    recipientName = formatNombre({ nombres: patient.nombres, apellidoPaterno: patient.apellidoPaterno ?? '' })
    destinatarioRows.push({ label: 'Nombre', value: esc(recipientName) })
    if (patient.identificador) {
      const tipoLabel = patient.tipoIdentificador === 'rut' ? 'RUT' : patient.tipoIdentificador === 'pasaporte' ? 'Pasaporte' : 'Identificación'
      destinatarioRows.push({ label: tipoLabel, value: esc(patient.identificador) })
    }
  } else {
    recipientName = quotation.nombreDestinatario ?? 'Sin nombre'
    destinatarioRows.push({ label: 'Nombre', value: esc(recipientName) })
    if (quotation.identificacionDestinatario) destinatarioRows.push({ label: 'Identificación', value: esc(quotation.identificacionDestinatario) })
    if (quotation.emailDestinatario) destinatarioRows.push({ label: 'Correo', value: esc(quotation.emailDestinatario) })
    if (quotation.telefonoDestinatario) destinatarioRows.push({ label: 'Teléfono', value: esc(quotation.telefonoDestinatario) })
  }
  if (quotation.comuna) destinatarioRows.push({ label: 'Comuna', value: esc(quotation.comuna) })

  // Destinatario info card fields
  const destinatarioFields = (destinatarioRows.filter(Boolean) as Field[])
    .map(
      (f) =>
        `<div style="margin-bottom:8px;">
          <span style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:1px;">${f.label}</span>
          <span style="font-size:13px;color:#1e2835;font-weight:500;">${f.value}</span>
        </div>`,
    )
    .join('')

  // Cotizacion info card fields
  const emisionDate = quotation.createdAt.toISOString().split('T')[0] || today
  const cotizacionFields = [
    { label: 'Fecha de emisión', value: esc(formatDateLong(emisionDate)) },
    { label: 'N° de cotización', value: `<span style="font-family:monospace;font-size:12px;">${esc(numeroDoc)}</span>` },
  ]
    .map(
      (f) =>
        `<div style="margin-bottom:8px;">
          <span style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:1px;">${f.label}</span>
          <span style="font-size:13px;color:#1e2835;font-weight:500;">${f.value}</span>
        </div>`,
    )
    .join('')

  // Item rows
  function itemRows(items: Item[], startIdx: number): string {
    return items
      .map(
        (item, i) => `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:11px 14px;color:#94a3b8;font-size:12px;text-align:right;padding-right:16px;">${startIdx + i + 1}</td>
          <td style="padding:11px 14px;color:#1e2835;font-size:13px;">${esc(item.descripcion)}</td>
          <td style="padding:11px 14px;color:#94a3b8;font-size:11px;font-family:monospace;">${esc(item.codigo)}</td>
          <td style="padding:11px 14px;text-align:right;font-variant-numeric:tabular-nums;font-size:13px;"><strong>${esc(pesos(item.precio))}</strong></td>
        </tr>`,
      )
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

  if (examItems.length > 0) {
    itemsHTML += groupHeader('Exámenes de laboratorio')
    itemsHTML += itemRows(examItems, idx)
    idx += examItems.length
  }

  if (procItems.length > 0) {
    itemsHTML += groupHeader('Procedimientos de enfermería')
    itemsHTML += itemRows(procItems, idx)
    idx += procItems.length
  }

  const subtotalExamenes = examItems.reduce((s, e) => s + e.precio, 0)
  const subtotalProcedimientos = procItems.reduce((s, p) => s + p.precio, 0)

  if (subtotalExamenes > 0) {
    itemsHTML += subtotalRow('Subtotal exámenes', subtotalExamenes)
  }
  if (subtotalProcedimientos > 0) {
    itemsHTML += subtotalRow('Subtotal procedimientos', subtotalProcedimientos)
  }

  if (quotation.cobraVisita && precioVisita > 0) {
    itemsHTML += subtotalRow(`Visita de enfermería${quotation.comuna ? ` (${quotation.comuna})` : ''}`, precioVisita)
  }

  if ((quotation.montoRecargo ?? 0) > 0 && surchargeLabel) {
    itemsHTML += subtotalRow(surchargeLabel, quotation.montoRecargo!)
  }

  const total = quotation.total ?? 0
  const totalCell =
    total > 0
      ? `<span style="font-size:20px;font-weight:700;">${pesos(total)}</span>`
      : `<span style="font-size:13px;font-weight:400;color:#94a3b8;">Sin precios configurados</span>`

  itemsHTML += `<tr style="background:#1e2835;">
    <td colspan="3" style="padding:14px;font-size:11px;font-weight:600;letter-spacing:0.5px;color:#ffffff;">Total cotización</td>
    <td style="padding:14px;text-align:right;color:#ffffff;">${totalCell}</td>
  </tr>`

  const notesHTML = quotation.notas
    ? `<div class="notes" style="margin-top:32px;">
        <strong>Notas:</strong> ${esc(quotation.notas)}
      </div>`
    : ''

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
    .disclaimer {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 11px;
      color: #64748b;
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
<script>window.addEventListener('load', () => window.print())</script>
<body>
  <!-- Print bar -->
  <div class="print-bar">
    <p>Cotización ${esc(numeroDoc)} &middot; ${esc(recipientName)}</p>
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
          <p style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin-bottom:10px;">Destinatario</p>
          ${destinatarioFields}
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;">
          <p style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin-bottom:10px;">Datos de la cotización</p>
          ${cotizacionFields}
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

      ${notesHTML}

      <!-- Disclaimer -->
      <div class="disclaimer" style="margin-top:16px;">
        Esta cotización es referencial y tiene una validez de 30 días desde su emisión. Los precios pueden variar según disponibilidad. Para confirmar su atención, contáctenos al número indicado.
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

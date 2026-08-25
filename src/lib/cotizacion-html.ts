import { formatDateLong } from '@/lib/format'

// ─── Public helpers ───────────────────────────────────────────────────────────

export function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function pesos(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}

export function formatCotizacionId(id: number): string {
  return `COT-${String(id).padStart(5, '0')}`
}

// ─── Data types ───────────────────────────────────────────────────────────────

export type CotizacionInfoField = {
  label: string
  value: string    // pre-escaped or safe HTML
  small?: boolean
}

export type CotizacionItemGroup = {
  label: string
  items: Array<{
    descripcion: string
    codigo: string | null
    precio: number | null
    noPrice?: boolean
  }>
}

export type CotizacionHTMLData = {
  numeroDoc: string
  emisionDate: string
  recipientLabel: string
  leftCard: { title: string; fields: CotizacionInfoField[] }
  rightCard: { title: string; fields: CotizacionInfoField[] }
  grupos: CotizacionItemGroup[]
  subtotales: { label: string; amount: number }[]
  total: number
  notas?: string | null
  disclaimer: string
  autoPrint?: boolean
}

// ─── Builder ──────────────────────────────────────────────────────────────────

function infoField(f: CotizacionInfoField): string {
  return `<div style="margin-bottom:12px;">
    <div style="font-size:10.5px;font-weight:600;letter-spacing:0.08em;color:#8894a3;">${f.label.toUpperCase()}</div>
    <div style="font-size:${f.small ? 12.5 : 15}px;font-weight:600;color:#16202b;margin-top:3px;">${f.value}</div>
  </div>`
}

function groupHeader(label: string): string {
  return `<tr>
    <td colspan="4" style="padding:12px 0 8px;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#a05a1e;border-bottom:1px solid #eef1f4;">${label}</td>
  </tr>`
}

function itemRow(
  item: { descripcion: string; codigo: string | null; precio: number | null; noPrice?: boolean },
  n: number,
): string {
  const precioCell = item.noPrice
    ? `<span style="font-size:12px;color:#8894a3;">incluido</span>`
    : item.precio !== null
      ? `<strong style="font-size:15px;font-weight:600;color:#16202b;">${esc(pesos(item.precio))}</strong>`
      : `<span style="font-size:12px;color:#8894a3;">Sin precio configurado</span>`
  return `<tr style="border-bottom:1px solid #eef1f4;">
    <td style="padding:12px 0;color:#8894a3;font-weight:600;font-size:13px;">${n}</td>
    <td style="padding:12px 14px 12px 0;color:#16202b;font-size:15px;">${esc(item.descripcion)}</td>
    <td style="padding:12px 14px 12px 0;color:#5b6b7c;font-size:13.5px;font-family:'IBM Plex Mono',monospace;">${esc(item.codigo)}</td>
    <td style="padding:12px 0;text-align:right;font-variant-numeric:tabular-nums;">${precioCell}</td>
  </tr>`
}

function subtotalRow(label: string, amount: number, isLast: boolean): string {
  const border = isLast ? 'border-bottom:1.5px solid #163f63;' : ''
  const color = amount < 0 ? '#c8631f' : '#16202b'
  return `<tr>
    <td colspan="3" style="padding:10px 0;font-size:14px;color:#4b5b6b;${border}">${label}</td>
    <td style="padding:10px 0;text-align:right;font-weight:600;font-size:14px;color:${color};${border}">${amount < 0 ? '-' : ''}${pesos(Math.abs(amount))}</td>
  </tr>`
}

export function buildCotizacionHTML(data: CotizacionHTMLData): string {
  const leftFields = data.leftCard.fields.map(infoField).join('')
  const rightFields = data.rightCard.fields.map(infoField).join('')

  let itemsHTML = ''
  let idx = 0
  for (const grupo of data.grupos) {
    itemsHTML += groupHeader(grupo.label)
    for (const item of grupo.items) {
      itemsHTML += itemRow(item, idx + 1)
      idx++
    }
  }
  data.subtotales.forEach((sub, i) => {
    itemsHTML += subtotalRow(sub.label, sub.amount, i === data.subtotales.length - 1)
  })

  const totalBorder = data.subtotales.length === 0 ? 'border-top:1.5px solid #163f63;' : ''
  const totalCell =
    data.total > 0
      ? `<span style="font-size:22px;font-weight:600;color:#163f63;font-family:'IBM Plex Mono',monospace;">${pesos(data.total)}</span>`
      : `<span style="font-size:13px;font-weight:400;color:#8894a3;">Sin precios configurados</span>`

  itemsHTML += `<tr>
    <td colspan="3" style="padding:14px 0;font-size:15px;font-weight:700;color:#163f63;${totalBorder}">Total cotización</td>
    <td style="padding:14px 0;text-align:right;${totalBorder}">${totalCell}</td>
  </tr>`

  const notasHTML = data.notas
    ? `<div class="notes" style="margin-top:28px;">
        <strong>Notas:</strong> ${esc(data.notas)}
      </div>`
    : ''

  const autoPrintScript = data.autoPrint
    ? `<script>window.addEventListener('load', () => window.print())</script>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cotización ${esc(data.numeroDoc)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #16202b;
      background: #f0f2f5;
      line-height: 1.5;
    }
    .print-bar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: #163f63;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-bar p { font-size: 12px; color: #b7c4d4; }
    .print-bar button {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      color: #163f63;
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
      gap: 38px;
    }
    .notes {
      background: #fdf6ee;
      border: 1px solid #f0d9c0;
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 11.5px;
      color: #8a4a1d;
      line-height: 1.6;
    }
    .disclaimer {
      border-top: 1px solid #e1e7ed;
      padding-top: 18px;
      font-size: 12.5px;
      line-height: 1.55;
      color: #5b6b7c;
      font-style: italic;
    }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { background: #ffffff; }
      .page { margin: 0; padding: 1.4cm 1.65cm; box-shadow: none; max-width: none; }
      .print-bar { display: none; }
      @page { margin: 0; }
    }
    @media (max-width: 640px) {
      .info-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
${autoPrintScript}
<body>
  <div class="print-bar">
    <p>Cotización ${esc(data.numeroDoc)} &middot; ${esc(data.recipientLabel)}</p>
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
    <div style="padding:34px 44px 22px;border-bottom:2px solid #163f63;display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="position:relative;width:32px;height:32px;flex-shrink:0;">
          <div style="position:absolute;left:11px;top:0;width:10px;height:32px;background:#c8631f;border-radius:2px;"></div>
          <div style="position:absolute;top:11px;left:0;width:32px;height:10px;background:#163f63;border-radius:2px;"></div>
        </div>
        <div>
          <div style="font-size:22px;font-weight:700;color:#163f63;letter-spacing:-0.01em;">Homelab</div>
          <div style="font-size:12.5px;color:#5b6b7c;margin-top:2px;">Atención de Enfermería a Domicilio</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;color:#8894a3;">COTIZACIÓN N°</div>
        <div style="font-size:22px;font-weight:600;color:#163f63;margin-top:4px;font-family:'IBM Plex Mono',monospace;">${esc(data.numeroDoc)}</div>
        <div style="font-size:12px;color:#8894a3;margin-top:4px;">Emitida el ${esc(formatDateLong(data.emisionDate))}</div>
      </div>
    </div>

    <div style="padding:28px 44px 34px;">

      <div class="info-grid" style="padding-bottom:24px;margin-bottom:28px;border-bottom:1px solid #e1e7ed;">
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#5b6b7c;margin-bottom:12px;">${data.leftCard.title.toUpperCase()}</div>
          ${leftFields}
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;color:#5b6b7c;margin-bottom:12px;">${data.rightCard.title.toUpperCase()}</div>
          ${rightFields}
        </div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1.5px solid #163f63;">
            <th style="padding:0 0 8px;font-size:10.5px;font-weight:600;letter-spacing:0.08em;color:#163f63;text-align:left;width:32px;">#</th>
            <th style="padding:0 14px 8px 0;font-size:10.5px;font-weight:600;letter-spacing:0.08em;color:#163f63;text-align:left;">DESCRIPCIÓN</th>
            <th style="padding:0 14px 8px 0;font-size:10.5px;font-weight:600;letter-spacing:0.08em;color:#163f63;text-align:left;width:100px;">CÓDIGO</th>
            <th style="padding:0 0 8px;font-size:10.5px;font-weight:600;letter-spacing:0.08em;color:#163f63;text-align:right;width:120px;">PRECIO</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      ${notasHTML}

      <div class="disclaimer" style="margin-top:${data.notas ? 20 : 28}px;">
        ${esc(data.disclaimer)}
      </div>

      <div style="margin-top:28px;padding-top:14px;border-top:1px solid #e1e7ed;display:flex;justify-content:space-between;align-items:center;">
        <p style="font-size:12px;color:#8894a3;"><span style="color:#1f5f8f;font-weight:600;">Homelab</span> &middot; Atención de Enfermería a Domicilio</p>
        <p style="font-size:12px;color:#8894a3;">Emitida el ${esc(formatDateLong(data.emisionDate))}</p>
      </div>

    </div>
  </div>
</body>
</html>`
}

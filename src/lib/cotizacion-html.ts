import { formatDateLong } from '@/lib/format'
import { DOC_TOKENS_CSS, LOGO_PATH, LOGO_RENDER_WIDTH, LOGO_RENDER_HEIGHT } from '@/lib/brand'

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

const NUM = 'font-variant-numeric:tabular-nums;'

function infoField(f: CotizacionInfoField): string {
  return `<div style="margin-bottom:12px;">
    <div style="font-size:var(--text-xs);font-weight:600;letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--color-fg-muted);">${f.label.toUpperCase()}</div>
    <div style="font-size:${f.small ? 'var(--text-sm)' : 'var(--text-md)'};font-weight:500;color:var(--color-fg);margin-top:3px;">${f.value}</div>
  </div>`
}

function groupHeader(label: string): string {
  return `<tr>
    <td colspan="4" style="padding:14px 0 8px;font-size:var(--text-xs);font-weight:600;text-transform:uppercase;letter-spacing:var(--tracking-label);color:var(--color-fg-muted);border-bottom:1px solid var(--color-border);">${label}</td>
  </tr>`
}

function codeChip(codigo: string | null): string {
  if (!codigo) return ''
  return `<span style="display:inline-block;padding:2px 6px;border-radius:var(--radius-sm);background:var(--color-surface-muted);border:1px solid var(--color-border);font-family:var(--font-mono);font-size:var(--text-xs);letter-spacing:.02em;color:var(--color-fg-muted);">${esc(codigo)}</span>`
}

function itemRow(
  item: { descripcion: string; codigo: string | null; precio: number | null; noPrice?: boolean },
  n: number,
): string {
  const precioCell = item.noPrice
    ? `<span style="font-size:var(--text-sm);color:var(--color-fg-subtle);">incluido</span>`
    : item.precio !== null
      ? `<strong style="font-size:var(--text-md);font-weight:600;color:var(--color-fg);${NUM}">${esc(pesos(item.precio))}</strong>`
      : `<span style="font-size:var(--text-sm);color:var(--color-fg-subtle);">Sin precio configurado</span>`
  return `<tr style="border-bottom:1px solid var(--color-border);">
    <td style="padding:var(--row-py) 0;color:var(--color-fg-subtle);font-weight:600;font-size:var(--text-sm);${NUM}">${n}</td>
    <td style="padding:var(--row-py) 14px var(--row-py) 0;color:var(--color-fg);font-size:var(--text-base);">${esc(item.descripcion)}</td>
    <td style="padding:var(--row-py) 14px var(--row-py) 0;">${codeChip(item.codigo)}</td>
    <td style="padding:var(--row-py) 0;text-align:right;${NUM}">${precioCell}</td>
  </tr>`
}

function subtotalRow(label: string, amount: number, isLast: boolean): string {
  const border = isLast ? 'border-bottom:1.5px solid var(--color-primary);' : ''
  const color = amount < 0 ? 'var(--brand-orange-fg)' : 'var(--color-fg)'
  return `<tr>
    <td colspan="3" style="padding:10px 0;font-size:var(--text-md);color:var(--color-fg-muted);${border}">${label}</td>
    <td style="padding:10px 0;text-align:right;font-weight:600;font-size:var(--text-md);color:${color};${NUM}${border}">${amount < 0 ? '-' : ''}${pesos(Math.abs(amount))}</td>
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

  const totalBorder = data.subtotales.length === 0 ? 'border-top:1.5px solid var(--color-primary);' : ''
  const totalCell =
    data.total > 0
      ? `<span style="font-size:var(--text-xl);font-weight:600;color:var(--color-primary);font-family:var(--font-mono);${NUM}">${pesos(data.total)}</span>`
      : `<span style="font-size:var(--text-base);font-weight:400;color:var(--color-fg-subtle);">Sin precios configurados</span>`

  itemsHTML += `<tr>
    <td colspan="3" style="padding:14px 0;font-size:var(--text-base);font-weight:700;color:var(--color-primary);${totalBorder}">Total cotización</td>
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
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <style>
    ${DOC_TOKENS_CSS}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      color: var(--color-fg);
      background: var(--color-bg);
      line-height: 1.5;
    }
    .print-bar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: var(--color-primary);
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-bar p { font-size: var(--text-sm); color: rgba(255,255,255,0.75); }
    .print-bar button {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      background: var(--color-surface);
      color: var(--color-primary);
      border: none;
      border-radius: var(--radius-md);
      padding: 0 16px;
      font-size: var(--text-base);
      font-weight: 500;
      font-family: var(--font-sans);
      cursor: pointer;
    }
    .page {
      max-width: 800px;
      margin: 32px auto;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 38px;
    }
    .notes {
      /* Espejo de .hl-callout--warn (homelab-tokens.css), que es sin borde. */
      background: var(--brand-orange-soft);
      border-radius: var(--radius-md);
      padding: 14px 18px;
      font-size: var(--text-sm);
      color: var(--brand-orange-fg);
      line-height: 1.6;
    }
    .disclaimer {
      border-top: 1px solid var(--color-border);
      padding-top: 18px;
      font-size: var(--text-sm);
      line-height: 1.55;
      color: var(--color-fg-muted);
      font-style: italic;
    }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { background: #ffffff; }
      /* overflow visible: con overflow:hidden Chrome recorta el contenido a
         partir de la segunda página al imprimir cotizaciones largas. */
      .page { margin: 0; padding: 1.4cm 1.65cm; box-shadow: none; border: none; border-radius: 0; max-width: none; overflow: visible; }
      .print-bar { display: none; }
      @page { margin: 0; }
    }
    @media (max-width: 640px) {
      .info-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
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
    <div style="padding:34px 44px 22px;border-bottom:2px solid var(--color-primary);display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="${LOGO_PATH}" alt="HomeLab" width="${LOGO_RENDER_WIDTH}" height="${LOGO_RENDER_HEIGHT}" style="display:block;height:${LOGO_RENDER_HEIGHT}px;width:auto;flex-shrink:0;" />
        <div style="padding-left:14px;border-left:1px solid var(--color-border);font-size:var(--text-base);color:var(--color-fg-muted);">
          Atención de Enfermería a Domicilio
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:var(--text-xs);font-weight:600;letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--color-fg-muted);">Cotización N°</div>
        <div style="font-size:var(--text-xl);font-weight:600;color:var(--color-primary);margin-top:4px;font-family:var(--font-mono);${NUM}">${esc(data.numeroDoc)}</div>
        <div style="font-size:var(--text-sm);color:var(--color-fg-subtle);margin-top:4px;">Emitida el ${esc(formatDateLong(data.emisionDate))}</div>
      </div>
    </div>

    <div style="padding:28px 44px 34px;">

      <div class="info-grid" style="padding-bottom:24px;margin-bottom:28px;border-bottom:1px solid var(--color-border);">
        <div>
          <div style="font-size:var(--text-xs);font-weight:600;letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--color-fg-muted);margin-bottom:12px;">${data.leftCard.title.toUpperCase()}</div>
          ${leftFields}
        </div>
        <div>
          <div style="font-size:var(--text-xs);font-weight:600;letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--color-fg-muted);margin-bottom:12px;">${data.rightCard.title.toUpperCase()}</div>
          ${rightFields}
        </div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--color-border);">
            <th style="padding:0 0 8px;font-size:var(--text-xs);font-weight:600;letter-spacing:var(--tracking-label);color:var(--color-fg-muted);text-align:left;width:32px;">#</th>
            <th style="padding:0 14px 8px 0;font-size:var(--text-xs);font-weight:600;letter-spacing:var(--tracking-label);color:var(--color-fg-muted);text-align:left;">DESCRIPCIÓN</th>
            <th style="padding:0 14px 8px 0;font-size:var(--text-xs);font-weight:600;letter-spacing:var(--tracking-label);color:var(--color-fg-muted);text-align:left;width:100px;">CÓDIGO</th>
            <th style="padding:0 0 8px;font-size:var(--text-xs);font-weight:600;letter-spacing:var(--tracking-label);color:var(--color-fg-muted);text-align:right;width:120px;">PRECIO</th>
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

      <div style="margin-top:28px;padding-top:14px;border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center;">
        <p style="font-size:var(--text-sm);color:var(--color-fg-subtle);"><span style="color:var(--color-primary);font-weight:600;">HomeLab</span> &middot; Atención de Enfermería a Domicilio</p>
        <p style="font-size:var(--text-sm);color:var(--color-fg-subtle);">Emitida el ${esc(formatDateLong(data.emisionDate))}</p>
      </div>

    </div>
  </div>
  ${autoPrintScript}
</body>
</html>`
}

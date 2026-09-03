import { formatDateLong } from '@/lib/format'
import { DOC_TOKENS_CSS, LOGO_PATH, LOGO_RENDER_WIDTH, LOGO_RENDER_HEIGHT } from '@/lib/brand'
import { PAGINATE_JS } from '@/lib/cotizacion-paginate'

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

// ─── Markup helpers ───────────────────────────────────────────────────────────

function infoField(f: CotizacionInfoField): string {
  return `<div class="fld">
    <div class="fld__k">${esc(f.label).toUpperCase()}</div>
    <div class="fld__v${f.small ? ' fld__v--sm' : ''}">${f.value}</div>
  </div>`
}

function infoColumn(card: { title: string; fields: CotizacionInfoField[] }): string {
  return `<div class="info-col">
    <div class="info-col__k">${esc(card.title).toUpperCase()}</div>
    ${card.fields.map(infoField).join('')}
  </div>`
}

function itemRow(
  item: { descripcion: string; codigo: string | null; precio: number | null; noPrice?: boolean },
  n: number,
): string {
  const precioCell = item.noPrice
    ? `<span class="c-price__muted">incluido</span>`
    : item.precio !== null
      ? `<strong class="c-price__val">${esc(pesos(item.precio))}</strong>`
      : `<span class="c-price__muted">Sin precio configurado</span>`
  const codeCell = item.codigo ? `<span class="code-chip">${esc(item.codigo)}</span>` : ''
  return `<tr data-row="item">
    <td class="c-num">${n}</td>
    <td class="c-desc">${esc(item.descripcion)}</td>
    <td class="c-code">${codeCell}</td>
    <td class="c-price">${precioCell}</td>
  </tr>`
}

function subtotalRow(label: string, amount: number, isLast: boolean): string {
  const cls = `sub${isLast ? ' sub--last' : ''}${amount < 0 ? ' sub--neg' : ''}`
  return `<tr data-row="subtotal">
    <td colspan="3" class="${cls}">${esc(label)}</td>
    <td class="${cls} sub--amt">${amount < 0 ? '-' : ''}${esc(pesos(Math.abs(amount)))}</td>
  </tr>`
}

// ─── Source markup (bloques que el script de paginación reparte) ───────────────

function renderSource(data: CotizacionHTMLData): string {
  const emision = esc(formatDateLong(data.emisionDate))
  const numeroDoc = esc(data.numeroDoc)

  const headerFull = `<div id="hd-full" class="doc-hd doc-hd--full">
    <div class="doc-hd__brand">
      <img src="${LOGO_PATH}" alt="HomeLab" width="${LOGO_RENDER_WIDTH}" height="${LOGO_RENDER_HEIGHT}" class="doc-hd__logo" />
      <div class="doc-hd__tag">Atención de Enfermería a Domicilio</div>
    </div>
    <div class="doc-hd__meta">
      <div class="doc-hd__meta-k">Cotización N°</div>
      <div class="doc-hd__meta-num">${numeroDoc}</div>
      <div class="doc-hd__meta-date">Emitida el ${emision}</div>
    </div>
  </div>`

  const headerCompact = `<template id="tpl-hd-compact"><div class="doc-hd doc-hd--compact">
    <img src="${LOGO_PATH}" alt="HomeLab" width="${LOGO_RENDER_WIDTH}" height="${LOGO_RENDER_HEIGHT}" class="doc-hd__logo doc-hd__logo--sm" />
    <div class="doc-hd__cont">Cotización ${numeroDoc} &middot; continuación</div>
  </div></template>`

  const footer = `<template id="tpl-ft"><div class="doc-ft">
    <span class="doc-ft__brand"><b>HomeLab</b> &middot; Atención de Enfermería a Domicilio</span>
    <span class="doc-ft__right"><span>Emitida el ${emision}</span><span class="pageno"></span></span>
  </div></template>`

  const infoBlk = `<div class="blk" data-blk="info">
    <div class="info-grid">
      ${infoColumn(data.leftCard)}
      ${infoColumn(data.rightCard)}
    </div>
  </div>`

  let rows = ''
  let idx = 0
  for (const grupo of data.grupos) {
    rows += `<tr data-row="group"><td colspan="4" class="grp">${esc(grupo.label)}</td></tr>`
    for (const item of grupo.items) {
      rows += itemRow(item, idx + 1)
      idx++
    }
  }
  data.subtotales.forEach((sub, i) => {
    rows += subtotalRow(sub.label, sub.amount, i === data.subtotales.length - 1)
  })

  const totalBorder = data.subtotales.length === 0 ? ' tot--border' : ''
  const totalCell =
    data.total > 0
      ? `<span class="tot__val">${esc(pesos(data.total))}</span>`
      : `<span class="tot__muted">Sin precios configurados</span>`
  rows += `<tr data-row="total">
    <td colspan="3" class="tot${totalBorder}">Total cotización</td>
    <td class="tot tot--amt${totalBorder}">${totalCell}</td>
  </tr>`

  const itemsBlk = `<div class="blk" data-blk="items">
    <table class="doc-items" cellpadding="0" cellspacing="0">
      <thead>
        <tr>
          <th class="c-num">#</th>
          <th class="c-desc">DESCRIPCIÓN</th>
          <th class="c-code">CÓDIGO</th>
          <th class="c-price">PRECIO</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`

  const notasBlk = data.notas
    ? `<div class="blk" data-blk="notas"><div class="notes"><strong>Notas:</strong> ${esc(data.notas)}</div></div>`
    : ''

  const disclaimerBlk = `<div class="blk" data-blk="disclaimer"><div class="disclaimer">${esc(data.disclaimer)}</div></div>`

  // Footer visible sólo si la paginación falla (documento en un flujo).
  const fallbackFooter = `<div class="doc-ft doc-ft--fallback">
    <span class="doc-ft__brand"><b>HomeLab</b> &middot; Atención de Enfermería a Domicilio</span>
    <span>Emitida el ${emision}</span>
  </div>`

  return `<div id="source" class="doc-fallback">
    ${headerFull}
    ${headerCompact}
    ${footer}
    ${infoBlk}
    ${itemsBlk}
    ${notasBlk}
    ${disclaimerBlk}
    ${fallbackFooter}
  </div>`
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildCotizacionHTML(data: CotizacionHTMLData): string {
  const autoPrintScript = data.autoPrint
    ? `<script>window.__cotizacionAutoPrint = true</script>`
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
    :root {
      /* Geometría de la hoja (A4). 296mm deja ~1mm de holgura frente a los
         297mm reales para que Chrome no emita una página en blanco al final. */
      --sheet-w: 210mm;
      --sheet-h: 296mm;
      --sheet-pad-x: 16mm;
      --sheet-pad-top: 12mm;
      --sheet-pad-bottom: 8mm;
    }
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

    /* ── Hojas paginadas ── */
    #doc {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px 0 40px;
    }
    .sheet {
      width: var(--sheet-w);
      height: var(--sheet-h);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .sheet__hd { flex: 0 0 auto; padding: var(--sheet-pad-top) var(--sheet-pad-x) 0; }
    .sheet__bd {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
      padding: 18px var(--sheet-pad-x) 8px;
    }
    .sheet__ft {
      flex: 0 0 auto;
      padding: 8px var(--sheet-pad-x) var(--sheet-pad-bottom);
    }

    /* ── Encabezado ── */
    .doc-hd__logo { display: block; height: ${LOGO_RENDER_HEIGHT}px; width: auto; flex-shrink: 0; }
    .doc-hd__logo--sm { height: 26px; }
    .doc-hd--full {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding-bottom: 18px;
      border-bottom: 2px solid var(--color-primary);
    }
    .doc-hd__brand { display: flex; align-items: center; gap: 14px; }
    .doc-hd__tag {
      padding-left: 14px;
      border-left: 1px solid var(--color-border);
      font-size: var(--text-base);
      color: var(--color-fg-muted);
    }
    .doc-hd__meta { text-align: right; flex-shrink: 0; }
    .doc-hd__meta-k {
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: var(--tracking-label);
      text-transform: uppercase;
      color: var(--color-fg-muted);
    }
    .doc-hd__meta-num {
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--color-primary);
      margin-top: 4px;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }
    .doc-hd__meta-date { font-size: var(--text-sm); color: var(--color-fg-subtle); margin-top: 4px; }
    .doc-hd--compact {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1.5px solid var(--color-primary);
    }
    .doc-hd__cont { font-size: var(--text-sm); color: var(--color-fg-muted); }

    /* ── Footer ── */
    .doc-ft {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid var(--color-border);
      font-size: var(--text-sm);
      color: var(--color-fg-subtle);
    }
    .doc-ft__brand b { color: var(--color-primary); font-weight: 600; }
    .doc-ft__right { display: flex; gap: 14px; align-items: center; }
    .pageno { font-variant-numeric: tabular-nums; }
    .doc-ft--fallback { display: none; margin-top: 28px; }

    /* ── Grilla de info ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 38px;
      padding-bottom: 22px;
      margin-bottom: 22px;
      border-bottom: 1px solid var(--color-border);
    }
    .info-col__k {
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: var(--tracking-label);
      text-transform: uppercase;
      color: var(--color-fg-muted);
      margin-bottom: 12px;
    }
    .fld { margin-bottom: 12px; }
    .fld__k {
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: var(--tracking-label);
      text-transform: uppercase;
      color: var(--color-fg-muted);
    }
    .fld__v { font-size: var(--text-md); font-weight: 500; color: var(--color-fg); margin-top: 3px; }
    .fld__v--sm { font-size: var(--text-sm); }

    /* ── Tabla de ítems ── */
    .doc-items { width: 100%; border-collapse: collapse; }
    .doc-items th {
      padding: 0 0 8px;
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: var(--tracking-label);
      color: var(--color-fg-muted);
      text-align: left;
      border-bottom: 1px solid var(--color-border);
    }
    .doc-items td { font-size: var(--text-base); color: var(--color-fg); }
    .c-num { width: 32px; color: var(--color-fg-subtle); font-weight: 600; font-size: var(--text-sm); font-variant-numeric: tabular-nums; text-align: left; }
    .c-desc { padding-right: 14px; }
    .c-code { width: 110px; padding-right: 14px; }
    .c-price { width: 130px; text-align: right; font-variant-numeric: tabular-nums; }
    .doc-items tbody td { padding-top: var(--row-py); padding-bottom: var(--row-py); }
    .doc-items tr[data-row="item"] { border-bottom: 1px solid var(--color-border); }
    .code-chip {
      display: inline-block;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      background: var(--color-surface-muted);
      border: 1px solid var(--color-border);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: .02em;
      color: var(--color-fg-muted);
    }
    .c-price__val { font-size: var(--text-md); font-weight: 600; color: var(--color-fg); }
    .c-price__muted { font-size: var(--text-sm); color: var(--color-fg-subtle); }
    .grp {
      padding: 14px 0 8px !important;
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: var(--tracking-label);
      color: var(--color-fg-muted);
      border-bottom: 1px solid var(--color-border);
    }
    .sub { padding: 10px 0 !important; font-size: var(--text-md); color: var(--color-fg-muted); }
    .sub--amt { text-align: right; font-weight: 600; color: var(--color-fg); font-variant-numeric: tabular-nums; }
    .sub--neg.sub--amt { color: var(--brand-orange-fg); }
    .sub--last { border-bottom: 1.5px solid var(--color-primary); }
    .tot { padding: 14px 0 !important; font-size: var(--text-base); font-weight: 700; color: var(--color-primary); }
    .tot--amt { text-align: right; }
    .tot--border { border-top: 1.5px solid var(--color-primary); }
    .tot__val {
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--color-primary);
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }
    .tot__muted { font-size: var(--text-base); font-weight: 400; color: var(--color-fg-subtle); }

    /* ── Notas / disclaimer ── */
    .notes {
      /* Espejo de .hl-callout--warn (homelab-tokens.css), que es sin borde. */
      background: var(--brand-orange-soft);
      border-radius: var(--radius-md);
      padding: 14px 18px;
      font-size: var(--text-sm);
      color: var(--brand-orange-fg);
      line-height: 1.6;
      margin-top: 24px;
    }
    .disclaimer {
      border-top: 1px solid var(--color-border);
      padding-top: 18px;
      margin-top: 24px;
      font-size: var(--text-sm);
      line-height: 1.55;
      color: var(--color-fg-muted);
      font-style: italic;
    }
    .blk[data-blk="notas"] + .blk[data-blk="disclaimer"] .disclaimer { margin-top: 20px; }

    /* ── Fallback: paginación no ejecutada / fallida ── */
    .doc-fallback {
      max-width: 820px;
      margin: 28px auto;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 34px 44px;
    }
    .doc-fallback #tpl-hd-compact, .doc-fallback template { display: none; }
    .doc-fallback .doc-ft--fallback { display: flex; }

    @media (max-width: 640px) {
      .info-grid { grid-template-columns: 1fr; gap: 20px; }
      .sheet { width: 100%; height: auto; }
      .sheet__bd { overflow: visible; }
    }

    @page { size: A4; margin: 0; }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html, body { background: #ffffff; }
      .print-bar { display: none; }
      #doc { padding: 0; gap: 0; }
      .sheet {
        margin: 0;
        border: none;
        box-shadow: none;
        border-radius: 0;
        break-after: page;
      }
      .sheet:last-child { break-after: auto; }
      /* Fallback impreso: sin paginar, un flujo continuo con márgenes de página. */
      .doc-fallback {
        margin: 0;
        max-width: none;
        border: none;
        box-shadow: none;
        border-radius: 0;
        padding: 1.4cm 1.65cm;
      }
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

  <div id="doc"></div>

  ${renderSource(data)}

  ${autoPrintScript}
  <script>${PAGINATE_JS}</script>
</body>
</html>`
}

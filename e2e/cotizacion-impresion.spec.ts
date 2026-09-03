import { test, expect } from '@playwright/test'
import { buildCotizacionHTML, type CotizacionHTMLData } from '../src/lib/cotizacion-html'

// Regresión del bug reportado: una cotización de pocos ítems generaba una
// segunda hoja casi vacía sólo para el footer (que además quedaba arriba). El
// documento ahora se pagina en hojas A4 reales; el chequeo clave es que el
// número de páginas del PDF impreso coincida exactamente con las hojas que el
// script arma (window.__cotizacionPaginada) — nada de hojas huérfanas.

function mkData(nItems: number, notas: boolean): CotizacionHTMLData {
  const nombres = ['Exámenes de laboratorio', 'Exámenes Isapre', 'Procedimientos de enfermería', 'Talleres']
  const grupos: CotizacionHTMLData['grupos'] = []
  let left = nItems
  for (let g = 0; g < nombres.length && left > 0; g++) {
    const take = Math.min(Math.ceil(nItems / 4), left)
    grupos.push({
      label: nombres[g]!,
      items: Array.from({ length: take }, (_, i) => ({
        descripcion: `${nombres[g]} — ítem ${i + 1} con una descripción algo larga para ocupar ancho`,
        codigo: `COD-${g}${i}`,
        precio: 12000 + i * 1500,
      })),
    })
    left -= take
  }
  return {
    numeroDoc: 'COT-00042',
    emisionDate: '2026-09-02',
    recipientLabel: 'Juana Pérez González',
    leftCard: {
      title: 'Destinatario',
      fields: [
        { label: 'Nombre', value: 'Juana Pérez González' },
        { label: 'RUT', value: '12.345.678-9' },
        { label: 'Comuna', value: 'Providencia' },
      ],
    },
    rightCard: {
      title: 'Datos de la cotización',
      fields: [
        { label: 'Fecha de emisión', value: '2 de septiembre de 2026' },
        { label: 'N° de cotización', value: 'COT-00042' },
      ],
    },
    grupos,
    subtotales: [
      { label: 'Subtotal exámenes', amount: 120000 },
      { label: 'Subtotal procedimientos', amount: 80000 },
      { label: 'Descuento visita', amount: -15000 },
      { label: 'Visita de enfermería (Providencia)', amount: 35000 },
    ],
    total: 220000,
    notas: notas ? 'Traslado incluido. El pago se realiza al momento de la atención. '.repeat(4) : null,
    disclaimer:
      'Esta cotización es referencial y tiene una validez de 30 días desde su emisión. Los precios pueden variar según disponibilidad.',
  }
}

function pdfPageCount(buf: Buffer): number {
  const s = buf.toString('latin1')
  const counts = [...s.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]))
  if (counts.length) return Math.max(...counts)
  return (s.match(/\/Type\s*\/Page(?![s])/g) || []).length
}

for (const { name, nItems, notas, expectSheets } of [
  { name: 'pocos ítems → 1 hoja', nItems: 2, notas: false, expectSheets: 1 },
  { name: 'ítems al borde de la hoja', nItems: 16, notas: true, expectSheets: undefined },
  { name: 'muchos ítems → varias hojas', nItems: 48, notas: true, expectSheets: undefined },
]) {
  test(`documento imprimible se pagina en hojas reales: ${name}`, async ({ page }) => {
    await page.setContent(buildCotizacionHTML(mkData(nItems, notas)), { waitUntil: 'load' })
    await page.addStyleTag({ content: '.print-bar{display:none!important}' })

    await page.waitForFunction(() => (window as Window & { __cotizacionPaginada?: number }).__cotizacionPaginada !== undefined)
    const sheets = await page.evaluate(
      () => (window as Window & { __cotizacionPaginada?: number }).__cotizacionPaginada as number,
    )

    expect(sheets).toBeGreaterThanOrEqual(1)
    if (expectSheets) expect(sheets).toBe(expectSheets)

    // Footer numerado en cada hoja + variante de encabezado correcta.
    const perSheet = await page.$$eval('.sheet', (els) =>
      els.map((s) => {
        const bd = s.querySelector('.sheet__bd') as HTMLElement
        return {
          pageno: s.querySelector('.sheet__ft .pageno')?.textContent ?? '',
          full: !!s.querySelector('.doc-hd--full'),
          compact: !!s.querySelector('.doc-hd--compact'),
          clipped: bd.scrollHeight > bd.clientHeight + 2,
        }
      }),
    )
    expect(perSheet).toHaveLength(sheets)
    perSheet.forEach((s, i) => {
      expect(s.pageno).toBe(`Página ${i + 1} de ${sheets}`)
      expect(i === 0 ? s.full : s.compact).toBe(true)
      expect(s.clipped, `hoja ${i + 1} recorta contenido`).toBe(false)
    })

    // El bug: el PDF debe tener EXACTAMENTE tantas páginas como hojas.
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true })
    expect(pdfPageCount(pdf)).toBe(sheets)
  })
}

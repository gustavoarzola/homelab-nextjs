import ExcelJS from 'exceljs'

import type { EstadoResultadosData } from '@/lib/actions/estado-resultados'
import { MESES } from '@/lib/finanzas/periodo'

const FMT_CLP = '"$"#,##0;-"$"#,##0'
const FMT_INT = '#,##0'
const FMT_PCT = '0.0%'

const FILL_SECTION = 'FFEEEEEE'
const FILL_TOTAL = 'FFDDE7F3'

/**
 * Excel del estado de resultados: misma estructura de filas que la página (Concepto /
 * Monto / % de ingresos), con los indicadores en una segunda hoja.
 */
export async function buildEstadoResultadosExcel(data: EstadoResultadosData) {
  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Estado de resultados')
  sheet.columns = [
    { key: 'concepto', width: 58 },
    { key: 'monto', width: 18 },
    { key: 'pct', width: 16 },
  ]

  const title = sheet.addRow([`Estado de resultados · ${MESES[data.month - 1]} ${data.year}`])
  title.font = { bold: true, size: 14 }
  sheet.addRow(['Solo visitas completadas. Honorarios de enfermeras por su monto bruto.']).font = { italic: true, color: { argb: 'FF666666' } }
  sheet.addRow([])
  const head = sheet.addRow(['Concepto', 'Monto', '% de ingresos'])
  head.font = { bold: true }
  head.getCell(2).alignment = { horizontal: 'right' }
  head.getCell(3).alignment = { horizontal: 'right' }
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_SECTION } }
  })

  for (const r of data.rows) {
    const row = sheet.addRow([r.label, r.monto, r.pctIngresos === null ? null : r.pctIngresos / 100])
    row.getCell(1).alignment = { indent: r.nivel * 2 }
    row.getCell(2).numFmt = FMT_CLP
    row.getCell(3).numFmt = FMT_PCT

    if (r.kind === 'section') {
      row.font = { bold: true, color: { argb: 'FF555555' } }
      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_SECTION } }
      })
    } else if (r.kind === 'subtotal') {
      row.font = { bold: true }
      row.eachCell((c) => {
        c.border = { top: { style: 'thin' } }
      })
    } else if (r.kind === 'total') {
      row.font = { bold: true }
      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_TOTAL } }
        c.border = { top: { style: 'thin' } }
      })
    } else if (r.kind === 'info') {
      row.font = { italic: true, color: { argb: 'FF666666' } }
    }
  }
  sheet.views = [{ state: 'frozen', ySplit: 4 }]

  const ind = workbook.addWorksheet('Indicadores')
  ind.columns = [
    { key: 'label', width: 52 },
    { key: 'valor', width: 18 },
  ]
  const indHead = ind.addRow(['Indicador', 'Valor'])
  indHead.font = { bold: true }
  indHead.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_SECTION } }
  })
  for (const i of data.indicadores) {
    const row = ind.addRow([i.label, i.formato === 'porcentaje' ? i.valor / 100 : i.valor])
    row.getCell(2).numFmt = i.formato === 'clp' ? FMT_CLP : i.formato === 'porcentaje' ? FMT_PCT : FMT_INT
  }
  ind.views = [{ state: 'frozen', ySplit: 1 }]

  const hon = workbook.addWorksheet('Honorarios por enfermera')
  hon.columns = [
    { key: 'enfermera', width: 44 },
    { key: 'visitas', width: 12 },
    { key: 'pago', width: 18 },
  ]
  const honHead = hon.addRow(['Enfermera', 'Visitas', 'Honorarios (bruto)'])
  honHead.font = { bold: true }
  honHead.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_SECTION } }
  })
  for (const h of data.honorariosPorEnfermera) {
    const row = hon.addRow([h.enfermera, h.visitas, h.pago])
    row.getCell(2).numFmt = FMT_INT
    row.getCell(3).numFmt = FMT_CLP
  }
  const honTotal = hon.addRow(['Total', data.honorariosPorEnfermera.reduce((a, h) => a + h.visitas, 0), data.totales.honorarios])
  honTotal.font = { bold: true }
  honTotal.getCell(2).numFmt = FMT_INT
  honTotal.getCell(3).numFmt = FMT_CLP
  hon.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer
  const fileName = `estado-resultados-${data.year}-${String(data.month).padStart(2, '0')}.xlsx`
  return { buffer, fileName }
}

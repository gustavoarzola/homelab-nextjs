import ExcelJS from 'exceljs'
import { todaySantiago } from '@/lib/format'

export type ExcelCellFormat = 'currency-clp' | 'integer' | 'date' | 'datetime' | 'percent'

export type ExcelColumn<T> = {
  header: string
  accessor: (row: T) => string | number | boolean | Date | null | undefined
  width?: number
  format?: ExcelCellFormat
}

export type BuildExcelOptions<T> = {
  columns: ExcelColumn<T>[]
  rows: T[]
  sheetName: string
  fileName?: string
}

export type BuildExcelResult = {
  buffer: ArrayBuffer
  fileName: string
}

const NUM_FORMATS: Record<ExcelCellFormat, string> = {
  'currency-clp': '"$"#,##0',
  integer: '0',
  date: 'dd-mm-yyyy',
  datetime: 'dd-mm-yyyy hh:mm',
  percent: '0.00%',
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Hoja1'
}

function valueLength(v: unknown): number {
  if (v == null) return 0
  if (v instanceof Date) return 10
  return String(v).length
}

export async function buildExcel<T>(opts: BuildExcelOptions<T>): Promise<BuildExcelResult> {
  const { columns, rows, sheetName } = opts

  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()
  const sheet = workbook.addWorksheet(sanitizeSheetName(sheetName))

  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.header,
    width: col.width ?? Math.max(col.header.length + 2, 12),
    style: col.format ? { numFmt: NUM_FORMATS[col.format] } : undefined,
  }))

  const autoWidth: number[] = columns.map((c) => c.width ?? c.header.length + 2)

  for (const row of rows) {
    const values = columns.map((col) => {
      const v = col.accessor(row)
      return v ?? null
    })
    sheet.addRow(values)

    if (columns.some((c) => c.width == null)) {
      values.forEach((v, i) => {
        if (columns[i]!.width != null) return
        const len = valueLength(v) + 2
        if (len > autoWidth[i]!) autoWidth[i] = len
      })
    }
  }

  sheet.columns.forEach((col, i) => {
    if (columns[i]!.width == null) {
      col.width = Math.min(autoWidth[i]!, 60)
    }
  })

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEEEEEE' },
  }
  headerRow.alignment = { vertical: 'middle' }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  if (columns.length > 0 && rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    }
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer
  const fileName = opts.fileName ?? `${sheetName.toLowerCase()}-${todaySantiago()}.xlsx`

  return { buffer, fileName }
}

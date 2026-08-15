import type { ExcelColumn } from '@/lib/excel/build-excel'
import type { VisitaReportRow } from '@/lib/actions/visitas'
import { parseDateLocal } from '@/lib/format'

export type ReportColumn<T> = ExcelColumn<T> & { key: string }

/**
 * Registro único de columnas del reporte de visitas — usado tanto por el
 * route de descarga (`/api/reportes/visitas/export`, arma el Excel) como por
 * la página `/reportes` (pinta los checkboxes on/off). Mismo orden en ambos.
 */
export const VISITA_REPORT_COLUMNS: ReportColumn<VisitaReportRow>[] = [
  { key: 'id', header: 'ID', accessor: (r) => r.id, width: 8, format: 'integer' },
  { key: 'fecha', header: 'Fecha', accessor: (r) => parseDateLocal(r.fecha), width: 12, format: 'date' },
  { key: 'paciente', header: 'Nombre', accessor: (r) => r.paciente, width: 32 },
  { key: 'rut', header: 'RUT', accessor: (r) => r.rut, width: 14 },
  { key: 'comuna', header: 'Comuna', accessor: (r) => r.comuna, width: 18 },
  { key: 'origenContacto', header: 'Forma de contacto', accessor: (r) => r.origenContacto, width: 18 },
  { key: 'procedimientos', header: 'Procedimiento', accessor: (r) => r.procedimientos, width: 30, wrap: true },
  { key: 'examenes', header: 'Exámenes', accessor: (r) => r.examenes, width: 30, wrap: true },
  { key: 'metodoPago', header: 'Forma de pago', accessor: (r) => r.metodoPago, width: 16 },
  { key: 'montoVisita', header: 'Visita', accessor: (r) => r.montoVisita, width: 14, format: 'currency-clp' },
  { key: 'montoDescuento', header: 'Descuento', accessor: (r) => r.montoDescuento, width: 14, format: 'currency-clp' },
  { key: 'descuentoAfectaPagoEnfermera', header: 'Afecta Enfermera?', accessor: (r) => (r.descuentoAfectaPagoEnfermera ? 'SI' : 'NO'), width: 16 },
  { key: 'subtotalExamenes', header: 'Exámenes PARTICULARES / FONASA', accessor: (r) => r.subtotalExamenes, width: 18, format: 'currency-clp' },
  { key: 'montoInsumos', header: 'Insumos', accessor: (r) => r.montoInsumos, width: 14, format: 'currency-clp' },
  { key: 'totalBoleta', header: 'Total Boleta', accessor: (r) => r.totalBoleta, width: 16, format: 'currency-clp' },
  { key: 'hogar', header: 'Hogar', accessor: (r) => r.hogar, width: 20 },
  { key: 'isapre', header: 'Isapre', accessor: (r) => r.isapre, width: 18 },
  { key: 'imedFonasa', header: 'IMED Fonasa', accessor: (r) => r.imedFonasa, width: 16, format: 'currency-clp' },
  { key: 'imedIsapreTotal', header: 'IMED Isapre Total', accessor: (r) => r.imedIsapreTotal, width: 18, format: 'currency-clp' },
  { key: 'imedIsapreBono', header: 'IMED isapre Bono a pagar', accessor: (r) => r.imedIsapreBono, width: 20, format: 'currency-clp' },
]

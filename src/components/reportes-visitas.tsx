'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormDatePicker } from '@/components/form-date-picker'
import { SelectCombobox } from '@/components/select-combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Segmented } from '@/components/form-servicios'
import '@/components/form-shared.css'
import { VISITA_REPORT_COLUMNS } from '@/lib/reportes/visitas-columns'
import { ESTADOS_REPORTE_FINANCIERO_DEFAULT, REPORTE_FINANCIERO_COLUMNS } from '@/lib/reportes/financiero'

const ESTADO_OPTIONS = [
  { value: 'programada', label: 'Programada' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'realizada', label: 'Realizada' },
  { value: 'completada', label: 'Completada' },
  { value: 'no_realizada', label: 'No realizada' },
  { value: 'cancelada', label: 'Cancelada' },
]

type TipoReporte = 'financiero' | 'visitas'

type ReporteDef = {
  columns: { key: string; header: string }[]
  endpoint: string
  defaultEstados: readonly string[]
}

// Las columnas tienen accessors (funciones): se importan acá, del lado cliente,
// en vez de pasarse como props desde el server component.
const REPORTES: Record<TipoReporte, ReporteDef> = {
  financiero: {
    columns: REPORTE_FINANCIERO_COLUMNS,
    endpoint: '/api/reportes/financiero/export',
    defaultEstados: ESTADOS_REPORTE_FINANCIERO_DEFAULT,
  },
  visitas: {
    columns: VISITA_REPORT_COLUMNS,
    endpoint: '/api/reportes/visitas/export',
    defaultEstados: ['realizada'],
  },
}

type Props = {
  enfermeras: { id: number; nombre: string }[]
}

export function ReportesVisitas({ enfermeras }: Props) {
  const [tipo, setTipo] = useState<TipoReporte>('financiero')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          options={[
            { value: 'financiero', label: 'Financiero (ingresos y gastos)' },
            { value: 'visitas', label: 'Visitas (formato anterior)' },
          ]}
          value={tipo}
          onChange={setTipo}
        />
      </div>
      {tipo === 'financiero' ? (
        <Callout tone="info">
          Una columna por concepto real de la visita; las columnas de ingreso (descuentos en negativo) suman el Total
          boleta. En visitas no realizadas solo cuenta el cobro registrado al marcarlas, y las canceladas van en $0.
          El Excel trae además una hoja <b>Resumen</b> por mes (ingresos, pago a enfermeras y gastos mensuales) y el
          detalle de <b>Gastos mensuales</b> del período.
        </Callout>
      ) : null}
      <ReporteExcel key={tipo} reporte={REPORTES[tipo]} enfermeras={enfermeras} />
    </div>
  )
}

function ReporteExcel({ reporte, enfermeras }: Props & { reporte: ReporteDef }) {
  const COLUMNS = reporte.columns
  const [fechaInicio, setFechaInicio] = useState<string | undefined>(undefined)
  const [fechaFin, setFechaFin] = useState<string | undefined>(undefined)
  const [estadoIds, setEstadoIds] = useState<number[]>(() =>
    ESTADO_OPTIONS.flatMap((o, idx) => (reporte.defaultEstados.includes(o.value) ? [idx] : [])),
  )
  const [enfermeraIds, setEnfermeraIds] = useState<number[]>([])
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, true])),
  )

  const estadoOptions = ESTADO_OPTIONS.map((opt, idx) => ({ id: idx, label: opt.label }))
  const estadoValues = estadoIds.map((idx) => ESTADO_OPTIONS[idx]?.value).filter((v): v is string => Boolean(v))
  const enfermeraOptions = enfermeras.map((e) => ({ id: e.id, label: e.nombre }))

  const activeColumnKeys = useMemo(
    () => COLUMNS.filter((c) => selectedColumns[c.key]).map((c) => c.key),
    [COLUMNS, selectedColumns],
  )
  const allSelected = activeColumnKeys.length === COLUMNS.length
  const noneSelected = activeColumnKeys.length === 0

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function setAllColumns(value: boolean) {
    setSelectedColumns(Object.fromEntries(COLUMNS.map((c) => [c.key, value])))
  }

  function buildExportUrl(): string {
    const params = new URLSearchParams()
    if (fechaInicio) params.set('fechaInicio', fechaInicio)
    if (fechaFin) params.set('fechaFin', fechaFin)
    if (estadoValues.length > 0) params.set('estado', estadoValues.join(','))
    if (enfermeraIds.length > 0) params.set('enfermera', enfermeraIds.join(','))
    params.set('columns', activeColumnKeys.join(','))
    return `${reporte.endpoint}?${params.toString()}`
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="hl-label">
              Período
            </label>
            <FormDatePicker
              mode="range"
              weekStartsOn={1}
              value={{ from: fechaInicio, to: fechaFin }}
              onChange={(value) => {
                setFechaInicio(value?.from)
                setFechaFin(value?.to)
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="hl-label">
              Estado
            </label>
            <SelectCombobox
              mode="multi"
              options={estadoOptions}
              selected={estadoIds}
              onChange={setEstadoIds}
              placeholder="— Todos los estados —"
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
              Sin selección incluye todos los estados.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="hl-label">
              Enfermera
            </label>
            <SelectCombobox
              mode="multi"
              options={enfermeraOptions}
              selected={enfermeraIds}
              onChange={setEnfermeraIds}
              placeholder="— Todas —"
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
              Sin selección incluye todas las enfermeras.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Columnas</CardTitle>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAllColumns(true)}
              disabled={allSelected}
              className="hover:opacity-80 disabled:opacity-40"
              style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 0, cursor: 'pointer' }}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setAllColumns(false)}
              disabled={noneSelected}
              className="hover:opacity-80 disabled:opacity-40"
              style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 0, cursor: 'pointer' }}
            >
              Ninguna
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <label key={col.key} className="flex items-center gap-2" style={{ fontSize: 'var(--text-base)' }}>
                <Checkbox
                  checked={selectedColumns[col.key] ?? false}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                {col.header}
              </label>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
              {noneSelected
                ? 'Selecciona al menos una columna para descargar.'
                : `${activeColumnKeys.length} de ${COLUMNS.length} columnas seleccionadas`}
            </p>
            <Button asChild>
              <a
                href={noneSelected ? undefined : buildExportUrl()}
                aria-disabled={noneSelected}
                onClick={(e) => { if (noneSelected) e.preventDefault() }}
                style={{ opacity: noneSelected ? 0.5 : 1, cursor: noneSelected ? 'not-allowed' : 'pointer' }}
              >
                <Download />
                Descargar Excel
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

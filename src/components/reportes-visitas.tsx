'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormDatePicker } from '@/components/form-date-picker'
import { SelectCombobox } from '@/components/select-combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { VISITA_REPORT_COLUMNS } from '@/lib/reportes/visitas-columns'

const ESTADO_OPTIONS = [
  { value: 'programada', label: 'Programada' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'realizada', label: 'Realizada' },
  { value: 'completada', label: 'Completada' },
  { value: 'no_realizada', label: 'No realizada' },
  { value: 'cancelada', label: 'Cancelada' },
]

const DEFAULT_ESTADO_IDX = ESTADO_OPTIONS.findIndex((o) => o.value === 'realizada')

type Props = {
  enfermeras: { id: number; nombre: string }[]
}

export function ReportesVisitas({ enfermeras }: Props) {
  const [fechaInicio, setFechaInicio] = useState<string | undefined>(undefined)
  const [fechaFin, setFechaFin] = useState<string | undefined>(undefined)
  const [estadoIds, setEstadoIds] = useState<number[]>(DEFAULT_ESTADO_IDX >= 0 ? [DEFAULT_ESTADO_IDX] : [])
  const [enfermeraIds, setEnfermeraIds] = useState<number[]>([])
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(VISITA_REPORT_COLUMNS.map((c) => [c.key, true])),
  )

  const estadoOptions = ESTADO_OPTIONS.map((opt, idx) => ({ id: idx, label: opt.label }))
  const estadoValues = estadoIds.map((idx) => ESTADO_OPTIONS[idx]?.value).filter((v): v is string => Boolean(v))
  const enfermeraOptions = enfermeras.map((e) => ({ id: e.id, label: e.nombre }))

  const activeColumnKeys = useMemo(
    () => VISITA_REPORT_COLUMNS.filter((c) => selectedColumns[c.key]).map((c) => c.key),
    [selectedColumns],
  )
  const allSelected = activeColumnKeys.length === VISITA_REPORT_COLUMNS.length
  const noneSelected = activeColumnKeys.length === 0

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function setAllColumns(value: boolean) {
    setSelectedColumns(Object.fromEntries(VISITA_REPORT_COLUMNS.map((c) => [c.key, value])))
  }

  function buildExportUrl(): string {
    const params = new URLSearchParams()
    if (fechaInicio) params.set('fechaInicio', fechaInicio)
    if (fechaFin) params.set('fechaFin', fechaFin)
    if (estadoValues.length > 0) params.set('estado', estadoValues.join(','))
    if (enfermeraIds.length > 0) params.set('enfermera', enfermeraIds.join(','))
    params.set('columns', activeColumnKeys.join(','))
    return `/api/reportes/visitas/export?${params.toString()}`
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
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
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Estado
            </label>
            <SelectCombobox
              mode="multi"
              options={estadoOptions}
              selected={estadoIds}
              onChange={setEstadoIds}
              placeholder="— Todos los estados —"
            />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Sin selección incluye todos los estados.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Enfermera
            </label>
            <SelectCombobox
              mode="multi"
              options={enfermeraOptions}
              selected={enfermeraIds}
              onChange={setEnfermeraIds}
              placeholder="— Todas —"
            />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
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
              className="text-xs font-medium hover:opacity-80 disabled:opacity-40"
              style={{ color: 'var(--primary)' }}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setAllColumns(false)}
              disabled={noneSelected}
              className="text-xs font-medium hover:opacity-80 disabled:opacity-40"
              style={{ color: 'var(--primary)' }}
            >
              Ninguna
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {VISITA_REPORT_COLUMNS.map((col) => (
              <label key={col.key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                <Checkbox
                  checked={selectedColumns[col.key] ?? false}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                {col.header}
              </label>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {noneSelected
                ? 'Selecciona al menos una columna para descargar.'
                : `${activeColumnKeys.length} de ${VISITA_REPORT_COLUMNS.length} columnas seleccionadas`}
            </p>
            <a
              href={noneSelected ? undefined : buildExportUrl()}
              aria-disabled={noneSelected}
              onClick={(e) => { if (noneSelected) e.preventDefault() }}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                opacity: noneSelected ? 0.5 : 1,
                cursor: noneSelected ? 'not-allowed' : 'pointer',
              }}
            >
              <Download className="h-4 w-4" />
              Descargar Excel
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

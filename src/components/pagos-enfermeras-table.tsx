'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { SelectCombobox } from '@/components/select-combobox'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import type { PagoEnfermeraResumenRow } from '@/lib/actions/pagos-enfermeras'

const MONTHS = [
  { id: 1, label: 'Enero' },
  { id: 2, label: 'Febrero' },
  { id: 3, label: 'Marzo' },
  { id: 4, label: 'Abril' },
  { id: 5, label: 'Mayo' },
  { id: 6, label: 'Junio' },
  { id: 7, label: 'Julio' },
  { id: 8, label: 'Agosto' },
  { id: 9, label: 'Septiembre' },
  { id: 10, label: 'Octubre' },
  { id: 11, label: 'Noviembre' },
  { id: 12, label: 'Diciembre' },
]

function fmt(n: number) {
  return `$${n.toLocaleString('es-CL')}`
}

type Props = {
  rows: PagoEnfermeraResumenRow[]
  month: number
  year: number
  enfermeraId: string
  enfermeras: { id: number; nombre: string }[]
}

export function PagosEnfermerasTable({ rows, month, year, enfermeraId, enfermeras }: Props) {
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = React.useState<number | null>(month)
  const [selectedYear, setSelectedYear] = React.useState<number | null>(year)
  const [selectedEnfermera, setSelectedEnfermera] = React.useState<number | null>(
    enfermeraId ? Number(enfermeraId) : null,
  )
  const [isPending, startTransition] = React.useTransition()

  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    const firstYear = Math.min(year, currentYear) - 2
    const lastYear = Math.max(year, currentYear) + 1
    const options: { id: number; label: string }[] = []
    for (let y = lastYear; y >= firstYear; y--) {
      options.push({ id: y, label: String(y) })
    }
    return options
  }, [year])

  const nurseOptions = React.useMemo(
    () => [
      { id: 0, label: '— Todas —' },
      ...enfermeras.map((e) => ({ id: e.id, label: e.nombre })),
    ],
    [enfermeras],
  )

  const handleApply = () => {
    if (!selectedMonth || !selectedYear) return
    const p = new URLSearchParams()
    p.set('month', String(selectedMonth))
    p.set('year', String(selectedYear))
    if (selectedEnfermera) p.set('enfermeraId', String(selectedEnfermera))
    startTransition(() => {
      router.push(`/pagos-enfermeras?${p.toString()}`)
    })
  }

  const totals = rows.reduce(
    (acc, r) => ({
      cantidadVisitas: acc.cantidadVisitas + r.cantidadVisitas,
      montoVisitas: acc.montoVisitas + r.montoVisitas,
      montoProcs: acc.montoProcs + r.montoProcs,
      montoRecargos: acc.montoRecargos + r.montoRecargos,
      base: acc.base + r.base,
      pagoEstimado: acc.pagoEstimado + r.pagoEstimado,
    }),
    { cantidadVisitas: 0, montoVisitas: 0, montoProcs: 0, montoRecargos: 0, base: 0, pagoEstimado: 0 },
  )

  const tfootCellStyle: React.CSSProperties = { padding: 'var(--row-py) var(--cell-px)', color: 'var(--color-fg)', fontWeight: 600 }

  return (
    <div>
      {/* Filtros */}
      <div className="toolbar">
        <div className="toolbar__field">
          <label className="hl-label">Mes</label>
          <div className="w-[200px] min-w-0">
            <SelectCombobox
              mode="single"
              options={MONTHS}
              selected={selectedMonth}
              onChange={setSelectedMonth}
              placeholder="Mes"
              clearable={false}
            />
          </div>
        </div>
        <div className="toolbar__field">
          <label className="hl-label">Año</label>
          <div className="w-[140px] min-w-0">
            <SelectCombobox
              mode="single"
              options={years}
              selected={selectedYear}
              onChange={setSelectedYear}
              placeholder="Año"
              clearable={false}
            />
          </div>
        </div>
        <div className="toolbar__field">
          <label className="hl-label">Enfermera</label>
          <div className="w-[220px] min-w-0">
            <SelectCombobox
              mode="single"
              options={nurseOptions}
              selected={selectedEnfermera ?? 0}
              onChange={(v) => setSelectedEnfermera(v === 0 ? null : v)}
              placeholder="Enfermera"
              clearable={false}
            />
          </div>
        </div>
        <Button onClick={handleApply} disabled={isPending || !selectedMonth || !selectedYear}>
          Filtrar
        </Button>
      </div>

      {/* Tabla */}
      <div className="hl-card hl-card--flush">
        <div className="overflow-x-auto">
          <table className="hl-table">
            <thead>
              <tr>
                {['Enfermera', 'Visitas', 'Fee visita', 'Procedimientos', 'Recargos', 'Base cálculo', '%', 'Total a pagar'].map(
                  (h) => (
                    <th key={h} className={h === 'Enfermera' ? '' : 'hl-num'}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="Sin datos para el período seleccionado" />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.enfermeraId}>
                    <td style={{ fontWeight: 500 }}>
                      <Link
                        href={`/pagos-enfermeras/${row.enfermeraId}?month=${selectedMonth ?? month}&year=${selectedYear ?? year}`}
                        className="transition-colors hover:opacity-70"
                      >
                        {row.enfermera}
                      </Link>
                    </td>
                    <td className="hl-num hl-tnum">{row.cantidadVisitas}</td>
                    <td className="hl-num hl-tnum" style={{ color: row.montoVisitas > 0 ? 'var(--color-fg)' : 'var(--color-fg-muted)' }}>
                      {row.montoVisitas > 0 ? fmt(row.montoVisitas) : '—'}
                    </td>
                    <td className="hl-num hl-tnum" style={{ color: row.montoProcs > 0 ? 'var(--color-fg)' : 'var(--color-fg-muted)' }}>
                      {row.montoProcs > 0 ? fmt(row.montoProcs) : '—'}
                    </td>
                    <td className="hl-num hl-tnum" style={{ color: row.montoRecargos > 0 ? 'var(--color-fg)' : 'var(--color-fg-muted)' }}>
                      {row.montoRecargos > 0 ? fmt(row.montoRecargos) : '—'}
                    </td>
                    <td className="hl-num hl-tnum" style={{ fontWeight: 500 }}>{fmt(row.base)}</td>
                    <td className="hl-num hl-tnum" style={{ color: 'var(--color-fg-muted)' }}>{row.porcentaje}%</td>
                    <td className="hl-num hl-tnum" style={{ fontWeight: 600 }}>{fmt(row.pagoEstimado)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 1 && (
              <tfoot>
                <tr style={{ background: 'var(--color-surface-muted)', borderTop: '1px solid var(--color-border)' }}>
                  <td style={tfootCellStyle}>Total</td>
                  <td className="hl-num hl-tnum" style={tfootCellStyle}>{totals.cantidadVisitas}</td>
                  <td className="hl-num hl-tnum" style={tfootCellStyle}>{fmt(totals.montoVisitas)}</td>
                  <td className="hl-num hl-tnum" style={tfootCellStyle}>{fmt(totals.montoProcs)}</td>
                  <td className="hl-num hl-tnum" style={tfootCellStyle}>{fmt(totals.montoRecargos)}</td>
                  <td className="hl-num hl-tnum" style={tfootCellStyle}>{fmt(totals.base)}</td>
                  <td className="hl-num" style={{ ...tfootCellStyle, color: 'var(--color-fg-muted)', fontWeight: 400 }}>—</td>
                  <td className="hl-num hl-tnum" style={tfootCellStyle}>{fmt(totals.pagoEstimado)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

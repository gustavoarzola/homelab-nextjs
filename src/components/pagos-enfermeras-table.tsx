'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { SelectCombobox } from '@/components/select-combobox'
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

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
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
        <button
          type="button"
          onClick={handleApply}
          disabled={isPending || !selectedMonth || !selectedYear}
          className="h-10 rounded-full border px-6 text-sm font-medium transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            borderColor: 'var(--primary)',
            color: 'var(--primary)',
            backgroundColor: 'var(--background)',
          }}
        >
          Filtrar
        </button>
      </div>

      {/* Tabla */}
      <div
        className="overflow-x-auto rounded-lg border"
        style={{ borderColor: 'var(--border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--muted)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {['Enfermera', 'Visitas', 'Fee visita', 'Procedimientos', 'Recargos', 'Base cálculo', '%', 'Total a pagar'].map(
                (h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-sm font-medium ${h === 'Enfermera' ? 'text-left' : 'text-right'}`}
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Sin datos para el período seleccionado
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.enfermeraId}
                  className="border-t transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/pagos-enfermeras/${row.enfermeraId}?month=${selectedMonth ?? month}&year=${selectedYear ?? year}`}
                      className="transition-colors hover:opacity-70"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {row.enfermera}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--foreground)' }}>
                    {row.cantidadVisitas}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    style={{
                      color: row.montoVisitas > 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
                    }}
                  >
                    {row.montoVisitas > 0 ? fmt(row.montoVisitas) : '—'}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    style={{
                      color: row.montoProcs > 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
                    }}
                  >
                    {row.montoProcs > 0 ? fmt(row.montoProcs) : '—'}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    style={{
                      color: row.montoRecargos > 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
                    }}
                  >
                    {row.montoRecargos > 0 ? fmt(row.montoRecargos) : '—'}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {fmt(row.base)}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--muted-foreground)' }}>
                    {row.porcentaje}%
                  </td>
                  <td
                    className="px-4 py-3 text-right font-semibold"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {fmt(row.pagoEstimado)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr
                style={{
                  backgroundColor: 'var(--muted)',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <td
                  className="px-4 py-3 font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  Total
                </td>
                <td
                  className="px-4 py-3 text-right font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {totals.cantidadVisitas}
                </td>
                <td
                  className="px-4 py-3 text-right font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {fmt(totals.montoVisitas)}
                </td>
                <td
                  className="px-4 py-3 text-right font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {fmt(totals.montoProcs)}
                </td>
                <td
                  className="px-4 py-3 text-right font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {fmt(totals.montoRecargos)}
                </td>
                <td
                  className="px-4 py-3 text-right font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {fmt(totals.base)}
                </td>
                <td className="px-4 py-3 text-right" style={{ color: 'var(--muted-foreground)' }}>
                  —
                </td>
                <td
                  className="px-4 py-3 text-right font-semibold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {fmt(totals.pagoEstimado)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

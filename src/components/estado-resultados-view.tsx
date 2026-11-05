'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'

import { SelectCombobox } from '@/components/select-combobox'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { MetaGrid, MetaTile } from '@/components/ui/meta'
import type { EstadoResultadosData } from '@/lib/actions/estado-resultados'
import type { EerrRow, Indicador } from '@/lib/finanzas/estado-resultados'
import { MESES } from '@/lib/finanzas/periodo'

const MONTH_OPTIONS = MESES.map((label, i) => ({ id: i + 1, label }))

export function formatClp(n: number) {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('es-CL')}`
}

function formatIndicador(i: Indicador) {
  if (i.formato === 'clp') return formatClp(i.valor)
  if (i.formato === 'porcentaje') return `${i.valor.toLocaleString('es-CL', { maximumFractionDigits: 1 })} %`
  return i.valor.toLocaleString('es-CL')
}

function formatPct(p: number | null) {
  return p === null ? '' : `${p.toLocaleString('es-CL', { maximumFractionDigits: 1 })} %`
}

const INDENT = { 0: 'var(--cell-px)', 1: 'calc(var(--cell-px) + 20px)', 2: 'calc(var(--cell-px) + 40px)' } as const

function rowStyle(kind: EerrRow['kind']): React.CSSProperties {
  switch (kind) {
    case 'section':
      return { background: 'var(--color-surface-muted)' }
    case 'subtotal':
      return { fontWeight: 600, borderTop: '1px solid var(--color-border)' }
    case 'total':
      return { fontWeight: 700, background: 'var(--color-surface-muted)', borderTop: '1px solid var(--color-border-strong)' }
    case 'info':
      return { color: 'var(--color-fg-muted)' }
    default:
      return {}
  }
}

type Props = { data: EstadoResultadosData }

export function EstadoResultadosView({ data }: Props) {
  const router = useRouter()
  const [month, setMonth] = React.useState<number | null>(data.month)
  const [year, setYear] = React.useState<number | null>(data.year)
  const [isPending, startTransition] = React.useTransition()

  const years = React.useMemo(() => {
    const current = new Date().getFullYear()
    const first = Math.min(data.year, current) - 3
    const last = Math.max(data.year, current) + 1
    return Array.from({ length: last - first + 1 }, (_, i) => ({ id: last - i, label: String(last - i) }))
  }, [data.year])

  const apply = () => {
    if (!month || !year) return
    startTransition(() => router.push(`/estado-resultados?month=${month}&year=${year}`))
  }

  const { avisos } = data

  return (
    <div className="space-y-6">
      <div className="toolbar">
        <div className="toolbar__field">
          <label className="hl-label">Mes</label>
          <div className="w-[200px] min-w-0">
            <SelectCombobox mode="single" options={MONTH_OPTIONS} selected={month} onChange={setMonth} placeholder="Mes" clearable={false} />
          </div>
        </div>
        <div className="toolbar__field">
          <label className="hl-label">Año</label>
          <div className="w-[140px] min-w-0">
            <SelectCombobox mode="single" options={years} selected={year} onChange={setYear} placeholder="Año" clearable={false} />
          </div>
        </div>
        <Button onClick={apply} disabled={isPending || !month || !year}>
          Ver
        </Button>
        <Button variant="secondary" asChild>
          <a href={`/api/estado-resultados/export?month=${data.month}&year=${data.year}`}>
            <Download />
            Descargar Excel
          </a>
        </Button>
      </div>

      {avisos.realizadasPendientes.cantidad > 0 && (
        <Callout tone="warn">
          Hay {avisos.realizadasPendientes.cantidad} {avisos.realizadasPendientes.cantidad === 1 ? 'visita realizada' : 'visitas realizadas'} de
          este mes sin completar ({formatClp(avisos.realizadasPendientes.monto)}). El estado de resultados solo incluye visitas completadas, así
          que estas cifras cambiarán cuando se cierren.
        </Callout>
      )}
      {avisos.completadasSinEnfermera > 0 && (
        <Callout tone="warn">
          {avisos.completadasSinEnfermera} {avisos.completadasSinEnfermera === 1 ? 'visita completada no tiene' : 'visitas completadas no tienen'}{' '}
          enfermera asignada: suman ingresos pero ningún honorario.
        </Callout>
      )}
      {avisos.sinTasaRetencion && (
        <Callout tone="warn">No hay una tasa de retención de honorarios vigente para este mes: el informativo del SII queda en $0.</Callout>
      )}
      {data.totales.ajusteCuadratura !== 0 && (
        <Callout tone="bad">
          Los ingresos no cuadran con la suma de sus componentes por {formatClp(data.totales.ajusteCuadratura)}. Revisa las visitas con costo
          desactualizado.
        </Callout>
      )}

      <div className="hl-card hl-card--flush">
        <div className="overflow-x-auto">
          <table className="hl-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th className="hl-num">Monto</th>
                <th className="hl-num">% de ingresos</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) =>
                r.kind === 'section' ? (
                  <tr key={r.key} style={rowStyle(r.kind)}>
                    <td colSpan={3} style={{ fontWeight: 600, fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-fg-muted)' }}>
                      {r.label}
                    </td>
                  </tr>
                ) : (
                  <tr key={r.key} style={rowStyle(r.kind)}>
                    <td style={{ paddingLeft: INDENT[r.nivel] }}>
                      {r.label}
                      {r.nota && (
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--color-fg-muted)' }}>{r.nota}</div>
                      )}
                    </td>
                    <td className="hl-num hl-tnum" style={{ color: r.monto !== null && r.monto < 0 && r.kind === 'total' ? 'var(--color-destructive)' : undefined }}>
                      {r.monto === null ? '' : formatClp(r.monto)}
                    </td>
                    <td className="hl-num hl-tnum" style={{ color: 'var(--color-fg-muted)', fontWeight: 400 }}>
                      {formatPct(r.pctIngresos)}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 8 }}>Indicadores del mes</h2>
        <MetaGrid>
          {data.indicadores.map((i) => (
            <MetaTile key={i.key} label={i.label} value={formatIndicador(i)} />
          ))}
        </MetaGrid>
      </div>
    </div>
  )
}

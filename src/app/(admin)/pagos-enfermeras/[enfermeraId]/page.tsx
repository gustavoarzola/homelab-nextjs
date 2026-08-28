import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { getPagoEnfermeraDetalle } from '@/lib/actions/pagos-enfermeras'
import { formatDateTime } from '@/lib/format'
import { PageHeader } from '@/components/page-header'
import { MetaGrid, MetaTile } from '@/components/ui/meta'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function fmt(n: number) {
  return `$${n.toLocaleString('es-CL')}`
}

type Props = {
  params: Promise<{ enfermeraId: string }>
  searchParams: Promise<{ month?: string; year?: string }>
}

export default async function PagoEnfermeraDetallePage({ params, searchParams }: Props) {
  const { enfermeraId: enfermeraIdStr } = await params
  const sp = await searchParams
  const now = new Date()
  const month =
    Number(sp.month) >= 1 && Number(sp.month) <= 12 ? Number(sp.month) : now.getMonth() + 1
  const year =
    Number(sp.year) >= 2000 && Number(sp.year) <= 2100 ? Number(sp.year) : now.getFullYear()

  const enfermeraId = Number(enfermeraIdStr)
  if (!enfermeraId) notFound()

  const detalle = await getPagoEnfermeraDetalle(enfermeraId, month, year)
  if (!detalle) notFound()

  const backHref = `/pagos-enfermeras?month=${month}&year=${year}`
  const monthLabel = MONTH_LABELS[month - 1]

  return (
    <>
      <PageHeader
        crumb={
          <Link href={backHref} className="inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a pagos enfermeras
          </Link>
        }
        title={detalle.enfermera}
        meta={`${monthLabel} ${year}`}
      />

      {/* Tarjeta resumen */}
      <div className="hl-card" style={{ marginBottom: 24 }}>
        <MetaGrid>
          <MetaTile label="Visitas completadas" value={<span className="hl-tnum" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{detalle.cantidadVisitas}</span>} />
          <MetaTile label="Base cálculo" value={<span className="hl-tnum" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{fmt(detalle.baseTotal)}</span>} />
          <MetaTile label="Porcentaje" value={<span className="hl-tnum" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{detalle.porcentaje}%</span>} />
          <MetaTile label="Total a pagar" value={<span className="hl-tnum" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--color-primary)' }}>{fmt(detalle.pagoTotal)}</span>} />
        </MetaGrid>
      </div>

      {/* Tabla de visitas */}
      <div className="hl-card hl-card--flush">
        <div className="overflow-x-auto">
          <table className="hl-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Paciente</th>
                <th className="hl-num">Fee visita</th>
                <th className="hl-num">Procedimientos</th>
                <th className="hl-num">Recargos</th>
                <th className="hl-num">Base cálculo</th>
                <th className="hl-num">Pago estimado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {detalle.rows.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState title="Sin visitas para este período" />
                  </td>
                </tr>
              ) : (
                detalle.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="hl-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
                      {row.id}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatDateTime(row.fecha, row.hora)}
                    </td>
                    <td style={{ color: row.paciente ? 'var(--color-fg)' : 'var(--color-fg-muted)' }}>
                      {row.paciente ?? '—'}
                    </td>
                    <td className="hl-num hl-tnum" style={{ color: row.feeVisita > 0 ? 'var(--color-fg)' : 'var(--color-fg-muted)' }}>
                      {row.feeVisita > 0 ? fmt(row.feeVisita) : '—'}
                    </td>
                    <td className="hl-num hl-tnum" style={{ color: row.procedimientos > 0 ? 'var(--color-fg)' : 'var(--color-fg-muted)' }}>
                      {row.procedimientos > 0 ? fmt(row.procedimientos) : '—'}
                    </td>
                    <td className="hl-num hl-tnum" style={{ color: row.recargos > 0 ? 'var(--color-fg)' : 'var(--color-fg-muted)' }}>
                      {row.recargos > 0 ? fmt(row.recargos) : '—'}
                    </td>
                    <td className="hl-num hl-tnum" style={{ fontWeight: 500 }}>
                      {fmt(row.base)}
                    </td>
                    <td className="hl-num hl-tnum" style={{ fontWeight: 600 }}>
                      {fmt(row.pagoEstimado)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/visitas/${row.id}`} title="Ver / editar visita">
                          <ExternalLink />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {detalle.rows.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--color-surface-muted)', borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--row-py) var(--cell-px)', fontWeight: 600 }}>Total</td>
                  <td />
                  <td />
                  <td className="hl-num hl-tnum" style={{ padding: 'var(--row-py) var(--cell-px)', fontWeight: 600 }}>
                    {fmt(detalle.rows.reduce((s, r) => s + r.feeVisita, 0))}
                  </td>
                  <td className="hl-num hl-tnum" style={{ padding: 'var(--row-py) var(--cell-px)', fontWeight: 600 }}>
                    {fmt(detalle.rows.reduce((s, r) => s + r.procedimientos, 0))}
                  </td>
                  <td className="hl-num hl-tnum" style={{ padding: 'var(--row-py) var(--cell-px)', fontWeight: 600 }}>
                    {fmt(detalle.rows.reduce((s, r) => s + r.recargos, 0))}
                  </td>
                  <td className="hl-num hl-tnum" style={{ padding: 'var(--row-py) var(--cell-px)', fontWeight: 600 }}>
                    {fmt(detalle.baseTotal)}
                  </td>
                  <td className="hl-num hl-tnum" style={{ padding: 'var(--row-py) var(--cell-px)', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {fmt(detalle.pagoTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )
}

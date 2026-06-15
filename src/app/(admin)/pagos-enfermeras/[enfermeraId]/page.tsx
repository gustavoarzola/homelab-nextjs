import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { getPagoEnfermeraDetalle } from '@/lib/actions/pagos-enfermeras'
import { formatDateTime } from '@/lib/format'

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
      {/* Volver */}
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-2 text-sm transition-colors hover:opacity-70"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a pagos enfermeras
      </Link>

      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {detalle.enfermera}
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {monthLabel} {year}
        </p>
      </div>

      {/* Tarjeta resumen */}
      <div
        className="mb-6 grid grid-cols-2 gap-4 rounded-xl border p-5 sm:grid-cols-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Visitas realizadas
          </p>
          <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {detalle.cantidadVisitas}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Base cálculo
          </p>
          <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {fmt(detalle.baseTotal)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Porcentaje
          </p>
          <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {detalle.porcentaje}%
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Total a pagar
          </p>
          <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--primary)' }}>
            {fmt(detalle.pagoTotal)}
          </p>
        </div>
      </div>

      {/* Tabla de visitas */}
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
              {[
                { label: '#', align: 'left' },
                { label: 'Fecha', align: 'left' },
                { label: 'Paciente', align: 'left' },
                { label: 'Fee visita', align: 'right' },
                { label: 'Procedimientos', align: 'right' },
                { label: 'Recargos', align: 'right' },
                { label: 'Base cálculo', align: 'right' },
                { label: 'Pago estimado', align: 'right' },
                { label: '', align: 'right' },
              ].map((h, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 text-sm font-medium text-${h.align}`}
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detalle.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Sin visitas para este período
                </td>
              </tr>
            ) : (
              detalle.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {row.id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                    {formatDateTime(row.fecha, row.hora)}
                  </td>
                  <td className="px-4 py-3" style={{ color: row.paciente ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                    {row.paciente ?? '—'}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    style={{ color: row.feeVisita > 0 ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                  >
                    {row.feeVisita > 0 ? fmt(row.feeVisita) : '—'}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    style={{ color: row.procedimientos > 0 ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                  >
                    {row.procedimientos > 0 ? fmt(row.procedimientos) : '—'}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    style={{ color: row.recargos > 0 ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                  >
                    {row.recargos > 0 ? fmt(row.recargos) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--foreground)' }}>
                    {fmt(row.base)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--foreground)' }}>
                    {fmt(row.pagoEstimado)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/visitas/${row.id}`}
                      title="Ver / editar visita"
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:opacity-70"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {detalle.rows.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                <td className="px-4 py-3 font-semibold" style={{ color: 'var(--foreground)' }}>
                  Total
                </td>
                <td />
                <td />
                <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--foreground)' }}>
                  {fmt(detalle.rows.reduce((s, r) => s + r.feeVisita, 0))}
                </td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--foreground)' }}>
                  {fmt(detalle.rows.reduce((s, r) => s + r.procedimientos, 0))}
                </td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--foreground)' }}>
                  {fmt(detalle.rows.reduce((s, r) => s + r.recargos, 0))}
                </td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--foreground)' }}>
                  {fmt(detalle.baseTotal)}
                </td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--primary)' }}>
                  {fmt(detalle.pagoTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  )
}

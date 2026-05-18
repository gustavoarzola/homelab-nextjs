import Link from 'next/link'
import { Plus } from 'lucide-react'
import { searchCotizaciones } from '@/lib/actions/cotizaciones'

export default async function CotizacionesPage() {
  const { rows } = await searchCotizaciones({ filters: {}, sort: null, page: 1, pageSize: 100 }).catch(() => ({ rows: [], total: 0 }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cotizaciones</h1>
        <Link
          href="/cotizaciones/nueva"
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Plus className="h-4 w-4" />
          Nueva cotización
        </Link>
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-lg px-6 py-8 text-center"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', border: '1px solid' }}
        >
          <p style={{ color: 'var(--muted-foreground)' }}>No hay cotizaciones registradas</p>
        </div>
      ) : (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--muted)', borderBottomColor: 'var(--border)', borderBottom: '1px solid' }}>
                <th className="px-4 py-3 text-left text-sm font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Paciente</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Destinatario</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottomColor: 'var(--border)', borderBottom: '1px solid' }}
                  className="transition-colors hover:opacity-80"
                >
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/cotizaciones/${row.id}`} style={{ color: 'var(--primary)' }} className="hover:underline">
                      {row.fecha}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{row.paciente || '—'}</td>
                  <td className="px-4 py-3 text-sm">{row.destinatario || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className="inline-block rounded px-2 py-1 text-xs font-medium"
                      style={{
                        backgroundColor:
                          row.estado === 'borrador' ? 'oklch(0.7 0.1 290 / 20%)' :
                          row.estado === 'enviada' ? 'oklch(0.7 0.15 45 / 20%)' :
                          row.estado === 'aceptada' ? 'oklch(0.75 0.12 120 / 20%)' :
                          'oklch(0.65 0.15 40 / 20%)',
                        color:
                          row.estado === 'borrador' ? 'oklch(0.4 0.1 290)' :
                          row.estado === 'enviada' ? 'oklch(0.55 0.15 45)' :
                          row.estado === 'aceptada' ? 'oklch(0.55 0.12 120)' :
                          'oklch(0.45 0.15 40)',
                      }}
                    >
                      {row.estado.charAt(0).toUpperCase() + row.estado.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">${row.total.toLocaleString('es-CL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

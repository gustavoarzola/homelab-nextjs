'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import type { CobroPendienteRow, ResultadoPendienteRow } from '@/lib/actions/dashboard'

type CobrosProps = {
  items: CobroPendienteRow[]
}

type ResultadosProps = {
  items: ResultadoPendienteRow[]
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-black/8 px-4 py-6 text-center text-sm text-muted-foreground">
      Sin pendientes este mes.
    </div>
  )
}

export function DashboardCobrosTable({ items }: CobrosProps) {
  return (
    <Card className="border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_12px_30px_-20px_rgba(15,23,42,0.24)]">
      <CardHeader className="pb-3">
        <CardTitle>Cobros pendientes</CardTitle>
        <CardDescription>Visitas realizadas sin pago registrado</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium">Paciente</th>
                  <th className="px-3 py-2 text-right font-medium">Monto</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--foreground)' }}>
                    <td className="px-3 py-2 font-mono text-xs">{formatDate(item.fecha)}</td>
                    <td className="px-3 py-2">{item.paciente ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium" style={{ color: 'oklch(0.55 0.18 25)' }}>
                      ${item.costo.toLocaleString('es-CL')}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/visitas/${item.id}`}
                        className="flex items-center justify-end gap-1 text-xs transition-opacity hover:opacity-70"
                        style={{ color: 'var(--primary)' }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardResultadosTable({ items }: ResultadosProps) {
  return (
    <Card className="border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_12px_30px_-20px_rgba(15,23,42,0.24)]">
      <CardHeader className="pb-3">
        <CardTitle>Resultados pendientes</CardTitle>
        <CardDescription>Visitas realizadas con resultados por enviar</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium">Paciente</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--foreground)' }}>
                    <td className="px-3 py-2 font-mono text-xs">{formatDate(item.fecha)}</td>
                    <td className="px-3 py-2">{item.paciente ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/visitas/${item.id}`}
                        className="flex items-center justify-end gap-1 text-xs transition-opacity hover:opacity-70"
                        style={{ color: 'var(--primary)' }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

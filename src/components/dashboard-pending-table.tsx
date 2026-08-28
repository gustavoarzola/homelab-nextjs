'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/format'
import type { CobroPendienteRow, ResultadoPendienteRow } from '@/lib/actions/dashboard'

type CobrosProps = {
  items: CobroPendienteRow[]
}

type ResultadosProps = {
  items: ResultadoPendienteRow[]
}

export function DashboardCobrosTable({ items }: CobrosProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Cobros pendientes</CardTitle>
        <CardDescription>Visitas realizadas sin pago registrado</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title="Sin pendientes este mes." />
        ) : (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table className="hl-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th className="hl-num">Monto</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="hl-mono hl-tnum" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)', whiteSpace: 'nowrap' }}>{formatDate(item.fecha)}</td>
                    <td>{item.paciente ?? '—'}</td>
                    <td className="hl-num hl-tnum" style={{ fontWeight: 500, color: 'var(--color-destructive)' }}>
                      ${item.costo.toLocaleString('es-CL')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/visitas/${item.id}`}>
                          <ExternalLink />
                        </Link>
                      </Button>
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Resultados pendientes</CardTitle>
        <CardDescription>Visitas realizadas con resultados por enviar</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title="Sin pendientes este mes." />
        ) : (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table className="hl-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="hl-mono hl-tnum" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)', whiteSpace: 'nowrap' }}>{formatDate(item.fecha)}</td>
                    <td>{item.paciente ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/visitas/${item.id}`}>
                          <ExternalLink />
                        </Link>
                      </Button>
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

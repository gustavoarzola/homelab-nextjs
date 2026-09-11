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
  total: number
}

type ResultadosProps = {
  items: ResultadoPendienteRow[]
  totalExamenes: number
  totalVisitas: number
}

// Subtítulo: siempre muestra el total de pendientes del mes y, si la lista está
// truncada, aclara que es un quickview.
function quickviewCaption(shown: number, total: number, noun: [string, string]) {
  if (total === 0) return 'Sin pendientes este mes'
  const label = `${total} ${total === 1 ? noun[0] : noun[1]}`
  return total > shown ? `${label} · mostrando los primeros ${shown}` : label
}

// Subtítulo de "Resultados pendientes": dos magnitudes (exámenes por enviar y
// visitas que los agrupan) más la aclaración de truncado del quickview.
function resultadosCaption(shownVisitas: number, totalExamenes: number, totalVisitas: number) {
  if (totalExamenes === 0) return 'Sin pendientes este mes'
  const examenes = `${totalExamenes} ${totalExamenes === 1 ? 'examen por enviar' : 'exámenes por enviar'}`
  const visitas = `${totalVisitas} ${totalVisitas === 1 ? 'visita' : 'visitas'}`
  const label = `${examenes} en ${visitas}`
  return totalVisitas > shownVisitas ? `${label} · mostrando las primeras ${shownVisitas}` : label
}

export function DashboardCobrosTable({ items, total }: CobrosProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Cobros pendientes</CardTitle>
        <CardDescription>
          {quickviewCaption(items.length, total, ['cobro pendiente', 'cobros pendientes'])}
        </CardDescription>
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

export function DashboardResultadosTable({ items, totalExamenes, totalVisitas }: ResultadosProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Resultados pendientes</CardTitle>
        <CardDescription>
          {resultadosCaption(items.length, totalExamenes, totalVisitas)}
        </CardDescription>
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
                  <th>Exámenes pendientes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.idVisita}>
                    <td className="hl-mono hl-tnum" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)', whiteSpace: 'nowrap' }}>{formatDate(item.fecha)}</td>
                    <td>{item.paciente ?? '—'}</td>
                    <td>{item.examenes}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/visitas/${item.idVisita}`}>
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

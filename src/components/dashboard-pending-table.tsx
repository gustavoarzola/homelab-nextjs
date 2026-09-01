'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/format'
import { EXAM_GRUPO_META, type ExamGrupo } from '@/lib/exam-grupos'
import type { CobroPendienteRow, ResultadoPendienteRow } from '@/lib/actions/dashboard'

type CobrosProps = {
  items: CobroPendienteRow[]
  total: number
}

type ResultadosProps = {
  items: ResultadoPendienteRow[]
  total: number
}

// Subtítulo: cuando el total supera lo que se muestra, aclarar que es un quickview.
function quickviewCaption(shown: number, total: number, fallback: string) {
  return total > shown ? `Primeros ${shown} de ${total} pendientes` : fallback
}

function grupoLabel(grupo: string) {
  return EXAM_GRUPO_META[grupo as ExamGrupo]?.label ?? grupo
}

export function DashboardCobrosTable({ items, total }: CobrosProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Cobros pendientes</CardTitle>
        <CardDescription>
          {quickviewCaption(items.length, total, 'Visitas realizadas sin pago registrado')}
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

export function DashboardResultadosTable({ items, total }: ResultadosProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Resultados pendientes</CardTitle>
        <CardDescription>
          {quickviewCaption(items.length, total, 'Exámenes por enviar de visitas realizadas')}
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
                  <th>Examen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.idVisita}-${item.idExamen}`}>
                    <td className="hl-mono hl-tnum" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)', whiteSpace: 'nowrap' }}>{formatDate(item.fecha)}</td>
                    <td>{item.paciente ?? '—'}</td>
                    <td>
                      <div>{item.examenNombre}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
                        {item.examenCodigo} · {grupoLabel(item.examenGrupo)}
                      </div>
                    </td>
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

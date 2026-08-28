'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

type Props = {
  cobrosEnPendiente: number
}

export function DashboardFinanceCard({ cobrosEnPendiente }: Props) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center"
            style={{ borderRadius: 'var(--radius-md)', background: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' }}
          >
            <AlertCircle className="h-4 w-4" />
          </div>
          <CardTitle style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-fg-muted)' }}>
            Cobros pendientes
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="hl-tnum" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: '-0.01em' }}>
          ${cobrosEnPendiente.toLocaleString('es-CL')}
        </p>
      </CardContent>
    </Card>
  )
}

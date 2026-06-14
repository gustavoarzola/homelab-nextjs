'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

type Props = {
  cobrosEnPendiente: number
}

export function DashboardFinanceCard({ cobrosEnPendiente }: Props) {
  return (
    <Card className="border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_12px_30px_-20px_rgba(15,23,42,0.24)]">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'oklch(0.65 0.18 25 / 10%)', color: 'oklch(0.55 0.18 25)' }}
          >
            <AlertCircle className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
            Cobros pendientes
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
          ${cobrosEnPendiente.toLocaleString('es-CL')}
        </p>
      </CardContent>
    </Card>
  )
}

'use client'

import { Stethoscope } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PagoEnfermeraRow } from '@/lib/actions/dashboard'

type Props = {
  items: PagoEnfermeraRow[]
}

export function DashboardNursePayCard({ items }: Props) {
  const maxMonto = Math.max(...items.map((i) => i.monto), 1)

  return (
    <Card className="border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_12px_30px_-20px_rgba(15,23,42,0.24)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(44,95,158,0.08)] text-[var(--primary)]">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Pago estimado enfermeras</CardTitle>
            <CardDescription>Basado en % de comisión configurado por enfermera</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-5">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/8 px-4 py-6 text-sm text-muted-foreground">
            No hay datos para este período.
          </div>
        ) : (
          items.map((item) => {
            const width = `${Math.max((item.monto / maxMonto) * 100, 10)}%`
            return (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {item.visits} visita{item.visits === 1 ? '' : 's'}
                    </span>
                    <span className="w-24 text-right font-mono text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      ${item.monto.toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#2c5f9e,#6da5d9)]"
                    style={{ width }}
                  />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

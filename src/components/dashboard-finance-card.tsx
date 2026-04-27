'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, AlertCircle, Truck } from 'lucide-react'

type Props = {
  totalFacturado: number
  cobrosEnPendiente: number
  costoTraslados: number
}

export function DashboardFinanceCard({ totalFacturado, cobrosEnPendiente, costoTraslados }: Props) {
  const items = [
    {
      label: 'Total facturado',
      value: totalFacturado,
      icon: DollarSign,
      color: 'oklch(0.45 0.118 184.704)',
      bg: 'oklch(0.6 0.118 184.704 / 10%)',
    },
    {
      label: 'Cobros pendientes',
      value: cobrosEnPendiente,
      icon: AlertCircle,
      color: 'oklch(0.55 0.18 25)',
      bg: 'oklch(0.65 0.18 25 / 10%)',
    },
    {
      label: 'Costo traslados',
      value: costoTraslados,
      icon: Truck,
      color: 'oklch(0.45 0.15 60)',
      bg: 'oklch(0.65 0.15 60 / 10%)',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map(({ label, value, icon: Icon, color, bg }) => (
        <Card
          key={label}
          className="border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_12px_30px_-20px_rgba(15,23,42,0.24)]"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: bg, color }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {label}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
              ${value.toLocaleString('es-CL')}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

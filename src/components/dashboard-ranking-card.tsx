'use client'

import { Building2, FlaskConical, Stethoscope } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

type RankingItem = {
  label: string
  value: number
}

type Props = {
  title: string
  description: string
  items: RankingItem[]
  icon?: 'laboratory' | 'nurse' | 'composicion'
  // Sufijo por fila: `{ one: 'visita', many: 'visitas' }` → "3 visitas".
  // `null` muestra solo el número (útil cuando el label ya nombra la unidad).
  unit?: { one: string; many: string } | null
}

const ICONS = {
  laboratory: Building2,
  nurse: Stethoscope,
  composicion: FlaskConical,
} as const

export function DashboardRankingCard({
  title,
  description,
  items,
  icon = 'laboratory',
  unit = { one: 'visita', many: 'visitas' },
}: Props) {
  const maxValue = Math.max(...items.map((item) => item.value), 1)
  const Icon = ICONS[icon]

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center"
            style={{ borderRadius: 'var(--radius-lg)', background: 'var(--brand-blue-soft)', color: 'var(--brand-blue-fg)' }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="line-clamp-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-1">
        {items.length === 0 ? (
          <EmptyState title="No hay datos para este período." />
        ) : (
          items.map((item, index) => {
            const width = item.value === 0
              ? '0%'
              : `${Math.max((item.value / maxValue) * 100, 10)}%`

            return (
              <div key={`${index}-${item.label}`} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="min-w-0 flex-1 break-words" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>
                    {item.label}
                  </span>
                  <span className="shrink-0 whitespace-nowrap" style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
                    {unit
                      ? `${item.value} ${item.value === 1 ? unit.one : unit.many}`
                      : item.value}
                  </span>
                </div>
                <div className="hl-progress">
                  <i style={{ width, background: 'linear-gradient(90deg, var(--brand-blue), var(--brand-blue-strong))' }} />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
